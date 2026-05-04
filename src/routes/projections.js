const express = require('express');
const router = express.Router({ mergeParams: true });
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');

function compoundInterestProjection(principal, monthlyContribution, annualRate, years) {
  const monthlyRate = annualRate / 12 / 100;
  const months = years * 12;
  let balance = principal;
  const schedule = [];

  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    if (m % 12 === 0) {
      schedule.push({
        year: m / 12,
        balance: Math.round(balance),
        totalContributed: principal + (monthlyContribution * m)
      });
    }
  }
  return schedule;
}

router.use(validateFamily);

router.post('/', (req, res) => {
  try {
    const { principal, monthly_contribution, annual_rate, years } = req.body;
    if (!years || !annual_rate) {
      return res.status(400).json(error('Years and annual_rate are required'));
    }
    const schedule = compoundInterestProjection(
      principal || 0,
      monthly_contribution || 0,
      annual_rate,
      years
    );
    res.json(success({ schedule }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

module.exports = router;
