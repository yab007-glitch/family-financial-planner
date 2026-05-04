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

    // Keyboard navigation: Escape closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
      }
    });
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
    Loading.show(container, 'Loading page...');

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
      Loading.error(container, `Failed to load page: ${err.message}`);
    }
  },

  capitalize(str) {
    // Handle hyphenated page names like "tax-planner" -> "TaxPlanner"
    return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  },

  go(page) {
    window.location.hash = `/${page}`;
  }
};