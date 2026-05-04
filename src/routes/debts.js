const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');

router.use(validateFamily);

router.get('/', async (req, res) => {
  try {
    const debts = await db.all('SELECT * FROM debts WHERE family_id = ?', [req.familyId]);
    res.json(success(debts));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.post('/', async (req, res) => {
  try {
    const { type, balance, interest_rate, monthly_payment, notes } = req.body;
    const result = await db.run(
      'INSERT INTO debts (family_id, type, balance, interest_rate, monthly_payment, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [req.familyId, type, balance || 0, interest_rate || null, monthly_payment || null, notes]
    );
    res.json(success({ id: result.lastID, type, balance }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { type, balance, interest_rate, monthly_payment, notes } = req.body;
    await db.run(
      'UPDATE debts SET type=?, balance=?, interest_rate=?, monthly_payment=?, notes=? WHERE id=? AND family_id=?',
      [type, balance || 0, interest_rate || null, monthly_payment || null, notes, req.params.id, req.familyId]
    );
    res.json(success({ updated: true }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM debts WHERE id = ? AND family_id = ?', [req.params.id, req.familyId]);
    res.json(success({ deleted: true }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

module.exports = router;
