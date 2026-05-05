/* ============================================================
   Family Financial Planner v2.0 — Frontend Master Controller
   ============================================================ */

// ── Toast System ──
const Toast = {
  container: null,
  init() {
    this.container = document.getElementById('toast-container');
  },
  show(message, type = 'info', duration = 3500) {
    if (!this.container) this.init();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span style="font-size:1.2rem">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span style="flex:1">${message}</span>
    `;
    this.container.appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }
};

// ── Helpers ──
function formatCurrency(n) {
  if (n === undefined || n === null) return '$0';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
}

function statusBadge(status) {
  const map = {
    'Active': 'badge-success', 'Completed': 'badge-success', 'Done': 'badge-success',
    'In Progress': 'badge-info', 'Pending': 'badge-warning',
    'Gap identified': 'badge-danger', 'Declined': 'badge-danger',
    'Not Started': 'badge-neutral'
  };
  const cls = map[status] || 'badge-neutral';
  return `<span class="badge ${cls}">${status || '—'}</span>`;
}

function openModal(title, html, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${title}</h2>
      <div>${html}</div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn" id="modal-confirm">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('modal-confirm').addEventListener('click', () => {
    onConfirm();
    overlay.remove();
  });
}

// ── Input validation helpers ──
function safeParseFloat(value, defaultValue = 0) {
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

function validatePositiveNumber(value, fieldName) {
  const num = safeParseFloat(value, NaN);
  if (isNaN(num) || num < 0) {
    Toast.show(`${fieldName} must be a positive number.`, 'error');
    return null;
  }
  return num;
}

// ── Chart Helpers ──
const Charts = {
  instances: {},
  destroy(id) {
    if (this.instances[id]) { this.instances[id].destroy(); delete this.instances[id]; }
  },
  line(id, labels, datasets) {
    this.destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    this.instances[id] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => '$' + (v >= 1000 ? (v/1000)+'K' : v) } },
        },
      },
    });
  },
  doughnut(id, labels, data, colors) {
    this.destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    this.instances[id] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } },
        cutout: '65%',
      },
    });
  },
  bar(id, labels, datasets) {
    this.destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    this.instances[id] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor } },
        },
        borderRadius: 4,
      },
    });
  }
};

// ── Alpine App Shell ──
function appShell() {
  return {
    isAuthenticated: document.cookie.includes('token='),
    authTab: 'login',
    familyName: '',
    currentPage: 'dashboard',
    sidebarOpen: false,
    theme: localStorage.getItem('theme') || 'dark',
    auth: { email: '', password: '', name: '', loading: false },

    initApp() {
      window.__appState = this;
      document.documentElement.setAttribute('data-theme', this.theme);
      if (this.isAuthenticated) {
        Router.init();
        this.loadFamily();
      }
    },

    async login() {
      this.auth.loading = true;
      try {
        const r = await API.post('/api/auth/login', { email: this.auth.email, password: this.auth.password });
        if (!r.success) throw new Error(r.error);
        localStorage.setItem('user', JSON.stringify({ id: r.data.id, name: r.data.name, email: r.data.email }));
        this.isAuthenticated = true;
        Toast.show('Welcome back!', 'success');
        setTimeout(() => { Router.init(); this.loadFamily(); }, 100);
      } catch (e) { Toast.show(e.message, 'error'); }
      this.auth.loading = false;
    },

    async register() {
      this.auth.loading = true;
      try {
        const r = await API.post('/api/auth/register', { email: this.auth.email, password: this.auth.password, name: this.auth.name });
        if (!r.success) throw new Error(r.error);
        localStorage.setItem('user', JSON.stringify({ id: r.data.id, name: r.data.name, email: r.data.email }));
        this.isAuthenticated = true;
        Toast.show('Account created successfully!', 'success');
        setTimeout(() => { Router.init(); this.loadFamily(); }, 100);
      } catch (e) { Toast.show(e.message, 'error'); }
      this.auth.loading = false;
    },

    logout() {
      localStorage.removeItem('user');
      localStorage.removeItem('familySlug');
      this.isAuthenticated = false;
      this.authTab = 'login';
      window.location.hash = '';
      Toast.show('Signed out', 'info');
    },

    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', this.theme);
      document.documentElement.setAttribute('data-theme', this.theme);
      // Re-render charts if any
      setTimeout(() => {
        if (window.location.hash.includes('dashboard')) Router.load();
      }, 50);
    },

    async loadFamily() {
      try {
        const slug = Router.familySlug;
        const r = await API.get(`/api/families/${slug}`);
        if (r.success) this.familyName = r.data.name || slug;
      } catch {}
    }
  };
}

// ── Dashboard ──
async function initDashboard(slug) {
  try {
    const [family, summary] = await Promise.all([
      API.get(`/api/families/${slug}`),
      API.get(`/api/families/${slug}/summary`)
    ]);
    if (!family.success) throw new Error(family.error);

    const data = family.data;
    const s = summary.data;

    const familyNameEl = document.getElementById('family-name');
    if (familyNameEl) familyNameEl.textContent = data.name || slug;
    const dashNameEl = document.getElementById('dash-name');
    if (dashNameEl) dashNameEl.textContent = data.name || slug;
    const dashLocationEl = document.getElementById('dash-location');
    if (dashLocationEl) dashLocationEl.textContent = data.location || 'Not set';
    const dashTaxEl = document.getElementById('dash-tax');
    if (dashTaxEl) dashTaxEl.textContent = data.tax_situation || 'Not set';

    const netWorthEl = document.getElementById('dash-net-worth');
    if (netWorthEl) {
      netWorthEl.textContent = formatCurrency(s.netWorth);
      netWorthEl.className = 'stat-value ' + (s.netWorth >= 0 ? 'positive' : 'negative');
    }
    const assetsEl = document.getElementById('dash-assets');
    if (assetsEl) assetsEl.textContent = formatCurrency(s.assets);
    const liabilitiesEl = document.getElementById('dash-liabilities');
    if (liabilitiesEl) liabilitiesEl.textContent = formatCurrency(s.liabilities);
    const incomeEl = document.getElementById('dash-income');
    if (incomeEl) incomeEl.textContent = formatCurrency(s.totalIncome);
    const expensesEl = document.getElementById('dash-expenses');
    if (expensesEl) expensesEl.textContent = formatCurrency(s.totalExpenses);
    const savingsEl = document.getElementById('dash-savings-rate');
    if (savingsEl) savingsEl.textContent = s.savingsRate + '%';

    // Goals with progress bars
    const goalsGrid = document.getElementById('dash-goals');
    if (data.goals?.length) {
      goalsGrid.innerHTML = data.goals.slice(0, 3).map(g => {
        const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
        return `
          <div class="card card-accent" style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span class="stat-label">${g.description}</span>
              <span class="badge ${pct >= 100 ? 'badge-success' : pct >= 50 ? 'badge-info' : 'badge-warning'}">${Math.round(pct)}%</span>
            </div>
            <div class="stat-value" style="font-size:1.2rem">${formatCurrency(g.current_amount)} <span style="font-size:0.7rem;color:var(--text-light)">/ ${formatCurrency(g.target_amount)}</span></div>
            <div class="progress-bar"><div class="progress-fill ${pct >= 100 ? 'success' : pct >= 50 ? '' : 'warning'}" style="width:${pct}%"></div></div>
          </div>
        `;
      }).join('');
    } else {
      goalsGrid.innerHTML = '<div class="empty-state"><p>No goals yet</p></div>';
    }

    // Actions
    const actionsList = document.getElementById('dash-actions');
    if (data.actions?.length) {
      actionsList.innerHTML = data.actions.slice(0, 5).map(a => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
          <span>${a.description}</span>
          ${statusBadge(a.status)}
        </div>
      `).join('');
    } else {
      actionsList.innerHTML = '<div class="empty-state"><p>No action items</p></div>';
    }

    // Smart Recommendations
    await loadSmartRecommendations(data, s);

    // Charts
    renderDashboardCharts(data, s);

  } catch (err) {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><p>Error loading dashboard: ${err.message}</p></div>`;
  }
}

function renderDashboardCharts(family, summary) {
  // Net worth history chart
  if (family.snapshots?.length >= 2) {
    const labels = family.snapshots.map((sn, i) => i % 3 === 0 || i === family.snapshots.length - 1 ? sn.snapshot_date : '');
    Charts.line('networth-chart', labels, [
      {
        label: 'Net Worth',
        data: family.snapshots.map(s => s.net_worth),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
      },
      {
        label: 'Assets',
        data: family.snapshots.map(s => s.assets),
        borderColor: '#16a34a',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        borderDash: [4, 4]
      },
      {
        label: 'Liabilities',
        data: family.snapshots.map(s => s.liabilities),
        borderColor: '#dc2626',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        borderDash: [4, 4]
      }
    ]);
  } else {
    const el = document.getElementById('networth-chart');
    if (el) el.parentElement.innerHTML = '<div class="empty-state" style="padding:32px"><p>Add accounts to see net worth history</p></div>';
  }

  // Asset allocation doughnut
  if (family.accounts?.length) {
    const groups = {};
    family.accounts.forEach(a => { groups[a.type] = (groups[a.type] || 0) + (a.balance || 0); });
    const labels = Object.keys(groups);
    const data = Object.values(groups);
    const colors = ['#2563eb', '#16a34a', '#ca8a04', '#dc2626', '#0891b2', '#7c3aed', '#db2777'];
    Charts.doughnut('asset-chart', labels, data, colors.slice(0, labels.length));
  } else {
    const el = document.getElementById('asset-chart');
    if (el) el.parentElement.innerHTML = '<div class="empty-state" style="padding:32px"><p>No accounts yet</p></div>';
  }

  // Monthly budget bar chart
  const entries = family.budget || [];
  const monthMap = {};
  entries.forEach(e => {
    if (!monthMap[e.month_year]) monthMap[e.month_year] = { income: 0, expense: 0 };
    if (e.type === 'income') monthMap[e.month_year].income += e.amount;
    else monthMap[e.month_year].expense += e.amount;
  });
  const months = Object.keys(monthMap).sort();
  if (months.length >= 1) {
    Charts.bar('budget-chart', months, [
      { label: 'Income', data: months.map(m => monthMap[m].income), backgroundColor: '#16a34a' },
      { label: 'Expenses', data: months.map(m => monthMap[m].expense), backgroundColor: '#dc2626' },
    ]);
  } else {
    const el = document.getElementById('budget-chart');
    if (el) el.parentElement.innerHTML = '<div class="empty-state" style="padding:32px"><p>Add budget entries to see trends</p></div>';
  }
}

async function loadSmartRecommendations(family, summary) {
  const recContainer = document.getElementById('smart-recommendations');
  if (!recContainer) return;
  const recommendations = [];

  if (!summary.totalIncome && !family.accounts?.some(a => a.balance > 0)) {
    recommendations.push({ urgency: 'high', icon: '🌱', title: 'Start building your profile', description: 'Add your income, accounts, and debts to get personalized recommendations.', action: 'Go to Finances', link: '#/finances' });
  }

  const tfsa = family.accounts?.find(a => a.type === 'TFSA');
  const rrsp = family.accounts?.find(a => a.type === 'RRSP');
  const ef = family.accounts?.find(a => a.type === 'Emergency Fund');

  if (ef && ef.balance < 10000) {
    recommendations.push({ urgency: 'high', icon: '🛡️', title: 'Build Emergency Fund First', description: 'Target: $10,000–25,000 (3–6 months expenses). Priority before investing.', action: 'Add Account', link: '#/finances' });
  }

  if (tfsa && tfsa.balance === 0) {
    recommendations.push({ urgency: 'high', icon: '🎯', title: 'Open TFSA — $78,000 Room Available', description: 'Tax-free growth forever. For Quebec residents, one of the best wealth-building tools.', action: 'Go to Tax Planner', link: '#/tax-planner' });
  }

  if (rrsp && rrsp.balance === 0 && summary.totalIncome > 70000) {
    recommendations.push({ urgency: 'high', icon: '💰', title: 'Open RRSP — $100–130K Room Available', description: `At $${Math.round(summary.totalIncome/1000)}K income, RRSP contributions yield large tax refunds.`, action: 'Go to Tax Planner', link: '#/tax-planner' });
  }

  if (family.members?.find(m => m.role?.toLowerCase().includes('child') || m.role?.toLowerCase().includes('dependent'))) {
    recommendations.push({ urgency: 'high', icon: '🎓', title: 'Start RESP for Kids', description: 'Contribute $2,500/child/year = $500 free CESG per child. Max grant: $7,200/child.', action: 'Tax Planner → RESP', link: '#/tax-planner' });
  }

  const termLife = family.insurance?.find(i => i.type?.includes('Term Life'));
  if (termLife && termLife.status === 'Gap identified') {
    recommendations.push({ urgency: 'medium', icon: '🔍', title: 'Review Term Life Insurance Gap', description: 'You identified a coverage gap. Revisit after emergency fund is funded.', action: 'View Insurance', link: '#/insurance' });
  }

  if (recommendations.length > 0) {
    recContainer.innerHTML = `
      <div class="card card-accent" style="margin-bottom:24px">
        <h3>💡 Smart Recommendations</h3>
        <div style="margin-top:12px">
          ${recommendations.map(r => `
            <div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--border);align-items:flex-start">
              <span style="font-size:1.6rem;flex-shrink:0">${r.icon}</span>
              <div style="flex:1;min-width:0">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                  <strong style="font-size:0.95rem">${r.title}</strong>
                  ${r.urgency === 'high' ? '<span class="badge badge-danger">URGENT</span>' : '<span class="badge badge-warning">Consider</span>'}
                </div>
                <p style="margin-top:6px;color:var(--text-light);font-size:0.9rem;line-height:1.5">${r.description}</p>
                <a href="${r.link}" style="display:inline-block;margin-top:10px;color:var(--primary);font-weight:600;font-size:0.85rem" onclick="event.preventDefault();Router.go('${r.link.replace('#/', '')}')">${r.action} →</a>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    recContainer.innerHTML = `
      <div class="card card-success" style="margin-bottom:24px">
        <h3>✅ All Systems Go</h3>
        <p style="color:var(--text-light);margin-top:8px">Your financial foundation looks solid. Keep contributing and review quarterly.</p>
      </div>
    `;
  }
}

// ── Family Page ──
async function initFamily(slug) {
  try {
    const family = await API.get(`/api/families/${slug}`);
    if (!family.success) throw new Error(family.error);
    const data = family.data;

    document.getElementById('fam-name').textContent = data.name || 'Family';
    document.getElementById('fam-location').textContent = data.location || 'Not set';
    document.getElementById('fam-tax').textContent = data.tax_situation || 'Not set';

    const tbody = document.getElementById('members-table');
    if (data.members?.length) {
      tbody.innerHTML = data.members.map(m => `
        <tr><td><strong>${m.name}</strong></td><td>${m.role || '—'}</td><td>${m.age ?? '—'}</td><td style="color:var(--text-light);font-size:0.85rem">${m.notes || ''}</td></tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No members added yet</td></tr>';
    }
  } catch (err) {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

// ── Finances Page ──
async function initFinances(slug) {
  try {
    const family = await API.get(`/api/families/${slug}`);
    if (!family.success) throw new Error(family.error);
    const data = family.data;
    const netWorth = (data.accounts?.reduce((a,b)=>a+(b.balance||0),0) || 0) - (data.debts?.reduce((a,b)=>a+(b.balance||0),0) || 0);
    document.getElementById('fin-net-worth').textContent = formatCurrency(netWorth);

    const accBody = document.getElementById('accounts-table');
    if (data.accounts?.length) {
      accBody.innerHTML = data.accounts.map(a => `
        <tr><td><strong>${a.type}</strong></td><td>${a.institution || '—'}</td><td class="${a.balance >= 0 ? 'positive' : 'negative'}">${formatCurrency(a.balance)}</td><td>${a.contribution_room || '—'}</td></tr>
      `).join('');
    } else { accBody.innerHTML = '<tr><td colspan="4" class="empty-state">No accounts</td></tr>'; }

    const debtBody = document.getElementById('debts-table');
    if (data.debts?.length) {
      debtBody.innerHTML = data.debts.map(d => `
        <tr><td><strong>${d.type}</strong></td><td class="negative">${formatCurrency(d.balance)}</td><td>${d.interest_rate || '—'}%</td><td>${d.monthly_payment ? formatCurrency(d.monthly_payment) : '—'}</td></tr>
      `).join('');
    } else { debtBody.innerHTML = '<tr><td colspan="4" class="empty-state">No debts</td></tr>'; }
  } catch (err) {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

// ── Budget Page ──
async function initBudget(slug) {
  try {
    const res = await API.get(`/api/families/${slug}/budget`);
    const entries = res.data || [];
    const income = entries.filter(e => e.type === 'income').reduce((a,b)=>a+b.amount,0);
    const expense = entries.filter(e => e.type === 'expense').reduce((a,b)=>a+b.amount,0);
    const net = income - expense;
    const rate = income > 0 ? ((net / income) * 100).toFixed(1) : 0;

    document.getElementById('bud-income').textContent = formatCurrency(income);
    document.getElementById('bud-expense').textContent = formatCurrency(expense);
    document.getElementById('bud-net').textContent = formatCurrency(net);
    document.getElementById('bud-net').className = 'stat-value ' + (net >= 0 ? 'positive' : 'negative');
    document.getElementById('bud-rate').textContent = rate + '%';

    const tbody = document.getElementById('budget-table');
    if (!entries.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No budget entries yet</td></tr>';
      return;
    }
    tbody.innerHTML = entries.map(e => `
      <tr>
        <td>${e.month_year || '—'}</td><td>${e.category || '—'}</td><td>${e.subcategory || '—'}</td>
        <td><span class="badge ${e.type === 'income' ? 'badge-success' : 'badge-danger'}">${e.type}</span></td>
        <td>${formatCurrency(e.amount)}</td>
      </tr>
    `).join('');
  } catch (err) {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

function openAddBudgetModal() {
  const html = `
    <div class="form-group"><label>Month (YYYY-MM)</label><input id="b-month" value="${new Date().toISOString().slice(0,7)}"></div>
    <div class="form-group"><label>Category</label><input id="b-category" placeholder="Housing, Food, Salary..."></div>
    <div class="form-group"><label>Subcategory</label><input id="b-subcategory"></div>
    <div class="form-group"><label>Type</label>
      <select id="b-type"><option value="income">Income</option><option value="expense">Expense</option></select>
    </div>
    <div class="form-group"><label>Amount</label><input id="b-amount" type="number" value="0"></div>
    <div class="form-group"><label>Notes</label><textarea id="b-notes" rows="2"></textarea></div>
  `;
  openModal('Add Budget Entry', html, async () => {
    const amount = validatePositiveNumber(document.getElementById('b-amount').value, 'Amount');
    if (amount === null) return;
    try {
      await API.post(`/api/families/${Router.familySlug}/budget`, {
        month_year: document.getElementById('b-month').value,
        category: document.getElementById('b-category').value,
        subcategory: document.getElementById('b-subcategory').value,
        type: document.getElementById('b-type').value,
        amount,
        notes: document.getElementById('b-notes').value
      });
      Toast.show('Budget entry added', 'success');
      initBudget(Router.familySlug);
    } catch (e) {
      Toast.show(e.message, 'error');
    }
  });
}

// ── Goals Page ──
async function initGoals(slug) {
  try {
    const res = await API.get(`/api/families/${slug}/goals`);
    const goals = res.data || [];
    const container = document.getElementById('goals-list');

    if (!goals.length) {
      container.innerHTML = '<div class="empty-state"><p>No goals set yet. Time to dream big! 🎯</p></div>';
      return;
    }

    container.innerHTML = goals.map(g => {
      const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
      return `
        <div class="card card-accent">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <strong style="font-size:1.05rem">${g.description}</strong>
                ${statusBadge(g.status)}
                ${g.timeframe ? `<span class="badge badge-neutral">${g.timeframe}</span>` : ''}
              </div>
              <div class="progress-bar" style="margin:14px 0 8px"><div class="progress-fill ${pct >= 100 ? 'success' : pct >= 50 ? '' : 'warning'}" style="width:${pct}%"></div></div>
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;color:var(--text-light)">
                <span>${formatCurrency(g.current_amount)} / ${formatCurrency(g.target_amount)} — ${Math.round(pct)}%</span>
                ${g.deadline ? `<span>Due ${g.deadline}</span>` : ''}
              </div>
              ${g.monthly_contribution ? `<div style="margin-top:6px;font-size:0.8rem;color:var(--info)">💡 Monthly target: ${formatCurrency(g.monthly_contribution)} (${g.project_return || 7}% return)</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

// ── Actions Page ──
async function initActions(slug) {
  try {
    const res = await API.get(`/api/families/${slug}/actions`);
    const items = res.data || [];
    const container = document.getElementById('actions-list');

    if (!items.length) {
      container.innerHTML = '<div class="empty-state"><p>No action items. You\'re all caught up! 🎉</p></div>';
      return;
    }

    const phases = {};
    items.forEach(a => { const p = a.phase || 'General'; if (!phases[p]) phases[p] = []; phases[p].push(a); });

    container.innerHTML = Object.entries(phases).map(([phase, actions]) => `
      <div class="card" style="margin-bottom:16px">
        <h3 style="margin-bottom:12px">${phase}</h3>
        ${actions.map(a => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">
            <span style="${a.status === 'Done' ? 'text-decoration:line-through;opacity:0.6' : ''}">${a.description}</span>
            ${statusBadge(a.status)}
          </div>
        `).join('')}
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

// ── Milestones Page ──
async function initMilestones(slug) {
  try {
    const res = await API.get(`/api/families/${slug}/milestones`);
    const items = res.data || [];
    const container = document.getElementById('milestones-list');
    if (!items.length) { container.innerHTML = '<div class="empty-state"><p>No milestones set.</p></div>'; return; }
    container.innerHTML = items.map(m => `
      <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
        <div><strong>${m.name}</strong><div style="font-size:0.85rem;color:var(--text-light);margin-top:4px">${m.target_date || ''} — ${m.celebration_plan || ''}</div></div>
        ${statusBadge(m.status)}
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

// ── Insurance Page ──
async function initInsurance(slug) {
  try {
    const family = await API.get(`/api/families/${slug}`);
    const data = family.data;
    const tbody = document.getElementById('insurance-table-page');
    if (data.insurance?.length) {
      tbody.innerHTML = data.insurance.map(i => `
        <tr><td><strong>${i.type}</strong></td><td>${i.provider || '—'}</td><td>${i.coverage || '—'}</td><td>${i.premium || '—'}</td><td>${statusBadge(i.status)}</td></tr>
      `).join('');
    } else { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No insurance policies yet</td></tr>'; }
  } catch (err) {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

function openAddInsuranceModal() {
  const html = `
    <div class="form-group"><label>Type</label><input id="i-type" required></div>
    <div class="form-group"><label>Provider</label><input id="i-provider"></div>
    <div class="form-group"><label>Coverage</label><input id="i-coverage"></div>
    <div class="form-group"><label>Premium</label><input id="i-premium"></div>
    <div class="form-group"><label>Status</label><select id="i-status"><option>Active</option><option>Gap identified</option><option>Pending</option><option>Declined</option></select></div>
  `;
  openModal('Add Insurance Policy', html, async () => {
    try {
      await API.post(`/api/families/${Router.familySlug}/insurance`, {
        type: document.getElementById('i-type').value,
        provider: document.getElementById('i-provider').value,
        coverage: document.getElementById('i-coverage').value,
        premium: document.getElementById('i-premium').value,
        status: document.getElementById('i-status').value
      });
      Toast.show('Insurance policy added', 'success');
      initInsurance(Router.familySlug);
    } catch (e) {
      Toast.show(e.message, 'error');
    }
  });
}

// ── Tax Planner Page ──
async function initTaxPlanner(slug) { await calculateTax(); }

async function calculateTax() {
  const income = validatePositiveNumber(document.getElementById('tp-income')?.value, 'Income');
  if (income === null) return;
  const age = parseInt(document.getElementById('tp-age')?.value) || 0;
  const numChildren = parseInt(document.getElementById('tp-children')?.value) || 0;
  const availableCash = validatePositiveNumber(document.getElementById('tp-cash')?.value, 'Available cash');
  if (availableCash === null) return;

  try {
    const taxRes = await API.post(`/api/families/${Router.familySlug}/tax/calculate`, { income });
    const tax = taxRes.data;
    if (!tax) { Toast.show('Could not calculate taxes', 'error'); return; }

    document.getElementById('tax-results').style.display = 'block';
    document.getElementById('tp-gross').textContent = formatCurrency(tax.grossIncome);
    document.getElementById('tp-federal-tax').textContent = formatCurrency(tax.federalTax);
    document.getElementById('tp-quebec-tax').textContent = formatCurrency(tax.quebecTax);
    document.getElementById('tp-payroll').textContent = formatCurrency(tax.payrollDeductions.total);
    document.getElementById('tp-total-tax').textContent = formatCurrency(tax.totalTax);
    document.getElementById('tp-after-tax').textContent = formatCurrency(tax.afterTaxIncome);
    document.getElementById('tp-avg-rate').textContent = tax.averageTaxRate + '%';
    document.getElementById('tp-marginal').textContent = (tax.marginalTaxRate * 100).toFixed(1) + '%';

    const stratRes = await API.post(`/api/families/${Router.familySlug}/tax/strategy`, {
      income, age, num_children: numChildren, available_cash: availableCash
    });
    const strategy = stratRes.data;

    document.getElementById('tp-strategy-cards').innerHTML = strategy.strategy.map((s, i) => {
      const step = strategy.year_one_plan?.find(p => p.priority === s.priority);
      return `
        <div class="card card-accent" style="margin-bottom:14px;border-left-color:${i < 2 ? 'var(--success)' : i < 4 ? 'var(--primary)' : 'var(--text-light)'}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:1.1rem;font-weight:700">${s.priority}. ${s.account}</span>
            ${step?.allocation ? `<span class="stat-value positive" style="font-size:1rem">${formatCurrency(step.allocation)}</span>` : ''}
          </div>
          <p style="margin-top:8px;color:var(--text-light);font-size:0.9rem;line-height:1.5">${s.reason}</p>
          ${step?.benefit ? `<div class="badge badge-success" style="margin-top:8px">${step.benefit}</div>` : ''}
        </div>
      `;
    }).join('');

    const y1 = document.getElementById('tp-year-one');
    if (strategy.year_one_plan?.length) {
      y1.innerHTML = `
        <div class="table-container">
          <table>
            <thead><tr><th>Priority</th><th>Account</th><th>Allocation</th><th>Benefit</th><th>Remaining</th></tr></thead>
            <tbody>
              ${strategy.year_one_plan.map(p => `
                <tr>
                  <td>${p.priority}</td>
                  <td><strong>${p.account}</strong>${p.note ? ` <span class="stat-label">(${p.note})</span>` : ''}</td>
                  <td>${formatCurrency(p.allocation || 0)}</td>
                  <td>${p.benefit || '—'}</td>
                  <td>${p.remainingAfter !== undefined ? formatCurrency(p.remainingAfter) : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      y1.innerHTML = '<div class="empty-state"><p>Enter available cash to see a detailed action plan.</p></div>';
    }

    document.getElementById('tp-rules').innerHTML = strategy.rules.map(r => `
      <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);align-items:flex-start">
        <span style="font-size:1.2rem;flex-shrink:0">➡️</span><span style="font-size:0.9rem;line-height:1.5">${r}</span>
      </div>
    `).join('');
  } catch (err) {
    Toast.show(err.message, 'error');
  }
}

// ── Export Page ──
async function initExport(slug) {
  try {
    const res = await API.get(`/api/families/${slug}/tools/export-report?format=json`);
    const d = res.data;
    const container = document.getElementById('export-preview');
    if (!res.success) { container.innerHTML = `<div class="empty-state"><p>Error: ${res.error}</p></div>`; return; }

    container.innerHTML = `
      <div class="grid grid-4">
        <div class="card" style="background:var(--bg)">
          <div class="stat-label">Family</div><div class="stat-value" style="font-size:1.1rem">${d.family?.name || 'N/A'}</div>
          <div class="stat-label" style="margin-top:4px">${d.family?.location || ''} · ${d.family?.members?.length || 0} members</div>
        </div>
        <div class="card" style="background:var(--bg)">
          <div class="stat-label">Net Worth</div>
          <div class="stat-value ${(d.netWorth?.assets || 0) >= (d.netWorth?.liabilities || 0) ? 'positive' : 'negative'}" style="font-size:1.1rem">${formatCurrency((d.netWorth?.assets || 0) - (d.netWorth?.liabilities || 0))}</div>
          <div class="stat-label" style="margin-top:4px">Assets ${formatCurrency(d.netWorth?.assets || 0)} · Debts ${formatCurrency(d.netWorth?.liabilities || 0)}</div>
        </div>
        <div class="card" style="background:var(--bg)">
          <div class="stat-label">Accounts</div><div class="stat-value" style="font-size:1.1rem">${d.netWorth?.accounts?.length || 0}</div>
          <div class="stat-label" style="margin-top:4px">${d.netWorth?.debts?.length || 0} debts · ${d.insurance?.length || 0} policies</div>
        </div>
        <div class="card" style="background:var(--bg)">
          <div class="stat-label">Goals & Actions</div><div class="stat-value" style="font-size:1.1rem">${d.goals?.length || 0} goals</div>
          <div class="stat-label" style="margin-top:4px">${d.actionItems?.length || 0} actions · ${d.milestones?.length || 0} milestones</div>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('export-preview').innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

function exportReport(format) {
  window.open(`/api/families/${Router.familySlug}/tools/export-report?format=${format}`, '_blank');
}

// ── Monte Carlo Page ──
async function initMonteCarlo(slug) { runMonteCarlo(); }

async function runMonteCarlo() {
  const currentPortfolio = validatePositiveNumber(document.getElementById('mc-portfolio')?.value, 'Current portfolio');
  if (currentPortfolio === null) return;
  const monthlyContribution = validatePositiveNumber(document.getElementById('mc-contribution')?.value, 'Monthly contribution');
  if (monthlyContribution === null) return;
  const monthlyWithdrawal = validatePositiveNumber(document.getElementById('mc-spending')?.value, 'Monthly withdrawal');
  if (monthlyWithdrawal === null) return;
  const yearsToRetirement = parseInt(document.getElementById('mc-years-retire')?.value) || 27;
  const yearsInRetirement = parseInt(document.getElementById('mc-years-retired')?.value) || 25;
  const expectedReturn = validatePositiveNumber(document.getElementById('mc-return')?.value, 'Expected return');
  if (expectedReturn === null) return;
  const volatility = validatePositiveNumber(document.getElementById('mc-vol')?.value, 'Volatility');
  if (volatility === null) return;
  const inflation = validatePositiveNumber(document.getElementById('mc-inflation')?.value, 'Inflation');
  if (inflation === null) return;

  const params = {
    currentPortfolio,
    monthlyContribution,
    monthlyWithdrawal,
    yearsToRetirement,
    yearsInRetirement,
    expectedReturn,
    volatility,
    inflation,
    numSimulations: 10000,
  };

  try {
    const res = await API.post(`/api/families/${Router.familySlug}/tools/monte-carlo`, params);
    if (!res.success) { Toast.show(res.error, 'error'); return; }
    const d = res.data;
    document.getElementById('mc-results').style.display = 'block';

    const rate = d.summary.successRate;
    const rateEl = document.getElementById('mc-success-rate');
    rateEl.textContent = rate + '%';
    rateEl.style.color = rate >= 80 ? 'var(--success)' : rate >= 60 ? 'var(--warning)' : 'var(--danger)';
    document.getElementById('mc-verdict').textContent = d.interpretation?.[0]?.title || '';

    document.getElementById('mc-median').textContent = formatCurrency(d.summary.medianFinalValue);
    document.getElementById('mc-p10').textContent = formatCurrency(d.summary.percentile10);
    document.getElementById('mc-p90').textContent = formatCurrency(d.summary.percentile90);
    document.getElementById('mc-bankrupt').textContent = d.summary.bankruptcies.toLocaleString() + ' of 10,000';

    document.getElementById('mc-interpretation').innerHTML = d.interpretation.map(i => `
      <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);align-items:flex-start">
        <span style="font-size:1.3rem;flex-shrink:0">${i.level === 'excellent' ? '✅' : i.level === 'good' ? '👍' : i.level === 'fair' ? '⚠️' : i.level === 'poor' ? '🚨' : '💡'}</span>
        <div><strong>${i.title}</strong><p style="color:var(--text-light);font-size:0.9rem;margin-top:4px;line-height:1.5">${i.description}</p></div>
      </div>
    `).join('');

    const tbody = document.getElementById('mc-table');
    tbody.innerHTML = d.yearlyProjections?.filter((_, i) => i % 5 === 0 || i === d.yearlyProjections.length - 1).map(y => `
      <tr><td>${y.year}</td><td><strong>${y.age}</strong></td>
        <td><span class="badge ${y.phase === 'accumulation' ? 'badge-success' : 'badge-warning'}">${y.phase}</span></td>
        <td>${formatCurrency(y.portfolio)}</td><td>${y.contribution > 0 ? formatCurrency(y.contribution) : '—'}</td>
        <td>${y.withdrawal > 0 ? formatCurrency(y.withdrawal) : '—'}</td></tr>
    `).join('') || '';
  } catch (err) { Toast.show(err.message, 'error'); }
}

// ── Mortgage vs Invest Page ──
async function initMortgageInvest(slug) { calculateMortgage(); }

async function calculateMortgage() {
  const mortgageBalance = validatePositiveNumber(document.getElementById('mi-balance')?.value, 'Mortgage balance');
  if (mortgageBalance === null) return;
  const mortgageRate = validatePositiveNumber(document.getElementById('mi-rate')?.value, 'Mortgage rate');
  if (mortgageRate === null) return;
  const monthlyPayment = validatePositiveNumber(document.getElementById('mi-payment')?.value, 'Monthly payment');
  if (monthlyPayment === null) return;
  const monthlySurplus = validatePositiveNumber(document.getElementById('mi-surplus')?.value, 'Monthly surplus');
  if (monthlySurplus === null) return;
  const expectedReturn = validatePositiveNumber(document.getElementById('mi-return')?.value, 'Expected return');
  if (expectedReturn === null) return;
  const marginalTaxRate = safeParseFloat(document.getElementById('mi-tax')?.value, 0) / 100;
  const years = parseInt(document.getElementById('mi-years')?.value) || 25;
  const investmentType = document.getElementById('mi-type')?.value || 'registered';

  const params = {
    mortgageBalance,
    mortgageRate,
    monthlyPayment,
    monthlySurplus,
    expectedReturn,
    marginalTaxRate,
    years,
    investmentType,
  };

  try {
    const res = await API.post(`/api/families/${Router.familySlug}/tools/mortgage-vs-invest`, params);
    if (!res.success) { Toast.show(res.error, 'error'); return; }
    const d = res.data;
    document.getElementById('mi-results').style.display = 'block';

    const verdict = document.getElementById('mi-verdict');
    const isInvest = d.winner === 'invest';
    verdict.innerHTML = `
      <div style="font-size:2.2rem;margin-bottom:8px">${isInvest ? '🟢' : '🔴'} ${d.recommendation.verdict}</div>
      <p style="font-size:1rem;color:var(--text-light)">Investing wins by $${d.difference.toLocaleString()} after ${d.params.years} years</p>
    `;
    verdict.style.borderLeft = `4px solid ${isInvest ? 'var(--success)' : 'var(--danger)'}`;
    verdict.className = 'card';

    document.getElementById('mi-a-years').textContent = d.scenarioA.yearsToPayoff + ' years';
    document.getElementById('mi-a-interest').textContent = formatCurrency(d.scenarioA.totalInterestSaved);
    document.getElementById('mi-a-equity').textContent = formatCurrency(d.scenarioA.homeEquity);
    document.getElementById('mi-a-net').textContent = formatCurrency(d.scenarioA.netWorth);

    document.getElementById('mi-b-years').textContent = d.scenarioB.yearsToPayoff + ' years';
    document.getElementById('mi-b-interest').textContent = formatCurrency(d.scenarioB.totalInterestPaid);
    document.getElementById('mi-b-equity').textContent = formatCurrency(d.scenarioB.homeEquity);
    document.getElementById('mi-b-invest').textContent = formatCurrency(d.scenarioB.investmentValueAfterTax);
    document.getElementById('mi-b-net').textContent = formatCurrency(d.scenarioB.netWorth);

    document.getElementById('mi-rec').innerHTML = `
      <p><strong>${d.recommendation.summary}</strong></p>
      <p style="margin-top:8px;color:var(--text-light);font-size:0.9rem">${d.recommendation.caveat}</p>
      <p style="margin-top:8px;color:var(--warning);font-size:0.9rem">⚠️ ${d.recommendation.riskNote}</p>
      <div style="background:var(--bg);padding:16px;border-radius:var(--radius-sm);margin-top:12px;font-size:0.9rem;white-space:pre-wrap;line-height:1.6">${d.recommendation.action}</div>
    `;

    document.getElementById('mi-breakeven').innerHTML = `
      For investing to beat prepaying, your investments need to return at least <strong>${d.breakEvenAnalysis.requiredReturnForInvestToWin}%</strong> annually.
      <br>Your mortgage rate is ${d.params.mortgageRate}%. If you can earn more than ${d.breakEvenAnalysis.requiredReturnForInvestToWin}% after-tax consistently, investing wins.
    `;
  } catch (err) { Toast.show(err.message, 'error'); }
}

// ── Retirement Sim Page ──
async function initRetirementSim(slug) { runRetirementSim(); }

async function runRetirementSim() {
  const currentAge = parseInt(document.getElementById('rs-age')?.value) || 38;
  const retirementAge = parseInt(document.getElementById('rs-retire')?.value) || 65;
  const lifespan = parseInt(document.getElementById('rs-life')?.value) || 90;
  const rrspBalanceAtRetirement = validatePositiveNumber(document.getElementById('rs-rrsp')?.value, 'RRSP balance');
  if (rrspBalanceAtRetirement === null) return;
  const tfsaBalanceAtRetirement = validatePositiveNumber(document.getElementById('rs-tfsa')?.value, 'TFSA balance');
  if (tfsaBalanceAtRetirement === null) return;
  const nonRegisteredBalance = validatePositiveNumber(document.getElementById('rs-nonreg')?.value, 'Non-registered balance');
  if (nonRegisteredBalance === null) return;
  const desiredIncome = validatePositiveNumber(document.getElementById('rs-income')?.value, 'Desired income');
  if (desiredIncome === null) return;
  const spouseIncome = validatePositiveNumber(document.getElementById('rs-spouse')?.value, 'Spouse income');
  if (spouseIncome === null) return;
  const cppStartAge = parseInt(document.getElementById('rs-cpp')?.value) || 65;
  const investmentReturn = validatePositiveNumber(document.getElementById('rs-return')?.value, 'Investment return');
  if (investmentReturn === null) return;

  const params = {
    currentAge,
    retirementAge,
    lifespan,
    rrspBalanceAtRetirement,
    tfsaBalanceAtRetirement,
    nonRegisteredBalance,
    desiredIncome,
    spouseIncome,
    cppStartAge,
    investmentReturn,
  };

  try {
    const res = await API.post(`/api/families/${Router.familySlug}/tools/retirement-simulate`, params);
    if (!res.success) { Toast.show(res.error, 'error'); return; }
    const d = res.data;
    document.getElementById('rs-results').style.display = 'block';

    document.getElementById('rs-total-tax').textContent = formatCurrency(d.summary.totalTaxPaid);
    document.getElementById('rs-total-oas').textContent = formatCurrency(d.summary.totalOASReceived);
    document.getElementById('rs-total-gis').textContent = formatCurrency(d.summary.totalGISReceived);
    document.getElementById('rs-total-cpp').textContent = formatCurrency(d.summary.totalCPPReceived);
    document.getElementById('rs-estate').textContent = formatCurrency(d.summary.estateValue);
    document.getElementById('rs-shortfall').textContent = d.summary.yearsWithShortfall;
    document.getElementById('rs-shortfall').className = 'stat-value ' + (d.summary.yearsWithShortfall > 0 ? 'negative' : 'positive');

    document.getElementById('rs-insights').innerHTML = d.keyInsights.map(i => `
      <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);align-items:flex-start">
        <span style="font-size:1.3rem;flex-shrink:0">${i.severity === 'high' ? '⚠️' : i.severity === 'medium' ? '🔍' : i.severity === 'positive' ? '✅' : '💡'}</span>
        <div><strong>${i.title}</strong><p style="color:var(--text-light);font-size:0.9rem;margin-top:4px;line-height:1.5">${i.description}</p>${i.action ? `<span style="color:var(--primary);font-size:0.85rem">→ ${i.action}</span>` : ''}</div>
      </div>
    `).join('');

    const tbody = document.getElementById('rs-table');
    tbody.innerHTML = d.years?.filter((_, i) => i % 5 === 0 || i === d.years.length - 1).map(y => `
      <tr><td><strong>${y.age}</strong></td><td>${formatCurrency(y.targetIncome)}</td><td>${formatCurrency(y.cppReceived)}</td>
        <td>${formatCurrency(y.oasReceived)}</td><td>${formatCurrency(y.rrspWithdrawal)}</td><td>${formatCurrency(y.tfsaWithdrawal)}</td>
        <td>${formatCurrency(y.taxPaid)}</td>
        <td>${y.incomeShortfall > 0 ? `<span class="badge badge-danger">${formatCurrency(y.incomeShortfall)}</span>` : '—'}</td><td>${formatCurrency(y.totalAssets)}</td></tr>
    `).join('') || '';
  } catch (err) { Toast.show(err.message, 'error'); }
}

// ── FHSA Page ──
async function initFHSA(slug) { checkFHSA(); }

async function checkFHSA() {
  const age = parseInt(document.getElementById('fh-age')?.value) || 38;
  const annualIncome = validatePositiveNumber(document.getElementById('fh-income')?.value, 'Annual income');
  if (annualIncome === null) return;
  const firstTimeHomeBuyer = document.getElementById('fh-first')?.value === 'true';
  const spouseOwnedHome = document.getElementById('fh-spouse')?.value === 'true';
  const targetHomePrice = validatePositiveNumber(document.getElementById('fh-home')?.value, 'Target home price');
  if (targetHomePrice === null) return;
  const downPaymentPercent = safeParseFloat(document.getElementById('fh-dp')?.value, 20);
  const yearsToPurchase = parseInt(document.getElementById('fh-years')?.value) || 5;
  const previousFHSABalance = validatePositiveNumber(document.getElementById('fh-existing')?.value, 'Existing FHSA balance');
  if (previousFHSABalance === null) return;

  const params = {
    age,
    annualIncome,
    firstTimeHomeBuyer,
    spouseOwnedHome,
    targetHomePrice,
    downPaymentPercent,
    yearsToPurchase,
    previousFHSABalance,
    province: 'QC',
  };

  try {
    const res = await API.post(`/api/families/${Router.familySlug}/tools/fhsa-check`, params);
    if (!res.success) { Toast.show(res.error, 'error'); return; }
    const d = res.data;
    document.getElementById('fh-results').style.display = 'block';

    const verdict = document.getElementById('fh-verdict');
    if (d.eligible) {
      verdict.innerHTML = `
        <div class="card card-success" style="display:inline-block">
          <div style="color:var(--success);font-size:1.6rem;font-weight:700">✅ ELIGIBLE for FHSA</div>
          <p style="color:var(--text-light);margin-top:6px">You qualify for the First Home Savings Account.</p>
        </div>
      `;
    } else {
      verdict.innerHTML = `
        <div class="card card-danger" style="display:inline-block">
          <div style="color:var(--danger);font-size:1.6rem;font-weight:700">❌ NOT ELIGIBLE</div>
          <p style="color:var(--text-light);margin-top:6px">${d.reasons?.join(', ') || ''}</p>
        </div>
      `;
    }

    document.getElementById('fh-tax-value').textContent = formatCurrency(d.taxBenefit?.taxDeductionValue || 0);
    document.getElementById('fh-target-dp').textContent = formatCurrency(d.purchaseProjection?.targetDownPayment || 0);
    document.getElementById('fh-projected').textContent = formatCurrency(d.purchaseProjection?.fhsaFutureValue || 0);
    document.getElementById('fh-coverage').textContent = d.purchaseProjection?.coversDownPayment
      ? '🎉 Covers full down payment!'
      : `Covers ${Math.round(((d.purchaseProjection?.fhsaFutureValue || 0) / (d.purchaseProjection?.targetDownPayment || 1)) * 100)}% — use RRSP HBP for rest`;
    document.getElementById('fh-coverage').className = d.purchaseProjection?.coversDownPayment ? 'stat-value positive' : 'stat-value warning';

    document.getElementById('fh-table').innerHTML = d.timeline?.map(t => `
      <tr><td>${t.year}</td><td>${formatCurrency(t.contribution)}</td><td>${formatCurrency(t.cumulativeContributions)}</td>
        <td>${formatCurrency(t.projectedBalance)}</td><td>${formatCurrency(t.taxDeduction)}</td><td>${formatCurrency(t.availableForWithdrawal)}</td></tr>
    `).join('') || '';

    document.getElementById('fh-vs').innerHTML = `
      <div class="grid">
        ${d.vsAlternatives ? Object.entries(d.vsAlternatives).map(([key, val]) => `
          <div class="card" style="background:var(--bg)"><strong>${key}</strong>
            <p style="margin-top:8px;color:var(--text-light);font-size:0.9rem;line-height:1.5">${val}</p></div>
        `).join('') : ''}
      </div>
    `;

    document.getElementById('fh-actions').innerHTML = (d.actionItems || []).map(a => `
      <div style="display:flex;gap:12px;padding:8px 0"><span>✅</span><span>${a}</span></div>
    `).join('');
  } catch (err) { Toast.show(err.message, 'error'); }
}
