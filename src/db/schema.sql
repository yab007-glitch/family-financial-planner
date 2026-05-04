CREATE TABLE IF NOT EXISTS families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  location TEXT,
  tax_situation TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for families
CREATE INDEX IF NOT EXISTS idx_families_slug ON families(slug);

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  age INTEGER CHECK(age >= 0 AND age <= 150),
  notes TEXT
);

-- Indexes for members
CREATE INDEX IF NOT EXISTS idx_members_family_id ON members(family_id);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  institution TEXT,
  balance REAL DEFAULT 0,
  contribution_room TEXT,
  notes TEXT
);

-- Indexes for accounts
CREATE INDEX IF NOT EXISTS idx_accounts_family_id ON accounts(family_id);

CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  balance REAL DEFAULT 0 CHECK(balance >= 0),
  interest_rate REAL CHECK(interest_rate >= 0 AND interest_rate <= 100),
  monthly_payment REAL CHECK(monthly_payment >= 0),
  notes TEXT
);

-- Indexes for debts
CREATE INDEX IF NOT EXISTS idx_debts_family_id ON debts(family_id);

CREATE TABLE IF NOT EXISTS insurance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT,
  coverage TEXT,
  premium TEXT,
  status TEXT,
  notes TEXT
);

-- Indexes for insurance
CREATE INDEX IF NOT EXISTS idx_insurance_family_id ON insurance(family_id);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  timeframe TEXT,
  priority INTEGER CHECK(priority >= 1 AND priority <= 10),
  description TEXT,
  target_amount REAL CHECK(target_amount >= 0),
  current_amount REAL DEFAULT 0 CHECK(current_amount >= 0),
  deadline TEXT,
  status TEXT DEFAULT 'Not Started'
);

-- Indexes for goals
CREATE INDEX IF NOT EXISTS idx_goals_family_id ON goals(family_id);

CREATE TABLE IF NOT EXISTS action_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  phase TEXT,
  description TEXT,
  status TEXT DEFAULT 'Pending',
  due_date TEXT,
  notes TEXT
);

-- Indexes for action_items
CREATE INDEX IF NOT EXISTS idx_action_items_family_id ON action_items(family_id);

CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT,
  target_date TEXT,
  status TEXT DEFAULT 'Not Started',
  celebration_plan TEXT
);

-- Indexes for milestones
CREATE INDEX IF NOT EXISTS idx_milestones_family_id ON milestones(family_id);

CREATE TABLE IF NOT EXISTS budget_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  month_year TEXT,
  category TEXT,
  subcategory TEXT,
  amount REAL DEFAULT 0 CHECK(amount >= 0),
  type TEXT,
  notes TEXT
);

-- Indexes for budget_entries
CREATE INDEX IF NOT EXISTS idx_budget_entries_family_id ON budget_entries(family_id);
CREATE INDEX IF NOT EXISTS idx_budget_entries_month_year ON budget_entries(month_year);

CREATE TABLE IF NOT EXISTS insurance_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  provider TEXT,
  policy_type TEXT,
  coverage TEXT,
  premium TEXT,
  decision TEXT,
  rationale TEXT,
  reviewed_at TEXT
);

-- Indexes for insurance_decisions
CREATE INDEX IF NOT EXISTS idx_insurance_decisions_family_id ON insurance_decisions(family_id);
