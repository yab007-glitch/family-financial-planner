const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../planner.db');
const db = new sqlite3.Database(dbPath);

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function seed() {
  console.log('🌱 Seeding Bheekun family data...');

  // Check if family already exists
  let familyRow = await get('SELECT id FROM families WHERE slug = ?', ['bheekun']);
  let familyId;

  if (familyRow) {
    console.log('📝 Family already exists, updating...');
    familyId = familyRow.id;
    // Clear existing data for this family to avoid duplicates
    await run('DELETE FROM members WHERE family_id = ?', [familyId]);
    await run('DELETE FROM accounts WHERE family_id = ?', [familyId]);
    await run('DELETE FROM debts WHERE family_id = ?', [familyId]);
    await run('DELETE FROM insurance WHERE family_id = ?', [familyId]);
    await run('DELETE FROM goals WHERE family_id = ?', [familyId]);
    await run('DELETE FROM action_items WHERE family_id = ?', [familyId]);
    await run('DELETE FROM milestones WHERE family_id = ?', [familyId]);
    await run('UPDATE families SET name=?, location=?, tax_situation=? WHERE id=?',
      ['Bheekun Family', 'Salaberry-de-Valleyfield, QC', 'Quebec resident (53.31% marginal tax rate)', familyId]);
  } else {
    // Create Family
    const familyResult = await run(
      'INSERT INTO families (name, slug, location, tax_situation) VALUES (?, ?, ?, ?)',
      ['Bheekun Family', 'bheekun', 'Salaberry-de-Valleyfield, QC', 'Quebec resident (53.31% marginal tax rate)']
    );
    familyId = familyResult.lastID;
  }

  console.log(`📊 Family ID: ${familyId}`);

  // Members
  await run('INSERT INTO members (family_id, name, role, age, notes) VALUES (?, ?, ?, ?, ?)',
    [familyId, 'Yasser Altaf Bheekun', 'Primary Income', 38, 'MLT at MUHC, OPTMQ #160034, CSMLS certified']);
  await run('INSERT INTO members (family_id, name, role, age, notes) VALUES (?, ?, ?, ?, ?)',
    [familyId, 'Wife', 'Secondary Income', null, 'To be updated']);
  await run('INSERT INTO members (family_id, name, role, age, notes) VALUES (?, ?, ?, ?, ?)',
    [familyId, 'Kids', 'Dependents', null, 'Number and ages to be updated']);

  // Accounts
  await run('INSERT INTO accounts (family_id, type, institution, balance, contribution_room, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [familyId, 'TFSA', 'Not yet opened', 0, '$0 / $78,000', '11 years accumulated room (2015-2026)']);
  await run('INSERT INTO accounts (family_id, type, institution, balance, contribution_room, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [familyId, 'RRSP', 'Not yet opened', 0, '$0 / ~$100-130K', 'Based on Canadian income since 2015']);
  await run('INSERT INTO accounts (family_id, type, institution, balance, contribution_room, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [familyId, 'Emergency Fund', 'Not yet opened', 0, 'N/A', 'Target: $25,000']);

  // Debts
  await run('INSERT INTO debts (family_id, type, balance, interest_rate, monthly_payment, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [familyId, 'Mortgage', 0, null, null, 'Has mortgage life insurance']);
  await run('INSERT INTO debts (family_id, type, balance, interest_rate, monthly_payment, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [familyId, 'Car Loan', 0, null, null, 'Needs to be updated']);
  await run('INSERT INTO debts (family_id, type, balance, interest_rate, monthly_payment, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [familyId, 'Credit Cards', 0, null, null, 'Needs to be updated']);

  // Insurance
  await run('INSERT INTO insurance (family_id, type, provider, coverage, premium, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [familyId, 'Mortgage Life Insurance', 'Mortgage lender', 'Pays off mortgage', 'Included in mortgage', 'Active', '✅ Active']);
  await run('INSERT INTO insurance (family_id, type, provider, coverage, premium, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [familyId, 'Term Life (Personal)', 'None yet', '$0', '$0', 'Gap identified', '⚠️ Gap identified']);
  await run('INSERT INTO insurance (family_id, type, provider, coverage, premium, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [familyId, 'Critical Illness', 'None yet', '$0', '$0', 'Gap identified', '⚠️ Consider self-insuring']);
  await run('INSERT INTO insurance (family_id, type, provider, coverage, premium, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [familyId, 'Disability', 'MUHC (check benefits)', '?', '?', 'Pending', '🔍 Needs verification']);

  // Goals
  await run('INSERT INTO goals (family_id, timeframe, priority, description, target_amount, current_amount, deadline, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [familyId, 'Short-Term', 1, 'Emergency Fund', 10000, 0, '2026-07-01', 'Not Started']);
  await run('INSERT INTO goals (family_id, timeframe, priority, description, target_amount, current_amount, deadline, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [familyId, 'Short-Term', 2, 'Open TFSA', 15000, 0, '2027-01-01', 'Not Started']);
  await run('INSERT INTO goals (family_id, timeframe, priority, description, target_amount, current_amount, deadline, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [familyId, 'Short-Term', 3, 'Open RRSP', 10000, 0, '2027-01-01', 'Not Started']);
  await run('INSERT INTO goals (family_id, timeframe, priority, description, target_amount, current_amount, deadline, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [familyId, 'Long-Term', 1, 'Retirement savings (TFSA)', 500000, 0, null, 'Not Started']);
  await run('INSERT INTO goals (family_id, timeframe, priority, description, target_amount, current_amount, deadline, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [familyId, 'Long-Term', 2, 'Retirement savings (RRSP)', 500000, 0, null, 'Not Started']);

  // Action Items
  await run('INSERT INTO action_items (family_id, phase, description, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [familyId, 'Week 1: Foundation', 'Register for CRA My Account', 'Pending', null, 'https://www.canada.ca/en/revenue-agency/services/e-services/e-services-individuals/account-individuals.html']);
  await run('INSERT INTO action_items (family_id, phase, description, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [familyId, 'Week 1: Foundation', 'Verify TFSA contribution room', 'Pending', null, 'Expected: ~$78,000']);
  await run('INSERT INTO action_items (family_id, phase, description, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [familyId, 'Week 1: Foundation', 'Verify RRSP deduction limit', 'Pending', null, 'Expected: ~$100-130K']);
  await run('INSERT INTO action_items (family_id, phase, description, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [familyId, 'Week 1: Foundation', 'Review MUHC employee benefits', 'Pending', null, 'Check insurance coverage']);
  await run('INSERT INTO action_items (family_id, phase, description, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [familyId, 'Week 2: Account Setup', 'Open Wealthsimple Trade account', 'Pending', null, 'TFSA + RRSP']);
  await run('INSERT INTO action_items (family_id, phase, description, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [familyId, 'Week 2: Account Setup', 'Open EQ Bank savings account', 'Pending', null, 'Emergency fund']);
  await run('INSERT INTO action_items (family_id, phase, description, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [familyId, 'Month 1: Initial Funding', 'Fund emergency fund: $5,000-10,000', 'Pending', null, 'EQ Bank']);
  await run('INSERT INTO action_items (family_id, phase, description, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [familyId, 'Month 1: Initial Funding', 'Fund TFSA: $5,000-15,000', 'Pending', null, 'Buy XEQT']);
  await run('INSERT INTO action_items (family_id, phase, description, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [familyId, 'Month 1: Initial Funding', 'Fund RRSP: $5,000-10,000', 'Pending', null, 'Buy XEQT']);

  // Milestones
  await run('INSERT INTO milestones (family_id, name, target_date, status, celebration_plan) VALUES (?, ?, ?, ?, ?)',
    [familyId, 'Emergency Fund: $10,000', '2026-07-01', 'Not Started', 'Family dinner']);
  await run('INSERT INTO milestones (family_id, name, target_date, status, celebration_plan) VALUES (?, ?, ?, ?, ?)',
    [familyId, 'TFSA: $78,000 maxed', '2033-01-01', 'Not Started', 'Vacation']);
  await run('INSERT INTO milestones (family_id, name, target_date, status, celebration_plan) VALUES (?, ?, ?, ?, ?)',
    [familyId, 'RRSP: $100,000', '2036-01-01', 'Not Started', 'Nice dinner']);

  console.log('✅ Bheekun family seeded successfully!');
  db.close();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  db.close();
  process.exit(1);
});
