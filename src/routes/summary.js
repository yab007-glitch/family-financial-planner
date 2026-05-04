const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');

router.use(validateFamily);

router.get('/', async (req, res) => {
  try {
    const assetsRow = await db.get('SELECT COALESCE(SUM(balance),0) as total FROM accounts WHERE family_id = ?', [req.familyId]);
    const liabilitiesRow = await db.get('SELECT COALESCE(SUM(balance),0) as total FROM debts WHERE family_id = ?', [req.familyId]);
    const incomeRow = await db.get('SELECT COALESCE(SUM(amount),0) as total FROM budget_entries WHERE family_id = ? AND type = ?', [req.familyId, 'income']);
    const expenseRow = await db.get('SELECT COALESCE(SUM(amount),0) as total FROM budget_entries WHERE family_id = ? AND type = ?', [req.familyId, 'expense']);

    const assets = assetsRow ? assetsRow.total : 0;
    const liabilities = liabilitiesRow ? liabilitiesRow.total : 0;
    const netWorth = assets - liabilities;
    const totalIncome = incomeRow ? incomeRow.total : 0;
    const totalExpenses = expenseRow ? expenseRow.total : 0;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : 0;

    res.json(success({
      assets,
      liabilities,
      netWorth,
      totalIncome,
      totalExpenses,
      savingsRate: parseFloat(savingsRate)
    }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

module.exports = router;
