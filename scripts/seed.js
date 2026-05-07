const BetterSqlite3 = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../planner.db');
const db = new BetterSqlite3(dbPath);

const BCRYPT_ROUNDS = 12;

// Use environment variables for credentials
const SEED_EMAIL = process.env.SEED_EMAIL || 'user@example.com';
const SEED_PASSWORD = process.env.SEED_PASSWORD || 'Password123!';
const SEED_NAME = process.env.SEED_NAME || 'Generic User';

if (!process.env.SEED_EMAIL || !process.env.SEED_PASSWORD) {
  console.warn('⚠️  Using default seed credentials. Set SEED_EMAIL and SEED_PASSWORD environment variables for production.');
}

async function seed() {
  console.log('🌱 Seeding sample financial data...');

  try {
    // 1. Create user
    let user = db.prepare('SELECT id FROM users WHERE email = ?').get(SEED_EMAIL);
    let userId;
    
    if (!user) {
      const hash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);
      const result = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
        .run(SEED_EMAIL, hash, SEED_NAME);
      userId = result.lastInsertRowid;
      console.log(`✅ User created (ID: ${userId}) — login: ${SEED_EMAIL} / ${SEED_PASSWORD}`);
    } else {
      userId = user.id;
      console.log(`📝 User already exists (ID: ${userId})`);
    }

    // 2. Create family
    const familySlug = 'sample-family';
    let familyRow = db.prepare('SELECT id FROM families WHERE slug = ?').get(familySlug);
    let familyId;
    
    if (familyRow) {
      familyId = familyRow.id;
      console.log(`📝 Family exists (ID: ${familyId}), clearing old data...`);
      // Use a transaction for clearing data
      const clearData = db.transaction((id) => {
        db.prepare('DELETE FROM members WHERE family_id = ?').run(id);
        db.prepare('DELETE FROM accounts WHERE family_id = ?').run(id);
        db.prepare('DELETE FROM debts WHERE family_id = ?').run(id);
        db.prepare('DELETE FROM insurance WHERE family_id = ?').run(id);
        db.prepare('DELETE FROM goals WHERE family_id = ?').run(id);
        db.prepare('DELETE FROM action_items WHERE family_id = ?').run(id);
        db.prepare('DELETE FROM milestones WHERE family_id = ?').run(id);
        db.prepare('DELETE FROM budget_entries WHERE family_id = ?').run(id);
        db.prepare('UPDATE families SET name=?, location=?, tax_situation=?, user_id=? WHERE id=?')
          .run('Sample Family', 'Montreal, QC', 'Quebec resident', userId, id);
      });
      clearData(familyId);
    } else {
      const result = db.prepare(
        'INSERT INTO families (user_id, name, slug, location, tax_situation) VALUES (?, ?, ?, ?, ?)'
      ).run(userId, 'Sample Family', familySlug, 'Montreal, QC', 'Quebec resident');
      familyId = result.lastInsertRowid;
    }

    console.log(`📊 Family ID: ${familyId}`);

    // 3. Populate with generic transaction
    db.transaction(() => {
      // Members
      db.prepare('INSERT INTO members (family_id, name, role, age, notes) VALUES (?, ?, ?, ?, ?)')
        .run(familyId, 'Primary Member', 'Primary Income', 35, 'Professional Consultant');
      db.prepare('INSERT INTO members (family_id, name, role, age, notes) VALUES (?, ?, ?, ?, ?)')
        .run(familyId, 'Partner', 'Secondary Income', 34, 'Software Developer');
      db.prepare('INSERT INTO members (family_id, name, role, age, notes) VALUES (?, ?, ?, ?, ?)')
        .run(familyId, 'Child 1', 'Dependent', 5, 'Elementary School');

      // Accounts
      db.prepare('INSERT INTO accounts (family_id, type, institution, balance, notes) VALUES (?, ?, ?, ?, ?)')
        .run(familyId, 'TFSA', 'Wealthsimple', 15000, 'Invested in XEQT');
      db.prepare('INSERT INTO accounts (family_id, type, institution, balance, notes) VALUES (?, ?, ?, ?, ?)')
        .run(familyId, 'RRSP', 'Questrade', 25000, 'Invested in VGRO');
      db.prepare('INSERT INTO accounts (family_id, type, institution, balance, notes) VALUES (?, ?, ?, ?, ?)')
        .run(familyId, 'Emergency Fund', 'EQ Bank', 10000, 'Target: $20,000');

      // Debts
      db.prepare('INSERT INTO debts (family_id, type, balance, interest_rate, monthly_payment, notes) VALUES (?, ?, ?, ?, ?, ?)')
        .run(familyId, 'Mortgage', 350000, 4.5, 1950, '5-year fixed term');
      db.prepare('INSERT INTO debts (family_id, type, balance, interest_rate, monthly_payment, notes) VALUES (?, ?, ?, ?, ?, ?)')
        .run(familyId, 'Car Loan', 12000, 5.9, 450, 'Expected payoff in 2027');

      // Goals
      db.prepare('INSERT INTO goals (family_id, timeframe, priority, description, target_amount, current_amount, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(familyId, 'Short-Term', 1, 'Top up Emergency Fund', 20000, 10000, '2026-12-31');
      db.prepare('INSERT INTO goals (family_id, timeframe, priority, description, target_amount, current_amount, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(familyId, 'Long-Term', 1, 'Retirement Nest Egg', 1000000, 40000, '2055-01-01');

      // Action Items
      db.prepare('INSERT INTO action_items (family_id, phase, description, status) VALUES (?, ?, ?, ?)')
        .run(familyId, 'Planning', 'Review insurance coverage gaps', 'Pending');
      db.prepare('INSERT INTO action_items (family_id, phase, description, status) VALUES (?, ?, ?, ?)')
        .run(familyId, 'Action', 'Set up automated TFSA contribution', 'Pending');

      // Budget entries
      db.prepare('INSERT INTO budget_entries (family_id, month_year, category, amount, type) VALUES (?, ?, ?, ?, ?)')
        .run(familyId, '2026-04', 'Salary', 8000, 'income');
      db.prepare('INSERT INTO budget_entries (family_id, month_year, category, amount, type) VALUES (?, ?, ?, ?, ?)')
        .run(familyId, '2026-04', 'Housing', 2500, 'expense');
      db.prepare('INSERT INTO budget_entries (family_id, month_year, category, amount, type) VALUES (?, ?, ?, ?, ?)')
        .run(familyId, '2026-04', 'Food', 1200, 'expense');
    })();

    console.log('✅ Sample data seeded successfully!');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    db.close();
  }
}

seed();