-- ============================================================
-- Currency, Vault, and Automation Update
-- ============================================================

-- Add currency support to accounts and budget
ALTER TABLE accounts ADD COLUMN currency TEXT DEFAULT 'CAD';
ALTER TABLE budget_entries ADD COLUMN currency TEXT DEFAULT 'CAD';

-- Legacy Vault for encrypted documents
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'account', 'insurance', 'goal', 'will'
  entity_id INTEGER,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content_type TEXT,
  file_size INTEGER,
  encrypted_key TEXT, -- Encrypted AES key for this file
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transaction categorization patterns
CREATE TABLE IF NOT EXISTS categorization_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE, -- NULL for global defaults
  pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  priority INTEGER DEFAULT 0
);

-- Cached FX rates
CREATE TABLE IF NOT EXISTS currency_rates (
  base TEXT NOT NULL,
  quote TEXT NOT NULL,
  rate REAL NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (base, quote)
);

-- Global default patterns
INSERT INTO categorization_patterns (family_id, pattern, category, subcategory) VALUES 
(NULL, '%AMZN%', 'Shopping', 'Amazon'),
(NULL, '%WALMART%', 'Shopping', 'Groceries'),
(NULL, '%SHELL%', 'Transportation', 'Gas'),
(NULL, '%PETRO%', 'Transportation', 'Gas'),
(NULL, '%STARBUCKS%', 'Food', 'Coffee'),
(NULL, '%TIM HORTONS%', 'Food', 'Coffee'),
(NULL, '%UBER%', 'Transportation', 'Ride share'),
(NULL, '%HYDRO%', 'Housing', 'Utilities'),
(NULL, '%VIDEOTRON%', 'Housing', 'Internet'),
(NULL, '%BELL%', 'Housing', 'Communications'),
(NULL, '%NETFLIX%', 'Entertainment', 'Subscription');
