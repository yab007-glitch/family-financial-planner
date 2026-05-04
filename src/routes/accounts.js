const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');
const { validateRequired, sanitizeBody, validateNumber, validateId, sanitizeError } = require('../middleware/security');

router.use(validateFamily);

router.get('/', async (req, res) => {
  try {
    const accounts = await db.all('SELECT * FROM accounts WHERE family_id = ?', [req.familyId]);
    res.json(success(accounts));
  } catch (err) {
    res.status(500).json(error(sanitizeError(err)));
  }
});

router.post('/',
  sanitizeBody(['type', 'institution', 'balance', 'contribution_room', 'notes']),
  validateRequired(['type']),
  validateNumber('balance', -1000000000, 1000000000),
  async (req, res) => {
    try {
      const { type, institution, balance, contribution_room, notes } = req.body;
      const result = await db.run(
        'INSERT INTO accounts (family_id, type, institution, balance, contribution_room, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [req.familyId, type, institution || null, balance || 0, contribution_room || null, notes || null]
      );
      res.json(success({ id: result.lastID, type, institution, balance }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

router.put('/:id',
  validateId(),
  sanitizeBody(['type', 'institution', 'balance', 'contribution_room', 'notes']),
  validateRequired(['type']),
  validateNumber('balance', -1000000000, 1000000000),
  async (req, res) => {
    try {
      const { type, institution, balance, contribution_room, notes } = req.body;
      await db.run(
        'UPDATE accounts SET type=?, institution=?, balance=?, contribution_room=?, notes=? WHERE id=? AND family_id=?',
        [type, institution || null, balance || 0, contribution_room || null, notes || null, req.params.id, req.familyId]
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
      await db.run('DELETE FROM accounts WHERE id = ? AND family_id = ?', [req.params.id, req.familyId]);
      res.json(success({ deleted: true }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

module.exports = router;
