/**
 * Enhanced Dashboard with Smart Wealth Recommendations
 */
async function initDashboard(slug) {
  try {
    const [family, summary] = await Promise.all([
      API.get(`/api/families/${slug}`),
      API.get(`/api/families/${slug}/summary`)
    ]);

    if (!family.success) throw new Error(family.error);

    // Update header info
    document.getElementById('family-name').textContent = family.data.name || slug;
    document.getElementById('dash-name').textContent = family.data.name || slug;
    document.getElementById('dash-location').textContent = family.data.location || 'Not set';
    document.getElementById('dash-tax').textContent = family.data.tax_situation || 'Not set';

    // Financial summary
    const netWorthEl = document.getElementById('dash-net-worth');
    netWorthEl.textContent = formatCurrency(summary.data.netWorth);
    netWorthEl.className = 'stat-value ' + (summary.data.netWorth >= 0 ? 'positive' : 'negative');
    document.getElementById('dash-assets').textContent = formatCurrency(summary.data.assets);
    document.getElementById('dash-liabilities').textContent = formatCurrency(summary.data.liabilities);
    document.getElementById('dash-income').textContent = formatCurrency(summary.data.totalIncome);
    document.getElementById('dash-expenses').textContent = formatCurrency(summary.data.totalExpenses);
    document.getElementById('dash-savings-rate').textContent = summary.data.savingsRate + '%';

    // Goals with progress bars
    const goalsGrid = document.getElementById('dash-goals');
    if (family.data.goals?.length) {
      goalsGrid.innerHTML = family.data.goals.slice(0, 3).map(g => {
        const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
        return `
          <div class="card">
            <div class="stat-label">${g.description}</div>
            <div class="stat-value">${formatCurrency(g.current_amount)} <span style="font-size:0.7rem;color:var(--text-light)">/ ${formatCurrency(g.target_amount)}</span></div>
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          </div>
        `;
      }).join('');
    } else {
      goalsGrid.innerHTML = '<div class="empty-state"><p>No goals yet</p></div>';
    }

    // Action items
    const actionsList = document.getElementById('dash-actions');
    if (family.data.actions?.length) {
      actionsList.innerHTML = family.data.actions.slice(0, 5).map(a => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
          <span>${a.description}</span>
          ${statusBadge(a.status)}
        </div>
      `).join('');
    } else {
      actionsList.innerHTML = '<div class="empty-state"><p>No action items</p></div>';
    }

    // Smart Recommendations (NEW)
    await loadSmartRecommendations(family.data, summary.data);

    // Dashboard Charts
    renderAssetChart(family.data);
    renderBudgetChart(family.data);

  } catch (err) {
    Loading.error('page-content', `Error loading dashboard: ${err.message}`);
  }
}

function renderAssetChart(family) {
  const canvas = document.getElementById('chart-assets');
  if (!canvas || typeof Chart === 'undefined') return;

  const accounts = family.accounts || [];
  if (accounts.length === 0) {
    canvas.parentElement.innerHTML = '<div class="empty-state"><p>No accounts yet</p></div>';
    return;
  }

  const labels = accounts.map(a => a.type);
  const data = accounts.map(a => Math.max(0, a.balance || 0));
  const colors = ['#2563eb', '#16a34a', '#ca8a04', '#dc2626', '#7c3aed', '#0891b2', '#c026d3'];

  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, data.length),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}` } }
      }
    }
  });
}

function renderBudgetChart(family) {
  const canvas = document.getElementById('chart-budget');
  if (!canvas || typeof Chart === 'undefined') return;

  const entries = family.budget || [];
  const incomeEntries = entries.filter(e => e.type === 'income');
  const expenseEntries = entries.filter(e => e.type === 'expense');

  if (incomeEntries.length === 0 && expenseEntries.length === 0) {
    canvas.parentElement.innerHTML = '<div class="empty-state"><p>Add budget entries to see chart</p></div>';
    return;
  }

  // Group expenses by category
  const expenseByCategory = {};
  expenseEntries.forEach(e => {
    const cat = e.category || 'Other';
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (e.amount || 0);
  });

  const totalIncome = incomeEntries.reduce((s, e) => s + (e.amount || 0), 0);
  const labels = ['Income', ...Object.keys(expenseByCategory)];
  const data = [totalIncome, ...Object.values(expenseByCategory)];
  const colors = ['#16a34a', ...generateBarColors(Object.keys(expenseByCategory).length)];

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderRadius: 6,
        maxBarThickness: 40
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.raw) } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: (v) => '$' + v.toLocaleString() } },
        x: { ticks: { font: { size: 11 } } }
      }
    }
  });
}

function generateBarColors(count) {
  const palette = ['#dc2626', '#ea580c', '#d97706', '#65a30d', '#059669', '#0891b2', '#7c3aed', '#c026d3'];
  return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
}

async function loadSmartRecommendations(family, summary) {
  const recContainer = document.getElementById('smart-recommendations');
  if (!recContainer) return;

  const recommendations = [];

  // Check for missing income data
  const hasBudget = summary.totalIncome > 0;
  if (!hasBudget) {
    recommendations.push({
      urgency: 'high',
      icon: '⚠️',
      title: 'Complete Your Budget',
      description: 'Add income and expenses to calculate your savings rate and net worth accurately.',
      action: 'Go to Budget',
      link: '#/budget'
    });
  }

  // Check for zero TFSA/RRSP contributions
  const tfsa = family.accounts?.find(a => a.type === 'TFSA');
  const rrsp = family.accounts?.find(a => a.type === 'RRSP');

  if (tfsa && tfsa.balance === 0) {
    recommendations.push({
      urgency: 'high',
      icon: '🎯',
      title: 'Open TFSA — $78,000 Room Available',
      description: 'You have 11 years of accumulated TFSA room since arriving in Canada (2015). Tax-free growth forever.',
      action: 'Go to Tax Planner',
      link: '#/tax-planner'
    });
  }

  if (rrsp && rrsp.balance === 0) {
    recommendations.push({
      urgency: 'high',
      icon: '💰',
      title: 'Open RRSP — Estimated $100-130K Room',
      description: `At your income level, every $1,000 RRSP contribution could generate a ~$${Math.round((summary.totalIncome || 80000) * 0.33)} tax refund.`,
      action: 'Go to Tax Planner',
      link: '#/tax-planner'
    });
  }

  // Check emergency fund
  const ef = family.accounts?.find(a => a.type === 'Emergency Fund');
  if (ef && ef.balance < 10000) {
    recommendations.push({
      urgency: 'high',
      icon: '🛡️',
      title: 'Build Emergency Fund First',
      description: 'Target: $10,000-25,000 (3-6 months expenses). Priority before investing.',
      action: 'Add Account',
      link: '#/finances'
    });
  }

  // Insurance gap
  const termLife = family.insurance?.find(i => i.type === 'Term Life (Personal)');
  if (termLife && termLife.status === 'Gap identified') {
    recommendations.push({
      urgency: 'medium',
      icon: '🔍',
      title: 'Review Term Life Insurance Gap',
      description: 'You declined the iA policy. Revisit after emergency fund is built — or self-insure via TFSA.',
      action: 'View Insurance',
      link: '#/insurance'
    });
  }

  // RESP (if kids exist)
  const kids = family.members?.find(m => m.role === 'Dependents');
  if (kids) {
    recommendations.push({
      urgency: 'high',
      icon: '🎓',
      title: 'Start RESP for Kids — Free 20% CESG',
      description: 'Contribute $2,500/child/year = $500 free government money per child. Max lifetime grant: $7,200/child.',
      action: 'Tax Planner → RESP',
      link: '#/tax-planner'
    });
  }

  // Render recommendations
  if (recommendations.length > 0) {
    recContainer.innerHTML = `
      <div class="card" style="border-left:4px solid var(--primary)">
        <h2>💡 Smart Recommendations</h2>
        <div style="margin-top:16px">
          ${recommendations.map(r => `
            <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);align-items:flex-start">
              <span style="font-size:1.5rem">${r.icon}</span>
              <div style="flex:1">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <strong>${r.title}</strong>
                  ${r.urgency === 'high' ? '<span class="badge badge-danger">URGENT</span>' : '<span class="badge badge-warning">Consider</span>'}
                </div>
                <p style="margin-top:4px;color:var(--text-light);font-size:0.9rem">${r.description}</p>
                <a href="${r.link}" style="display:inline-block;margin-top:8px;color:var(--primary);font-weight:500;font-size:0.85rem" onclick="Router.go('${r.link.replace('#/', '')}')">${r.action} →</a>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    recContainer.innerHTML = `
      <div class="card" style="border-left:4px solid var(--success)">
        <h2>✅ All Systems Go</h2>
        <p style="color:var(--text-light)">Your financial foundation looks solid. Keep contributing and review quarterly.</p>
      </div>
    `;
  }
}
