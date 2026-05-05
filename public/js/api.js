/**
 * API Client - Cookie-based auth with CSRF protection
 */

const API = {
  base: '',
  _currentController: null,

  _headers(contentType) {
    const h = {};
    const csrf = this._getCsrfToken();
    if (csrf) h['X-CSRF-Token'] = csrf;
    if (contentType) h['Content-Type'] = 'application/json';
    return h;
  },

  _getCsrfToken() {
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    return match ? match[1] : null;
  },

  _createAbortController() {
    if (this._currentController) this._currentController.abort();
    this._currentController = new AbortController();
    return this._currentController;
  },

  async _fetch(path, options = {}) {
    const controller = this._createAbortController();
    const csrf = this._getCsrfToken();

    options.headers = { ...(options.headers || {}) };
    if (csrf) {
      options.headers['X-CSRF-Token'] = csrf;
    }
    options.credentials = 'include';
    options.signal = controller.signal;

    const r = await fetch(this.base + path, options);

    if (!r.ok) {
      let msg;
      try {
        const body = await r.json();
        msg = body.error || body.message || r.statusText;
      } catch {
        if (r.status === 401) {
          window.location.hash = '#/login';
          throw new Error('Session expired. Please log in again.');
        }
        msg = 'Request failed';
      }
      throw new Error(msg || `HTTP ${r.status}`);
    }

    const contentType = r.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return r.json();
    }
    return r.text();
  },

  async get(path) {
    return this._fetch(path);
  },

  async post(path, body) {
    return this._fetch(path, {
      method: 'POST',
      headers: this._headers(true),
      body: JSON.stringify(body),
    });
  },

  async put(path, body) {
    return this._fetch(path, {
      method: 'PUT',
      headers: this._headers(true),
      body: JSON.stringify(body),
    });
  },

  async del(path) {
    return this._fetch(path, { method: 'DELETE' });
  },

  isAuthenticated() {
    return document.cookie.includes('token=');
  },
};
