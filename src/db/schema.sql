-- ============================================================
-- Family Financial Planner v2.0 — Enhanced Schema
-- ============================================================

-- Users (multi-tenant auth)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME
);

-- Families (scoped to user)
CREATE TABLE IF NOT EXISTS families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  location TEXT,
  tax_situation TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, slug)
);

-- Members
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  age INTEGER,
  notes TEXT
);

-- Accounts (assets)
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  institution TEXT,
  balance REAL DEFAULT 0,
  contribution_room TEXT,
  target_allocation REAL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Debts (liabilities)
CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  balance REAL DEFAULT 0,
  interest_rate REAL,
  monthly_payment REAL,
  original_amount REAL,
  start_date TEXT,
  notes TEXT
);

-- Insurance policies
CREATE TABLE IF NOT EXISTS insurance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT,
  coverage TEXT,
  premium TEXT,
  status TEXT,
  renewal_date TEXT,
  notes TEXT
);

-- Financial goals
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  timeframe TEXT,
  priority INTEGER,
  description TEXT,
  target_amount REAL DEFAULT 0,
  current_amount REAL DEFAULT 0,
  monthly_contribution REAL DEFAULT 0,
  deadline TEXT,
  status TEXT DEFAULT 'Not Started',
  project_return REAL DEFAULT 7,
  notes TEXT
);

-- Action items / to-do
CREATE TABLE IF NOT EXISTS action_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  phase TEXT,
  description TEXT,
  status TEXT DEFAULT 'Pending',
  due_date TEXT,
  completed_at TEXT,
  notes TEXT
);

-- Milestones
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT,
  target_date TEXT,
  status TEXT DEFAULT 'Not Started',
  celebration_plan TEXT
);

-- Budget entries (actuals)
CREATE TABLE IF NOT EXISTS budget_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  month_year TEXT,
  category TEXT,
  subcategory TEXT,
  amount REAL DEFAULT 0,
  type TEXT CHECK(type IN ('income','expense')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Recurring budget items (template for auto-populating monthly)
CREATE TABLE IF NOT EXISTS recurring_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  amount REAL DEFAULT 0,
  type TEXT CHECK(type IN ('income','expense')),
  frequency TEXT CHECK(frequency IN ('weekly','biweekly','monthly','quarterly','yearly')),
  start_date TEXT,
  end_date TEXT,
  active INTEGER DEFAULT 1
);

-- Insurance decisions log
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

-- Net worth snapshots (monthly auto-captured)
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  snapshot_date TEXT NOT NULL,
  assets REAL DEFAULT 0,
  liabilities REAL DEFAULT 0,
  net_worth REAL DEFAULT 0,
  savings_rate REAL,
  UNIQUE(family_id, snapshot_date)
);

-- Audit log (who changed what)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  old_value TEXT,
  new_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scenarios (what-if modeling)
CREATE TABLE IF NOT EXISTS scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parameters TEXT,
  results TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_family ON accounts(family_id);
CREATE INDEX IF NOT EXISTS idx_debts_family ON debts(family_id);
CREATE INDEX IF NOT EXISTS idx_budget_family ON budget_entries(family_id);
CREATE INDEX IF NOT EXISTS idx_budget_month ON budget_entries(family_id, month_year);
CREATE INDEX IF NOT EXISTS idx_goals_family ON goals(family_id);
CREATE INDEX IF NOT EXISTS idx_actions_family ON action_items(family_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_family_date ON net_worth_snapshots(family_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_audit_family ON audit_logs(family_id, created_at);
