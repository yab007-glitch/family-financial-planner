const express = require('express');
const router = express.Router({ mergeParams: true });
const MortgageVsInvestCalculator = require('../utils/mortgage-calculator');
const RetirementSimulator = require('../utils/retirement-simulator');
const MonteCarloEngine = require('../utils/monte-carlo');
const FHSAChecker = require('../utils/fhsa-checker');
const ReportGenerator = require('../utils/report-generator');
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');
const { sanitizeBody, sanitizeError } = require('../middleware/security');

router.use(validateFamily);

// ==================== MORTGAGE VS INVEST ====================

// POST /api/families/:slug/tools/mortgage-vs-invest
router.post('/mortgage-vs-invest',
  sanitizeBody(['mortgage_balance', 'mortgage_rate', 'investment_return', 'lump_sum', 'monthly_extra']),
  async (req, res) => {
    try {
      const result = MortgageVsInvestCalculator.compare(req.body);
      res.json(success(result));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

// ==================== RETIREMENT SIMULATOR ====================

// POST /api/families/:slug/tools/retirement-simulate
router.post('/retirement-simulate',
  sanitizeBody(['current_age', 'retirement_age', 'current_savings', 'monthly_contribution', 'expected_return', 'withdrawal_rate']),
  async (req, res) => {
    try {
      const sim = new RetirementSimulator();
      const result = sim.simulateRetirement(req.body);
      res.json(success(result));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

// POST /api/families/:slug/tools/retirement-readiness
router.post('/retirement-readiness',
  sanitizeBody(['currentAge', 'desiredRetirementAge', 'currentSavings', 'monthlyContribution', 'expectedReturn']),
  async (req, res) => {
    try {
      const result = RetirementSimulator.checkReadiness(
        req.body.currentAge,
        req.body.desiredRetirementAge,
        req.body.currentSavings,
        req.body.monthlyContribution,
        req.body.expectedReturn
      );
      res.json(success(result));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

// ==================== MONTE CARLO ====================

// POST /api/families/:slug/tools/monte-carlo
router.post('/monte-carlo',
  sanitizeBody(['principal', 'monthly_contribution', 'annual_return_mean', 'annual_return_std', 'years', 'simulations']),
  async (req, res) => {
    try {
      const result = MonteCarloEngine.simulate(req.body);
      res.json(success(result));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

// ==================== FHSA CHECKER ====================

// POST /api/families/:slug/tools/fhsa-check
router.post('/fhsa-check',
  sanitizeBody(['age', 'first_time_buyer', 'has_rrsp', 'annual_income']),
  async (req, res) => {
    try {
      const result = FHSAChecker.checkEligibility(req.body);
      res.json(success(result));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

// POST /api/families/:slug/tools/fhsa-compare-accounts
router.post('/fhsa-compare-accounts',
  sanitizeBody(['downPaymentNeeded', 'yearsToPurchase', 'annualIncome']),
  async (req, res) => {
    try {
      const result = FHSAChecker.compareHomeBuyingAccounts(
        req.body.downPaymentNeeded,
        req.body.yearsToPurchase,
        req.body.annualIncome
      );
      res.json(success(result));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

// ==================== REPORT EXPORT ====================

// GET /api/families/:slug/tools/export-report?format=csv|json
router.get('/export-report', async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    // Validate format
    if (format !== 'json' && format !== 'csv') {
      return res.status(400).json(error('Format must be either "json" or "csv"'));
    }

    // Get family data
    const family = await db.get('SELECT * FROM families WHERE slug = ?', [req.params.slug]);
    if (!family) return res.status(404).json(error('Family not found', 404));

    family.members = await db.all('SELECT * FROM members WHERE family_id = ?', [family.id]);
    family.accounts = await db.all('SELECT * FROM accounts WHERE family_id = ?', [family.id]);
    family.debts = await db.all('SELECT * FROM debts WHERE family_id = ?', [family.id]);
    family.insurance = await db.all('SELECT * FROM insurance WHERE family_id = ?', [family.id]);
    family.goals = await db.all('SELECT * FROM goals WHERE family_id = ? ORDER BY priority', [family.id]);
    family.actions = await db.all('SELECT * FROM action_items WHERE family_id = ? ORDER BY phase', [family.id]);
    family.milestones = await db.all('SELECT * FROM milestones WHERE family_id = ?', [family.id]);

    const report = ReportGenerator.generateWealthReport(family, null, null);

    if (format === 'csv') {
      const csv = ReportGenerator.generateTaxReport(report, 'csv');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.slug}-wealth-report.csv"`);
      return res.send(csv);
    }

    res.json(success(report));
  } catch (err) {
    res.status(500).json(error(sanitizeError(err)));
  }
});

module.exports = router;
