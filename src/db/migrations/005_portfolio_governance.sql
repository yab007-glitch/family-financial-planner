-- ============================================================
-- Portfolio Governance Update
-- ============================================================

-- Track asset classes for rebalancing
ALTER TABLE accounts ADD COLUMN asset_class TEXT DEFAULT 'Other'; -- 'Equities', 'Fixed Income', 'Cash', 'Real Estate'
ALTER TABLE accounts ADD COLUMN target_percent REAL DEFAULT 0;

-- Track cash drag thresholds per family
ALTER TABLE families ADD COLUMN cash_buffer_months INTEGER DEFAULT 3;
