-- ============================================================
-- Family Financial Planner v2.1 — Collaborative & Automated
-- ============================================================

-- Users (multi-tenant auth)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  two_factor_secret TEXT, -- #MFA
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until DATETIME
);

-- Families (scoped to owner initially, but multi-user via memberships)
CREATE TABLE IF NOT EXISTS families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Original Creator
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  location TEXT,
  tax_situation TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, slug)
);

-- Collaborative Partnerships
CREATE TABLE IF NOT EXISTS family_memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner', 'member', 'viewer'
  invited_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(family_id, user_id)
);

CREATE TABLE IF NOT EXISTS family_invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'member',
  invited_by INTEGER NOT NULL REFERENCES users(id),
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Members (Household inhabitants)
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
  symbol TEXT, -- #MarketData
  units REAL DEFAULT 0, -- #MarketData
  last_price REAL, -- #MarketData
  last_price_at DATETIME, -- #MarketData
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
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  user_agent TEXT,
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

-- Migration tracking
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- #22: Additional indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_accounts_family ON accounts(family_id);
CREATE INDEX IF NOT EXISTS idx_debts_family ON debts(family_id);
CREATE INDEX IF NOT EXISTS idx_budget_family ON budget_entries(family_id);
CREATE INDEX IF NOT EXISTS idx_budget_month ON budget_entries(family_id, month_year);
CREATE INDEX IF NOT EXISTS idx_goals_family ON goals(family_id);
CREATE INDEX IF NOT EXISTS idx_actions_family ON action_items(family_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_family_date ON net_worth_snapshots(family_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_audit_family ON audit_logs(family_id, created_at);
CREATE INDEX IF NOT EXISTS idx_families_user_id ON families(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON family_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON family_invitations(token);