const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');
const { validateRequired, sanitizeBody, validateId, sanitizeError } = require('../middleware/security');

router.use(validateFamily);

router.get('/', async (req, res) => {
  try {
    const insurance = await db.all('SELECT * FROM insurance WHERE family_id = ?', [req.familyId]);
    res.json(success(insurance));
  } catch (err) {
    res.status(500).json(error(sanitizeError(err)));
  }
});

router.post('/',
  sanitizeBody(['type', 'provider', 'coverage', 'premium', 'status', 'notes']),
  validateRequired(['type']),
  async (req, res) => {
    try {
      const { type, provider, coverage, premium, status, notes } = req.body;
      const result = await db.run(
        'INSERT INTO insurance (family_id, type, provider, coverage, premium, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.familyId, type, provider || null, coverage || null, premium || null, status || null, notes || null]
      );
      res.json(success({ id: result.lastID, type, provider, status }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

router.put('/:id',
  validateId(),
  sanitizeBody(['type', 'provider', 'coverage', 'premium', 'status', 'notes']),
  validateRequired(['type']),
  async (req, res) => {
    try {
      const { type, provider, coverage, premium, status, notes } = req.body;
      await db.run(
        'UPDATE insurance SET type=?, provider=?, coverage=?, premium=?, status=?, notes=? WHERE id=? AND family_id=?',
        [type, provider || null, coverage || null, premium || null, status || null, notes || null, req.params.id, req.familyId]
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
      await db.run('DELETE FROM insurance WHERE id = ? AND family_id = ?', [req.params.id, req.familyId]);
      res.json(success({ deleted: true }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

module.exports = router;
