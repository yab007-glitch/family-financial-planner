/**
 * API Client - Cookie-based auth with CSRF protection
 */

const API = {
  base: '',
  _currentController: null as AbortController | null,

  _headers(contentType?: boolean): Record<string, string> {
    const h: Record<string, string> = {};
    const csrf = this._getCsrfToken();
    if (csrf) h['X-CSRF-Token'] = csrf;
    if (contentType) h['Content-Type'] = 'application/json';
    return h;
  },

  _getCsrfToken(): string | null {
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    return match ? match[1] : null;
  },

  _createAbortController(): AbortController {
    if (this._currentController) this._currentController.abort();
    this._currentController = new AbortController();
    return this._currentController;
  },

  async _fetch(path: string, options: RequestInit = {}): Promise<unknown> {
    const controller = this._createAbortController();
    const csrf = this._getCsrfToken();

    options.headers = { ...(options.headers || {}) };
    if (csrf) {
      (options.headers as Record<string, string>)['X-CSRF-Token'] = csrf;
    }
    options.credentials = 'include';
    options.signal = controller.signal;

    const r = await fetch(this.base + path, options);

    if (!r.ok) {
      let msg: string;
      try {
        const body = await r.json() as { error?: string; message?: string };
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

  async get(path: string): Promise<unknown> {
    return this._fetch(path);
  },

  async post(path: string, body: unknown): Promise<unknown> {
    return this._fetch(path, {
      method: 'POST',
      headers: this._headers(true),
      body: JSON.stringify(body),
    });
  },

  async put(path: string, body: unknown): Promise<unknown> {
    return this._fetch(path, {
      method: 'PUT',
      headers: this._headers(true),
      body: JSON.stringify(body),
    });
  },

  async del(path: string): Promise<unknown> {
    return this._fetch(path, { method: 'DELETE' });
  },

  isAuthenticated(): boolean {
    return document.cookie.includes('token=');
  },
};
