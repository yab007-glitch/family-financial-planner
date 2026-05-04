const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');
const { sanitizeBody, validateNumber, validateId, sanitizeError } = require('../middleware/security');

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
    res.status(500).json(error(sanitizeError(err)));
  }
});

router.post('/',
  sanitizeBody(['month_year', 'category', 'subcategory', 'amount', 'type', 'notes']),
  validateNumber('amount', 0, 1000000000),
  async (req, res) => {
    try {
      const { month_year, category, subcategory, amount, type, notes } = req.body;

      // Validate type
      if (type && type !== 'income' && type !== 'expense') {
        return res.status(400).json(error('Type must be either "income" or "expense"'));
      }

      const result = await db.run(
        'INSERT INTO budget_entries (family_id, month_year, category, subcategory, amount, type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.familyId, month_year || null, category || null, subcategory || null, amount || 0, type || null, notes || null]
      );
      res.json(success({ id: result.lastID, month_year, category, amount, type }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

router.put('/:id',
  validateId(),
  sanitizeBody(['month_year', 'category', 'subcategory', 'amount', 'type', 'notes']),
  validateNumber('amount', 0, 1000000000),
  async (req, res) => {
    try {
      const { month_year, category, subcategory, amount, type, notes } = req.body;

      // Validate type
      if (type && type !== 'income' && type !== 'expense') {
        return res.status(400).json(error('Type must be either "income" or "expense"'));
      }

      await db.run(
        'UPDATE budget_entries SET month_year=?, category=?, subcategory=?, amount=?, type=?, notes=? WHERE id=? AND family_id=?',
        [month_year || null, category || null, subcategory || null, amount || 0, type || null, notes || null, req.params.id, req.familyId]
      );
      res.json(success({ updated: true }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

router.delete('/:id',
  validateId(),
  async (req, res) => {
    try {
      await db.run('DELETE FROM budget_entries WHERE id = ? AND family_id = ?', [req.params.id, req.familyId]);
      res.json(success({ deleted: true }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

module.exports = router;
