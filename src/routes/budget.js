const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');

router.use(validateFamily);

router.get('/', async (req, res) => {
  try {
    const { month } = req.query;
    let sql = 'SELECT * FROM budget_entries WHERE family_id = ?';
    let params = [req.familyId];
    if (month) {
      sql += ' AND month_year = ?';
      params.push(month);
    }
    const entries = await db.all(sql, params);
    res.json(success(entries));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.post('/', async (req, res) => {
  try {
    const { month_year, category, subcategory, amount, type, notes } = req.body;
    const result = await db.run(
      'INSERT INTO budget_entries (family_id, month_year, category, subcategory, amount, type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.familyId, month_year, category, subcategory, amount || 0, type, notes]
    );
    res.json(success({ id: result.lastID, month_year, category, amount, type }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { month_year, category, subcategory, amount, type, notes } = req.body;
    await db.run(
      'UPDATE budget_entries SET month_year=?, category=?, subcategory=?, amount=?, type=?, notes=? WHERE id=? AND family_id=?',
      [month_year, category, subcategory, amount || 0, type, notes, req.params.id, req.familyId]
    );
    res.json(success({ updated: true }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM budget_entries WHERE id = ? AND family_id = ?', [req.params.id, req.familyId]);
    res.json(success({ deleted: true }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

module.exports = router;
