-- Add two_factor_secret column to users
ALTER TABLE users ADD COLUMN two_factor_secret TEXT;
