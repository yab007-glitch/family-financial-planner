/**
 * API Client - Cookie-based auth with CSRF protection
 */

const API = {
  base: '',
  timeout: 12000,
  _csrfToken: sessionStorage.getItem('csrf_token') || null,

  setCsrfToken(token) {
    this._csrfToken = token;
    if (token) {
      sessionStorage.setItem('csrf_token', token);
    } else {
      sessionStorage.removeItem('csrf_token');
    }
  },

  _getCsrfToken() {
    return this._csrfToken;
  },

  _headers(contentType) {
    const h = {};
    const csrf = this._getCsrfToken();
    if (csrf) h['X-CSRF-Token'] = csrf;
    if (contentType) h['Content-Type'] = 'application/json';
    return h;
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
          this.setCsrfToken(null);
          throw new Error('Not authenticated');
        }
        const err = new Error(msg || `HTTP ${r.status}`);
        err.status = r.status;
        err.response = { data: { error: msg } };
        throw err;
      }

      const contentType = r.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await r.json();
        // If the response contains a new CSRF token, store it
        if (data && data.data && data.data.csrfToken) {
          this.setCsrfToken(data.data.csrfToken);
        }
        return data;
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
    return this._fetch(path, { 
      method: 'DELETE',
      headers: this._headers(false) 
    });
  },
};
