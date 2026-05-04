CREATE TABLE IF NOT EXISTS families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  location TEXT,
  tax_situation TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  age INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  institution TEXT,
  balance REAL DEFAULT 0,
  contribution_room TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  balance REAL DEFAULT 0,
  interest_rate REAL,
  monthly_payment REAL,
  notes TEXT
);

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

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  timeframe TEXT,
  priority INTEGER,
  description TEXT,
  target_amount REAL,
  current_amount REAL DEFAULT 0,
  deadline TEXT,
  status TEXT DEFAULT 'Not Started'
);

CREATE TABLE IF NOT EXISTS action_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  phase TEXT,
  description TEXT,
  status TEXT DEFAULT 'Pending',
  due_date TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT,
  target_date TEXT,
  status TEXT DEFAULT 'Not Started',
  celebration_plan TEXT
);

CREATE TABLE IF NOT EXISTS budget_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  month_year TEXT,
  category TEXT,
  subcategory TEXT,
  amount REAL DEFAULT 0,
  type TEXT,
  notes TEXT
);

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
