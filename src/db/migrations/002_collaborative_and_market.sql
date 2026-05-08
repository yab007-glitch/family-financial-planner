-- ============================================================
-- Family Partnership & Multi-User Support
-- ============================================================

-- Track which users have access to which families
CREATE TABLE IF NOT EXISTS family_memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner', 'member', 'viewer'
  invited_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(family_id, user_id)
);

-- Invitations for users not yet in the system
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

-- #1: Add symbol/units to accounts for Market Data Integration
ALTER TABLE accounts ADD COLUMN symbol TEXT;
ALTER TABLE accounts ADD COLUMN units REAL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN last_price REAL;
ALTER TABLE accounts ADD COLUMN last_price_at DATETIME;

-- Initialize memberships for existing families
INSERT OR IGNORE INTO family_memberships (family_id, user_id, role)
SELECT id, user_id, 'owner' FROM families;
