/**
 * API Client - Cookie-based auth with CSRF protection
 */

const API = {
  base: '',
  timeout: 12000,

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

  async _fetch(path, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.timeout);

    const csrf = this._getCsrfToken();
    options.headers = { ...(options.headers || {}) };
    if (csrf) options.headers['X-CSRF-Token'] = csrf;
    options.credentials = 'include';
    options.signal = controller.signal;

    try {
      const r = await fetch(this.base + path, options);
      clearTimeout(timeoutId);

      if (!r.ok) {
        let msg;
        try {
          const body = await r.json();
          msg = body.error || body.message || r.statusText;
        } catch {
          msg = r.statusText || `HTTP ${r.status}`;
        }
        if (r.status === 401) {
          throw new Error('Not authenticated');
        }
        const err = new Error(msg || `HTTP ${r.status}`);
        err.status = r.status;
        err.response = { data: { error: msg } };
        throw err;
      }

      const contentType = r.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return r.json();
      }
      return r.text();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('Request timed out. Please try again.');
        timeoutErr.response = { data: { error: 'Request timed out' } };
        throw timeoutErr;
      }
      if (err.message?.includes('Failed to fetch')) {
        const netErr = new Error('Network error. Check your connection.');
        netErr.response = { data: { error: 'Network error' } };
        throw netErr;
      }
      throw err;
    }
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
};
