/**
 * Family Financial Planner - UX Utilities
 * Toast notifications, loading states, and form validation
 */

// ==================== TOAST NOTIFICATIONS ====================
const Toast = {
  container: null,

  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.setAttribute('role', 'status');
    this.container.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.container);
  },

  show(message, type = 'info', duration = 3000) {
    this.init();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <span class="toast-icon">${this.getIcon(type)}</span>
      <span class="toast-message">${this.escapeHtml(message)}</span>
      <button class="toast-close" onclick="this.parentElement.remove()" aria-label="Dismiss notification">&times;</button>
    `;
    this.container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error', 5000); },
  warning(msg) { this.show(msg, 'warning', 4000); },
  info(msg) { this.show(msg, 'info'); },

  getIcon(type) {
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    return icons[type] || icons.info;
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// ==================== LOADING STATES ====================
const Loading = {
  show(container, message = 'Loading...') {
    const el = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    if (!el) return;
    el.innerHTML = `
      <div class="loading-state" role="status" aria-live="polite">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    `;
  },

  error(container, message = 'Something went wrong') {
    const el = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    if (!el) return;
    el.innerHTML = `
      <div class="error-state" role="alert">
        <span style="font-size:2rem">⚠️</span>
        <p>${message}</p>
        <button class="btn" onclick="Router.load()">Retry</button>
      </div>
    `;
  },

  empty(container, message = 'No data yet') {
    const el = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    if (!el) return;
    el.innerHTML = `
      <div class="empty-state">
        <p>${message}</p>
      </div>
    `;
  }
};

// ==================== FORM VALIDATION ====================
const FormValidator = {
  rules: {},

  register(formId, rules) {
    this.rules[formId] = rules;
  },

  validate(formId, data) {
    const rules = this.rules[formId] || {};
    const errors = {};

    for (const [field, ruleList] of Object.entries(rules)) {
      const value = data[field];
      for (const rule of ruleList) {
        const error = rule(value, field);
        if (error) {
          errors[field] = error;
          break;
        }
      }
    }
    return errors;
  },

  // Validator factories
  required(msg) {
    return (val) => (val === undefined || val === null || val === '' ? (msg || 'This field is required') : null);
  },

  minLength(min, msg) {
    return (val) => (val && val.length < min ? (msg || `Must be at least ${min} characters`) : null);
  },

  maxLength(max, msg) {
    return (val) => (val && val.length > max ? (msg || `Must be at most ${max} characters`) : null);
  },

  slug(msg) {
    return (val) => (val && !/^[a-z0-9-]+$/.test(val) ? (msg || 'Only lowercase letters, numbers, and hyphens allowed') : null);
  },

  number(min, max, msg) {
    return (val) => {
      if (val === undefined || val === null || val === '') return null; // Use required() separately
      const num = Number(val);
      if (isNaN(num)) return msg || 'Must be a valid number';
      if (min !== undefined && num < min) return msg || `Must be at least ${min}`;
      if (max !== undefined && num > max) return msg || `Must be at most ${max}`;
      return null;
    };
  },

  enum(values, msg) {
    return (val) => (val && !values.includes(val) ? (msg || `Must be one of: ${values.join(', ')}`) : null);
  },

  // Show errors in the UI
  showErrors(formEl, errors) {
    // Clear previous errors
    formEl.querySelectorAll('.field-error').forEach(el => el.remove());
    formEl.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

    for (const [field, message] of Object.entries(errors)) {
      const input = formEl.querySelector(`[name="${field}"]`);
      if (input) {
        input.classList.add('input-error');
        input.setAttribute('aria-invalid', 'true');
        const errorEl = document.createElement('div');
        errorEl.className = 'field-error';
        errorEl.setAttribute('role', 'alert');
        errorEl.textContent = message;
        input.parentNode.appendChild(errorEl);
      }
    }
  },

  clearErrors(formEl) {
    formEl.querySelectorAll('.field-error').forEach(el => el.remove());
    formEl.querySelectorAll('.input-error').forEach(el => {
      el.classList.remove('input-error');
      el.removeAttribute('aria-invalid');
    });
  }
};

// ==================== ENHANCED API WRAPPER ====================
const EnhancedAPI = {
  ...API,

  async get(path) {
    try {
      const r = await fetch(this.base + path);
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${r.status})`);
      }
      return r.json();
    } catch (err) {
      Toast.error(err.message);
      throw err;
    }
  },

  async post(path, body) {
    try {
      const r = await fetch(this.base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${r.status})`);
      }
      const result = await r.json();
      Toast.success('Saved successfully');
      return result;
    } catch (err) {
      Toast.error(err.message);
      throw err;
    }
  },

  async put(path, body) {
    try {
      const r = await fetch(this.base + path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${r.status})`);
      }
      const result = await r.json();
      Toast.success('Updated successfully');
      return result;
    } catch (err) {
      Toast.error(err.message);
      throw err;
    }
  },

  async del(path) {
    try {
      const r = await fetch(this.base + path, { method: 'DELETE' });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${r.status})`);
      }
      const result = await r.json();
      Toast.success('Deleted successfully');
      return result;
    } catch (err) {
      Toast.error(err.message);
      throw err;
    }
  }
};

// ==================== HELPERS ====================
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount || 0);
}

function statusBadge(status) {
  const map = {
    'Completed': 'badge-success',
    'Done': 'badge-success',
    'In Progress': 'badge-warning',
    'Pending': 'badge-neutral',
    'Not Started': 'badge-neutral',
    'Active': 'badge-success',
    'Gap identified': 'badge-danger',
    'Pending review': 'badge-warning'
  };
  return `<span class="badge ${map[status] || 'badge-neutral'}">${status}</span>`;
}

function confirmAction(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">Confirm</h2>
        <p>${message}</p>
        <div class="modal-actions">
          <button class="btn-secondary" id="confirm-cancel">Cancel</button>
          <button class="btn" id="confirm-ok">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#confirm-cancel').onclick = () => { overlay.remove(); resolve(false); };
    overlay.querySelector('#confirm-ok').onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector('#confirm-cancel').focus();

    // Close on Escape
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { overlay.remove(); resolve(false); }
    });
  });
}