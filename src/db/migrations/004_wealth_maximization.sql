-- ============================================================
-- Wealth Maximization & Historical Story Update
-- ============================================================

-- Track historical property values for real estate analysis
CREATE TABLE IF NOT EXISTS property_appraisals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  appraisal_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Enhance members for tax splitting (income, rrsp room)
ALTER TABLE members ADD COLUMN annual_income REAL DEFAULT 0;
ALTER TABLE members ADD COLUMN rrsp_room REAL DEFAULT 0;
ALTER TABLE members ADD COLUMN tax_province TEXT DEFAULT 'QC';

-- Store historical health scores for trend analysis
CREATE TABLE IF NOT EXISTS health_score_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  liquidity INTEGER,
  debt INTEGER,
  savings INTEGER,
  tax INTEGER,
  estate INTEGER,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reference for common Canadian tax optimization rules
CREATE TABLE IF NOT EXISTS optimization_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  impact_level TEXT -- 'High', 'Medium', 'Low'
);

INSERT INTO optimization_rules (name, description, impact_level) VALUES
('Spousal RRSP', 'Contribute to a lower-earning spouse''s RRSP to split income in retirement.', 'High'),
('Medical Expense Pooling', 'Claim all family medical expenses on the lower-income spouse''s return.', 'Medium'),
('Donations Pooling', 'Claim all family donations on the higher-income spouse''s return for max credit.', 'Medium'),
('The Smith Maneuver', 'Convert non-deductible mortgage debt into deductible investment debt.', 'High');
