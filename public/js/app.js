/* ============================================================
   WealthBuilder v3.0 — Wizard + Unified Dashboard
   ============================================================ */

const Toast = {
  container: null,
  init() { this.container = document.getElementById('toast-container'); },
  show(message, type = 'info', duration = 3500) {
    if (!this.container) this.init();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    const icon = document.createElement('span');
    icon.style.fontSize = '1.2rem';
    icon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    const msg = document.createElement('span');
    msg.style.flex = '1';
    msg.textContent = message;
    el.appendChild(icon);
    el.appendChild(msg);
    this.container.appendChild(el);
    setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); }, duration);
  }
};

/* Offline detection */
window.addEventListener('offline', () => Toast.show('You are offline. Changes will sync when connection returns.', 'warning', 5000));
window.addEventListener('online', () => Toast.show('Back online.', 'success', 2000));

function formatCurrency(n) {
  if (n === undefined || n === null || isNaN(n)) return '$0';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(Number(n));
}

function formatNumber(n) { return new Intl.NumberFormat('en-CA').format(Number(n || 0)); }

function parseApiError(err) {
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.data?.error) return err.data.error;
  if (err?.message) return err.message;
  return 'Something went wrong. Please try again.';
}

const Charts = {
  instances: {},
  destroy(id) { if (this.instances[id]) { this.instances[id].destroy(); delete this.instances[id]; } },
  doughnut(id, labels, data, colors) {
    this.destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    this.instances[id] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: isDark ? '#cbd5e1' : '#334155', font: { size: 11 } } } }
      }
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
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } }
        },
        plugins: { legend: { labels: { color: textColor, font: { size: 12 } } } }
      }
    });
  }
};

function appShell() {
  return {
    isAuthenticated: false,
    authTab: 'login',
    auth: { email: '', password: '', name: '', loading: false, errors: {} },
    theme: localStorage.getItem('theme') || 'dark',
    sidebarOpen: false,
    currentPage: 'dashboard',
    familySlug: localStorage.getItem('familySlug') || '',
    userName: '',
    familyName: '',
    showWizard: false,
    wizardStep: 1,
    familyData: null,
    summary: null,
    nextAction: null,
    dashboardSubheadline: 'Loading your personalized insights...',
    isLoading: false,

    wizard: {
      familyName: '',
      province: 'QC',
      members: [{ name: '', age: '', role: 'Primary Income' }],
      accounts: [{ type: '', institution: '', balance: '' }],
      debts: [{ type: '', balance: '', interest_rate: '' }],
      goals: [
        { selected: true, name: 'Emergency Fund', emoji: '🛡️', description: '3-6 months of expenses saved in a safe place', targetPlaceholder: 10000, target_amount: 10000, current_amount: 0, deadline: '' },
        { selected: false, name: 'Buy a Home', emoji: '🏡', description: 'Save for a down payment using FHSA + RRSP', targetPlaceholder: 80000, target_amount: 80000, current_amount: 0, deadline: '' },
        { selected: false, name: 'Retirement', emoji: '👴', description: 'Build a nest egg to retire comfortably', targetPlaceholder: 500000, target_amount: 500000, current_amount: 0, deadline: '' },
        { selected: false, name: "Kids' Education", emoji: '🎓', description: 'RESP with 20% government match', targetPlaceholder: 50000, target_amount: 50000, current_amount: 0, deadline: '' },
        { selected: false, name: 'Pay Off Debt', emoji: '📉', description: 'Become debt-free faster with a clear strategy', targetPlaceholder: 20000, target_amount: 20000, current_amount: 0, deadline: '' },
      ]
    },

    generatedPlan: { netWorth: null, debtFreeDate: '', nextAccount: '', nextAccountReason: '', emergencyTarget: 0, actions: [] },

    /* === Auto-save wizard === */
    saveWizardState() {
      try {
        localStorage.setItem('wizardDraft', JSON.stringify({ wizard: this.wizard, step: this.wizardStep }));
      } catch { /* ignore quota errors */ }
    },
    restoreWizardState() {
      try {
        const draft = localStorage.getItem('wizardDraft');
        if (draft) {
          const parsed = JSON.parse(draft);
          if (parsed.wizard) this.wizard = parsed.wizard;
          if (parsed.step) this.wizardStep = parsed.step;
        }
      } catch { /* ignore parse errors */ }
    },
    clearWizardDraft() {
      localStorage.removeItem('wizardDraft');
    },

    /* === Validation === */
    validateAuth() {
      const errors = {};
      if (!this.auth.email || !this.auth.email.includes('@')) errors.email = 'Valid email required';
      if (!this.auth.password || this.auth.password.length < 6) errors.password = 'Password must be at least 6 characters';
      if (this.authTab === 'register' && !this.auth.name?.trim()) errors.name = 'Name required';
      this.auth.errors = errors;
      return Object.keys(errors).length === 0;
    },
    validateWizardStep(step) {
      const errors = [];
      if (step === 2) {
        if (!this.wizard.familyName.trim()) errors.push('Family name is required');
        if (!this.wizard.members.some(m => m.name.trim())) errors.push('At least one member name is required');
      }
      if (step === 3) {
        if (!this.wizard.accounts.some(a => a.type.trim())) errors.push('Add at least one account');
      }
      if (step === 4) {
        if (!this.wizard.goals.some(g => g.selected)) errors.push('Select at least one goal');
      }
      return errors;
    },

    async initApp() {
      this.restoreWizardState();
      try {
        const me = await API.get('/api/auth/me');
        this.isAuthenticated = true;
        this.userName = me.data?.name || '';
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-shell').style.display = '';

        if (this.familySlug) {
          await this.loadFamily();
          if (this.familyData) {
            this.showWizard = false;
            this.loadDashboard();
          } else {
            this.familySlug = '';
            localStorage.removeItem('familySlug');
            this.showWizard = true;
          }
        } else {
          const families = await API.get('/api/families');
          if (families.data && families.data.length > 0) {
            this.familySlug = families.data[0].slug;
            localStorage.setItem('familySlug', this.familySlug);
            await this.loadFamily();
            this.showWizard = false;
            this.loadDashboard();
          } else {
            this.showWizard = true;
          }
        }
      } catch {
        this.isAuthenticated = false;
        document.getElementById('auth-screen').style.display = '';
        document.getElementById('app-shell').style.display = 'none';
      }
    },

    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', this.theme);
      localStorage.setItem('theme', this.theme);
    },

    async login() {
      if (!this.validateAuth()) return;
      this.auth.loading = true;
      try {
        const res = await API.post('/api/auth/login', { email: this.auth.email, password: this.auth.password });
        this.isAuthenticated = true;
        this.userName = res.data?.name || '';
        this.clearWizardDraft();
        await this.initApp();
      } catch (err) {
        Toast.show(parseApiError(err) || 'Login failed', 'error');
      } finally { this.auth.loading = false; }
    },

    async register() {
      if (!this.validateAuth()) return;
      this.auth.loading = true;
      try {
        await API.post('/api/auth/register', { email: this.auth.email, password: this.auth.password, name: this.auth.name });
        Toast.show('Account created! Please sign in.', 'success');
        this.authTab = 'login';
        this.auth.password = '';
      } catch (err) {
        Toast.show(parseApiError(err) || 'Registration failed', 'error');
      } finally { this.auth.loading = false; }
    },

    logout() {
      API.post('/api/auth/logout', {});
      this.isAuthenticated = false;
      this.familySlug = '';
      localStorage.removeItem('familySlug');
      window.location.reload();
    },

    nextStep() {
      const errors = this.validateWizardStep(this.wizardStep);
      if (errors.length) {
        Toast.show(errors[0], 'error');
        return;
      }
      if (this.wizardStep < 5) {
        this.wizardStep++;
        this.saveWizardState();
      }
    },
    prevStep() {
      if (this.wizardStep > 1) {
        this.wizardStep--;
        this.saveWizardState();
      }
    },

    async saveFamily() {
      this.isLoading = true;
      try {
        const slug = this.wizard.familyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const res = await API.post('/api/families', { name: this.wizard.familyName, slug, location: this.wizard.province, tax_situation: '' });
        this.familySlug = res.data.slug;
        localStorage.setItem('familySlug', this.familySlug);
        this.familyName = this.wizard.familyName;

        for (const m of this.wizard.members) {
          if (m.name.trim()) await API.post(`/api/families/${this.familySlug}/members`, { name: m.name.trim(), role: m.role, age: Number(m.age) || 0 });
        }
        Toast.show('Family created!', 'success');
        this.nextStep();
      } catch (err) { Toast.show(parseApiError(err) || 'Failed to save family', 'error'); }
      finally { this.isLoading = false; }
    },

    async saveSnapshot() {
      this.isLoading = true;
      try {
        for (const a of this.wizard.accounts) {
          if (a.type.trim() && a.balance !== '') await API.post(`/api/families/${this.familySlug}/accounts`, { type: a.type.trim(), institution: a.institution?.trim() || '', balance: Number(a.balance) || 0 });
        }
        for (const d of this.wizard.debts) {
          if (d.type.trim() && d.balance !== '') await API.post(`/api/families/${this.familySlug}/debts`, { type: d.type.trim(), balance: Number(d.balance) || 0, interest_rate: Number(d.interest_rate) || 0 });
        }
        Toast.show('Snapshot saved!', 'success');
        this.nextStep();
      } catch (err) { Toast.show(parseApiError(err) || 'Failed to save snapshot', 'error'); }
      finally { this.isLoading = false; }
    },

    async saveGoals() {
      this.isLoading = true;
      try {
        const selected = this.wizard.goals.filter(g => g.selected);
        for (const g of selected) {
          if (g.target_amount) {
            await API.post(`/api/families/${this.familySlug}/goals`, {
              description: g.name,
              timeframe: g.deadline ? 'medium' : 'long',
              target_amount: Number(g.target_amount) || 0,
              current_amount: Number(g.current_amount) || 0,
              deadline: g.deadline || null,
              status: 'Not Started',
              priority: 1,
            });
          }
        }
        await this.generatePlanData();
        Toast.show('Plan generated!', 'success');
        this.nextStep();
      } catch (err) { Toast.show(parseApiError(err) || 'Failed to save goals', 'error'); }
      finally { this.isLoading = false; }
    },

    async generatePlanData() {
      await this.loadFamily();
      const assets = this.familyData.accounts?.reduce((s, a) => s + (a.balance || 0), 0) || 0;
      const liabilities = this.familyData.debts?.reduce((s, d) => s + (d.balance || 0), 0) || 0;
      const netWorth = assets - liabilities;

      let debtFreeDate = '';
      try {
        const debts = (this.familyData.debts || []).map(d => ({ name: d.type, balance: d.balance, interestRate: d.interest_rate || 0, monthlyPayment: (d.interest_rate || 0) * d.balance / 100 / 12 + d.balance / 120 }));
        if (debts.length) {
          const strategy = await API.post('/api/families/' + this.familySlug + '/tools/debt-strategy', { debts });
          if (strategy.data?.avalanche?.payoffDate) debtFreeDate = strategy.data.avalanche.payoffDate;
        }
      } catch { /* ignore */ }

      let nextAccount = 'TFSA';
      let nextAccountReason = 'Start with your TFSA for tax-free growth';
      try {
        const primary = this.familyData.members?.find(m => m.role === 'Primary Income');
        const age = primary?.age || 35;
        const strat = await API.post('/api/families/' + this.familySlug + '/tax/strategy', { income: 70000, age, num_children: (this.familyData.members || []).filter(m => m.role === 'Child').length });
        if (strat.data?.strategy?.[0]) {
          nextAccount = strat.data.strategy[0].account;
          nextAccountReason = strat.data.strategy[0].reason;
        }
      } catch { /* ignore */ }

      this.generatedPlan = {
        netWorth,
        debtFreeDate,
        nextAccount,
        nextAccountReason,
        emergencyTarget: Math.round(assets * 0.15),
        actions: [
          `Open or contribute to your ${nextAccount} — ${nextAccountReason}`,
          'Set up automatic monthly transfers on payday',
          debtFreeDate ? `You could be debt-free by ${debtFreeDate}` : 'Review your monthly budget to find savings',
          'Update your financial snapshot once per month',
          netWorth < 0 ? 'Focus on highest-interest debt first' : 'Consider increasing retirement contributions',
        ]
      };
    },

    async loadFamily() {
      if (!this.familySlug) return;
      try {
        this.familyData = await API.get(`/api/families/${this.familySlug}`);
        this.familyName = this.familyData.data?.name || '';
        this.familyData = this.familyData.data;
      } catch { this.familyData = null; }
    },

    async loadDashboard() {
      if (!this.familySlug) return;
      try {
        const sum = await API.get(`/api/families/${this.familySlug}/summary`);
        this.summary = sum.data;
      } catch { this.summary = null; }

      await this.loadFamily();
      this.computeNextAction();
      this.renderCharts();
      if (this.summary) {
        const rate = this.summary.savingsRate ?? 0;
        if (rate < 0) this.dashboardSubheadline = 'Your expenses are above income — let\'s find savings.';
        else if (rate < 10) this.dashboardSubheadline = 'Small increase in savings rate can compound dramatically.';
        else if (rate < 25) this.dashboardSubheadline = 'You\'re building wealth. Keep optimizing tax-advantaged accounts.';
        else this.dashboardSubheadline = 'Excellent savings rate! You\'re on a fast track to financial freedom.';
      }
    },

    computeNextAction() {
      const actions = [];
      const members = this.familyData?.members || [];
      const accounts = this.familyData?.accounts || [];
      const debts = this.familyData?.debts || [];
      const goals = this.familyData?.goals || [];
      const hasEmergency = accounts.some(a => a.type === 'Emergency Fund' || a.type === 'Checking' || a.type === 'Savings');
      const emergencyBalance = accounts.filter(a => ['Emergency Fund','Checking','Savings'].includes(a.type)).reduce((s, a) => s + (a.balance || 0), 0);
      const monthlyIncome = this.summary?.totalIncome || 0;
      const targetEmergency = monthlyIncome * 3;

      if (!hasEmergency || emergencyBalance < targetEmergency) {
        actions.push({ title: 'Build your emergency fund', description: `Aim for ${formatCurrency(targetEmergency)} (3 months income). Start with $500 this month.`, cta: 'Add account', action: () => this.openAddAccount() });
      }
      if (debts.some(d => (d.interest_rate || 0) > 10)) {
        actions.push({ title: 'Attack high-interest debt', description: 'You have debt over 10% — paying this off is your highest guaranteed return.', cta: 'View debt strategy', action: () => this.openDebtStrategy() });
      }
      if (members.some(m => m.role === 'Child') && !accounts.some(a => a.type === 'RESP')) {
        actions.push({ title: 'Open an RESP', description: 'Government matches 20% of your contributions. Free money for your kids.', cta: 'Add RESP', action: () => this.openAddAccount() });
      }
      if (!accounts.some(a => a.type === 'TFSA')) {
        actions.push({ title: 'Start your TFSA', description: 'Tax-free growth forever. The #1 account for most Canadians.', cta: 'Add TFSA', action: () => this.openAddAccount() });
      }
      if (goals.length === 0) {
        actions.push({ title: 'Set your first goal', description: 'Goals drive behavior. Set a realistic target and watch progress.', cta: 'Add goal', action: () => this.go('plan') });
      }
      if (actions.length === 0) {
        actions.push({ title: 'Optimize your portfolio', description: 'Review if you\'re maximizing RRSP vs TFSA based on your marginal tax rate.', cta: 'Tax planner', action: () => this.openTaxCalc() });
      }
      this.nextAction = actions[0];
    },

    renderCharts() {
      setTimeout(() => {
        if (this.summary) {
          Charts.doughnut('networthChart', ['Assets', 'Debts'], [this.summary.assets || 0, this.summary.liabilities || 0], ['#22c55e', '#ef4444']);
        }
        if (this.summary) {
          Charts.bar('cashflowChart', ['Income', 'Expenses', 'Saved'], [
            { label: 'Amount', data: [this.summary.totalIncome || 0, this.summary.totalExpenses || 0, Math.max(0, (this.summary.totalIncome || 0) - (this.summary.totalExpenses || 0))], backgroundColor: ['#22c55e', '#ef4444', '#3b82f6'] }
          ]);
        }
      }, 200);
    },

    go(page) {
      this.currentPage = page;
      if (page === 'dashboard') this.loadDashboard();
      if (page === 'plan') this.loadFamily();
      window.location.hash = `/${page}`;
      this.sidebarOpen = false;
    },

    showToolModal: false,
    toolModalTitle: '',
    toolModalInputs: [],
    toolModalRun: null,
    toolModalResult: null,

    closeToolModal() {
      this.showToolModal = false;
      this.toolModalTitle = '';
      this.toolModalInputs = [];
      this.toolModalRun = null;
      this.toolModalResult = null;
      if (this._modalKeyHandler) {
        document.removeEventListener('keydown', this._modalKeyHandler);
        this._modalKeyHandler = null;
      }
    },

    openToolModal(title, inputs, runner) {
      this.toolModalTitle = title;
      this.toolModalInputs = inputs.map(i => ({ ...i, value: i.default ?? '' }));
      this.toolModalRun = runner;
      this.toolModalResult = null;
      this.showToolModal = true;
      setTimeout(() => {
        const el = document.querySelector('.modal input, .modal button[type="submit"]');
        if (el) el.focus();
      }, 50);
      this._modalKeyHandler = (e) => {
        if (e.key === 'Escape') this.closeToolModal();
      };
      document.addEventListener('keydown', this._modalKeyHandler);
    },

    async submitToolModal() {
      this.isLoading = true;
      const body = {};
      for (const input of this.toolModalInputs) {
        if (input.type === 'number') body[input.key] = Number(input.value) || 0;
        else if (input.type === 'checkbox') body[input.key] = Boolean(input.value);
        else body[input.key] = input.value;
      }
      try {
        const res = await this.toolModalRun(body);
        this.toolModalResult = res.data;
      } catch (err) { Toast.show(parseApiError(err) || 'Tool failed', 'error'); }
      finally { this.isLoading = false; }
    },

    async openAddAccount() {
      this.openToolModal('Add Account', [
        { key: 'type', label: 'Account Type', type: 'text', default: 'TFSA' },
        { key: 'institution', label: 'Institution', type: 'text', default: '' },
        { key: 'balance', label: 'Current Balance', type: 'number', default: 0 }
      ], async (body) => {
        await API.post(`/api/families/${this.familySlug}/accounts`, body);
        Toast.show('Account added', 'success');
        this.loadDashboard();
        return { data: { success: true } };
      });
    },

    async openAddDebt() {
      this.openToolModal('Add Debt', [
        { key: 'type', label: 'Debt Type', type: 'text', default: 'Credit Card' },
        { key: 'balance', label: 'Balance Owed', type: 'number', default: 0 },
        { key: 'interest_rate', label: 'Interest Rate %', type: 'number', default: 0 }
      ], async (body) => {
        await API.post(`/api/families/${this.familySlug}/debts`, body);
        Toast.show('Debt added', 'success');
        this.loadDashboard();
        return { data: { success: true } };
      });
    },

    async updateGoal(g) {
      this.isLoading = true;
      try {
        await API.put(`/api/families/${this.familySlug}/goals/${g.id}`, { description: g.description, target_amount: Number(g.target_amount) || 0, current_amount: Number(g.current_amount) || 0 });
        Toast.show('Goal updated', 'success');
        this.loadFamily();
      } catch (err) { Toast.show(parseApiError(err) || 'Failed to update goal', 'error'); }
      finally { this.isLoading = false; }
    },

    finishWizard() {
      this.showWizard = false;
      this.clearWizardDraft();
      this.go('dashboard');
    },

    /* Tool Modals */
    openTaxCalc() {
      this.toolModalResult = null;
      this.openToolModal('Tax Breakdown', [
        { key: 'income', label: 'Annual Income', type: 'number', default: 70000 },
        { key: 'rrsp_contribution', label: 'RRSP Contribution', type: 'number', default: 0 }
      ], async (body) => {
        const res = await API.post(`/api/families/${this.familySlug}/tax/calculate`, body);
        return res;
      });
    },
    openRetirementCalc() {
      this.toolModalResult = null;
      this.openToolModal('Retirement Simulation', [
        { key: 'currentAge', label: 'Current Age', type: 'number', default: 35 },
        { key: 'desiredRetirementAge', label: 'Retirement Age', type: 'number', default: 65 },
        { key: 'currentSavings', label: 'Current Savings', type: 'number', default: 50000 },
        { key: 'monthlyContribution', label: 'Monthly Contribution', type: 'number', default: 500 },
        { key: 'expectedReturn', label: 'Expected Return %', type: 'number', default: 7 }
      ], async (body) => {
        const res = await API.post(`/api/families/${this.familySlug}/tools/retirement-simulate`, body);
        return res;
      });
    },
    openMortgageCalc() {
      this.toolModalResult = null;
      this.openToolModal('Mortgage vs Invest', [
        { key: 'mortgageAmount', label: 'Mortgage Balance', type: 'number', default: 300000 },
        { key: 'interestRate', label: 'Interest Rate %', type: 'number', default: 4.5 },
        { key: 'amortizationYears', label: 'Amortization Years', type: 'number', default: 25 },
        { key: 'monthlyPayment', label: 'Monthly Payment', type: 'number', default: 1500 },
        { key: 'monthlySurplus', label: 'Monthly Surplus', type: 'number', default: 1000 },
        { key: 'expectedReturn', label: 'Expected Return %', type: 'number', default: 7 },
        { key: 'marginalTaxRate', label: 'Marginal Tax Rate', type: 'number', default: 0.33 }
      ], async (body) => {
        const res = await API.post(`/api/families/${this.familySlug}/tools/mortgage-vs-invest`, body);
        return res;
      });
    },
    openFHSA() {
      this.toolModalResult = null;
      this.openToolModal('FHSA Eligibility', [
        { key: 'income', label: 'Annual Income', type: 'number', default: 70000 },
        { key: 'age', label: 'Your Age', type: 'number', default: 30 },
        { key: 'firstTimeBuyer', label: 'First-time Home Buyer', type: 'checkbox', default: true }
      ], async (body) => {
        const res = await API.post(`/api/families/${this.familySlug}/tools/fhsa-check`, body);
        return res;
      });
    },
    openMonteCarlo() {
      this.toolModalResult = null;
      this.openToolModal('Monte Carlo Projection', [
        { key: 'initialAmount', label: 'Current Portfolio', type: 'number', default: 100000 },
        { key: 'monthlyContribution', label: 'Monthly Contribution', type: 'number', default: 1000 },
        { key: 'years', label: 'Years', type: 'number', default: 27 },
        { key: 'expectedReturn', label: 'Expected Return %', type: 'number', default: 7 }
      ], async (body) => {
        const res = await API.post(`/api/families/${this.familySlug}/tools/monte-carlo`, body);
        return res;
      });
    },
    openDebtStrategy() {
      const debts = (this.familyData?.debts || []).map(d => ({ name: d.type, balance: d.balance, interestRate: d.interest_rate || 0, monthlyPayment: Math.round(d.balance / 120) }));
      if (!debts.length) { Toast.show('No debts on file. Add debts first.', 'warning'); return; }
      this.toolModalResult = null;
      this.openToolModal('Debt Strategy', [], async () => {
        const res = await API.post(`/api/families/${this.familySlug}/tools/debt-strategy`, { debts });
        return res;
      });
    },
    async runTool(url, body, title) {
      try {
        const res = await API.post(url, body);
        this.toolModalResult = res.data;
      } catch (err) { Toast.show(err.message || 'Tool failed', 'error'); }
    }
  };
}

/* Minimal Router */
window.addEventListener('hashchange', () => {
  const page = window.location.hash.replace('#/', '') || 'dashboard';
  if (window.__appState) window.__appState.currentPage = page;
});
