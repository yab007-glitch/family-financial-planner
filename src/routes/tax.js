const express = require('express');
const router = express.Router({ mergeParams: true });
const TaxEngine = require('../utils/tax-engine');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');
const { sanitizeBody, validateNumber, sanitizeError } = require('../middleware/security');

router.use(validateFamily);

// POST /api/families/:slug/tax/calculate
router.post('/calculate',
  sanitizeBody(['income', 'rrsp_contribution', 'other_deductions']),
  validateNumber('income', 0, 1000000000),
  validateNumber('rrsp_contribution', 0, 1000000000),
  validateNumber('other_deductions', 0, 1000000000),
  async (req, res) => {
    try {
      const { income, rrsp_contribution = 0, other_deductions = 0 } = req.body;
      if (!income) {
        return res.status(400).json(error('Income is required'));
      }
      const engine = new TaxEngine(2025);
      const result = engine.calculateFullTaxReturn(parseFloat(income), parseFloat(rrsp_contribution), parseFloat(other_deductions));
      res.json(success(result));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

// POST /api/families/:slug/tax/marginal-rate
router.post('/marginal-rate',
  sanitizeBody(['income']),
  validateNumber('income', 0, 1000000000),
  async (req, res) => {
    try {
      const { income } = req.body;
      if (!income) {
        return res.status(400).json(error('Income is required'));
      }
      const engine = new TaxEngine(2025);
      const result = engine.getMarginalRate(parseFloat(income));
      res.json(success(result));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

// POST /api/families/:slug/tax/rrsp-impact
router.post('/rrsp-impact',
  sanitizeBody(['income', 'rrsp_contribution']),
  validateNumber('income', 0, 1000000000),
  validateNumber('rrsp_contribution', 0, 1000000000),
  async (req, res) => {
    try {
      const { income, rrsp_contribution } = req.body;
      if (!income || !rrsp_contribution) {
        return res.status(400).json(error('Income and rrsp_contribution are required'));
      }
      const engine = new TaxEngine(2025);
      const result = engine.calculateRRSPImpact(parseFloat(income), parseFloat(rrsp_contribution));
      res.json(success(result));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

// POST /api/families/:slug/tax/resp-cesg
router.post('/resp-cesg',
  sanitizeBody(['contribution', 'num_children']),
  validateNumber('contribution', 0, 1000000),
  validateNumber('num_children', 1, 20),
  async (req, res) => {
    try {
      const { contribution, num_children = 1 } = req.body;
      const engine = new TaxEngine(2025);
      const result = engine.calculateResCESG(parseFloat(contribution), parseInt(num_children));
      res.json(success(result));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

// POST /api/families/:slug/tax/strategy
router.post('/strategy',
  sanitizeBody(['income', 'age', 'num_children', 'available_cash']),
  validateNumber('income', 0, 1000000000),
  validateNumber('age', 18, 100),
  validateNumber('num_children', 0, 20),
  validateNumber('available_cash', 0, 1000000000),
  async (req, res) => {
    try {
      const { income, age, num_children = 0, available_cash = 0 } = req.body;
      if (!income || !age) {
        return res.status(400).json(error('Income and age are required'));
      }
      const engine = new TaxEngine(2025);
      const strategy = engine.getOptimalSavingsOrder(parseFloat(income), parseInt(age), parseInt(num_children));

      // Add year-one plan if available_cash provided
      const yearOnePlan = [];
      if (available_cash > 0) {
        let remaining = available_cash;
        for (const step of strategy) {
          if (remaining <= 0) break;
          let allocation = 0;
          let benefit = null;

          if (step.account === 'RESP' && num_children > 0) {
            allocation = Math.min(2500 * num_children, remaining);
            const cesg = engine.calculateResCESG(allocation, num_children);
            benefit = `+ $${cesg.annualGrant.toLocaleString()} CESG grant`;
          } else if (step.account === 'TFSA') {
            allocation = Math.min(7000, remaining); // 2025 limit
          } else if (step.account === 'RRSP') {
            const rrspLimit = Math.min(parseFloat(income) * 0.18, 32490);
            allocation = Math.min(rrspLimit, remaining);
            const impact = engine.calculateRRSPImpact(parseFloat(income), allocation);
            benefit = `+ $${impact.taxRefund.toLocaleString()} tax refund`;
          } else if (step.account === 'FHSA') {
            allocation = Math.min(8000, remaining);
            const impact = engine.calculateRRSPImpact(parseFloat(income), allocation);
            benefit = `+ $${impact.taxRefund.toLocaleString()} tax deduction`;
          }

          if (allocation > 0) {
            yearOnePlan.push({ ...step, allocation, remainingAfter: remaining - allocation, benefit });
            remaining -= allocation;
          }
        }
        if (remaining > 0) {
          yearOnePlan.push({ priority: 99, account: 'Non-registered / Mortgage', allocation: remaining, note: 'Invest in taxable account or prepay mortgage' });
        }
      }

      res.json(success({
        income: parseFloat(income),
        age: parseInt(age),
        num_children: parseInt(num_children),
        marginal_rate: engine.getMarginalRate(parseFloat(income)).combined,
        strategy,
        year_one_plan: yearOnePlan,
        rules: [
          '1. Always take government matching money first (CESG 20%, employer match)',
          '2. If marginal rate < 30%, prioritize TFSA over RRSP',
          '3. If marginal rate > 30%, prioritize RRSP: refund = immediate return',
          '4. FHSA is the ultimate hybrid (deduction + tax-free withdrawal for home)',
          '5. Contribute to RRSP early, claim deduction later if income will increase',
          '6. Use Spousal RRSP for income splitting in retirement',
          '7. Non-registered last: use Horizons swap ETFs for tax efficiency',
          '8. Reinvest ALL tax refunds, do not spend them',
          '9. RESP: Maximize before child turns 17 (CESG = free 20% ROI)',
          '10. Quebec: Stack federal + provincial credits for maximum benefit'
        ]
      }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

module.exports = router;
