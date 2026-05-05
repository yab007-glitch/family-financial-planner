function sanitizeHTML(str) {
  if (typeof str !== 'string') return String(str);
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const Router = {
  currentPage: '',
  familySlug: localStorage.getItem('familySlug') || null,
  _loadingPage: null,

  PROTECTED_ROUTES: ['dashboard', 'family', 'finances', 'budget', 'goals', 'insurance', 'actions', 'milestones', 'reports', 'tools', 'tax'],
  PUBLIC_ROUTES: ['login', 'register', 'welcome'],

  init() {
    window.addEventListener('hashchange', () => this.load());
    window.addEventListener('popstate', () => this.load());
    if (localStorage.getItem('familySlug')) {
      this.familySlug = localStorage.getItem('familySlug');
    }
    this.load();
  },

  getPageFromHash() {
    const hash = window.location.hash.replace('#/', '') || 'dashboard';
    const parts = hash.split('/');
    if (parts[0] === 'family' && parts[1]) {
      this.setFamily(parts[1]);
      return 'dashboard';
    }
    return parts[0];
  },

  beforeRouteChange() {
    if (typeof Charts !== 'undefined' && Charts.instances) {
      Object.values(Charts.instances).forEach(ch => {
        try { ch.destroy(); } catch {}
      });
      Charts.instances = {};
    }
    if (this._loadingPage) {
      this._loadingPage = null;
    }
  },

  async load() {
    const page = this.getPageFromHash();
    const isAuthenticated = API.isAuthenticated();

    if (this.PROTECTED_ROUTES.includes(page) && !isAuthenticated) {
      this.navigate('login');
      return;
    }

    if (page === 'login' && isAuthenticated) {
      this.navigate('dashboard');
      return;
    }

    this.currentPage = page;
    this.beforeRouteChange();

    if (window.__appState) {
      window.__appState.currentPage = page;
    }

    document.querySelectorAll('.nav-links a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href').replace('#/', '') === page);
    });

    const container = document.getElementById('page-content');
    if (!container) return;
    container.setAttribute('aria-busy', 'true');
    container.innerHTML = `
      <div class="empty-state">
        <div class="skeleton" style="width:120px;height:120px;border-radius:50%;margin:0 auto 16px"></div>
        <p>Loading ${sanitizeHTML(page)}...</p>
      </div>`;

    try {
      const res = await fetch(`/pages/${page}.html`);
      if (res.status === 404) {
        container.innerHTML = `<div class="empty-state">
          <div style="font-size:64px;margin-bottom:16px">404</div>
          <h2>Page Not Found</h2>
          <p>The page "${sanitizeHTML(page)}" doesn't exist.</p>
          <button class="btn btn-primary" onclick="Router.navigate('dashboard')">Go to Dashboard</button>
        </div>`;
        container.setAttribute('aria-busy', 'false');
        return;
      }
      if (!res.ok) throw new Error(`Failed to load page (${res.status})`);

      const html = await res.text();
      container.innerHTML = html;
      container.setAttribute('aria-busy', 'false');

      const initFn = window[`init${this.capitalize(page)}`];
      if (initFn) {
        await initFn(this.familySlug || undefined);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      container.innerHTML = `<div class="empty-state">
        <div style="font-size:48px;margin-bottom:12px">!</div>
        <h3>Something went wrong</h3>
        <p>${sanitizeHTML(err.message || 'An unexpected error occurred')}</p>
        <button class="btn btn-primary" onclick="Router.load()">Try Again</button>
      </div>`;
      container.setAttribute('aria-busy', 'false');
    }
  },

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  navigate(page) {
    window.location.hash = `/${page}`;
  },

  go(page) {
    this.navigate(page);
  },

  setFamily(slug) {
    this.familySlug = slug;
    localStorage.setItem('familySlug', slug);
  },
};
