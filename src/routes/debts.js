const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');
const { validateRequired, sanitizeBody, validateNumber, validateId, sanitizeError } = require('../middleware/security');

router.use(validateFamily);

router.get('/', async (req, res) => {
  try {
    const debts = await db.all('SELECT * FROM debts WHERE family_id = ?', [req.familyId]);
    res.json(success(debts));
  } catch (err) {
    res.status(500).json(error(sanitizeError(err)));
  }
});

router.post('/',
  sanitizeBody(['type', 'balance', 'interest_rate', 'monthly_payment', 'notes']),
  validateRequired(['type']),
  validateNumber('balance', 0, 1000000000),
  validateNumber('interest_rate', 0, 100),
  validateNumber('monthly_payment', 0, 1000000),
  async (req, res) => {
    try {
      const { type, balance, interest_rate, monthly_payment, notes } = req.body;
      const result = await db.run(
        'INSERT INTO debts (family_id, type, balance, interest_rate, monthly_payment, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [req.familyId, type, balance || 0, interest_rate || null, monthly_payment || null, notes || null]
      );
      res.json(success({ id: result.lastID, type, balance }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

router.put('/:id',
  validateId(),
  sanitizeBody(['type', 'balance', 'interest_rate', 'monthly_payment', 'notes']),
  validateRequired(['type']),
  validateNumber('balance', 0, 1000000000),
  validateNumber('interest_rate', 0, 100),
  validateNumber('monthly_payment', 0, 1000000),
  async (req, res) => {
    try {
      const { type, balance, interest_rate, monthly_payment, notes } = req.body;
      await db.run(
        'UPDATE debts SET type=?, balance=?, interest_rate=?, monthly_payment=?, notes=? WHERE id=? AND family_id=?',
        [type, balance || 0, interest_rate || null, monthly_payment || null, notes || null, req.params.id, req.familyId]
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
      await db.run('DELETE FROM debts WHERE id = ? AND family_id = ?', [req.params.id, req.familyId]);
      res.json(success({ deleted: true }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

module.exports = router;
