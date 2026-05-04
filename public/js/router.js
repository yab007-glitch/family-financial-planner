/**
 * Family Financial Planner - Hash Router
 */
const Router = {
  currentPage: '',
  familySlug: 'bheekun',

  init() {
    window.addEventListener('hashchange', () => this.load());
    const stored = localStorage.getItem('familySlug');
    if (stored) this.familySlug = stored;
    this.load();
  },

  getPageFromHash() {
    const hash = window.location.hash.replace('#/', '') || 'dashboard';
    return hash.split('/')[0];
  },

  async load() {
    const page = this.getPageFromHash();
    this.currentPage = page;

    // Update nav active state
    document.querySelectorAll('.nav-links a').forEach(a => {
      a.classList.toggle('active', a.dataset.page === page);
    });

    const container = document.getElementById('page-content');
    container.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';

    try {
      // Fetch page template
      const res = await fetch(`/pages/${page}.html`);
      if (!res.ok) throw new Error('Page not found');
      const html = await res.text();
      container.innerHTML = html;

      // Call page init if exists
      if (window[`init${this.capitalize(page)}`]) {
        await window[`init${this.capitalize(page)}`](this.familySlug);
      }
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>Failed to load page: ${err.message}</p></div>`;
    }
  },

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  go(page) {
    window.location.hash = `/${page}`;
  }
};
