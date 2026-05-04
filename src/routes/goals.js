const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');
const { sanitizeBody, validateNumber, validateId, sanitizeError } = require('../middleware/security');

router.use(validateFamily);

router.get('/', async (req, res) => {
  try {
    const goals = await db.all('SELECT * FROM goals WHERE family_id = ? ORDER BY priority', [req.familyId]);
    res.json(success(goals));
  } catch (err) {
    res.status(500).json(error(sanitizeError(err)));
  }
});

router.post('/',
  sanitizeBody(['timeframe', 'priority', 'description', 'target_amount', 'current_amount', 'deadline', 'status']),
  validateNumber('priority', 1, 10),
  validateNumber('target_amount', 0, 1000000000),
  validateNumber('current_amount', 0, 1000000000),
  async (req, res) => {
    try {
      const { timeframe, priority, description, target_amount, current_amount, deadline, status } = req.body;

      // Validate status
      if (status && status !== 'Not Started' && status !== 'In Progress' && status !== 'Completed') {
        return res.status(400).json(error('Status must be "Not Started", "In Progress", or "Completed"'));
      }

      const result = await db.run(
        'INSERT INTO goals (family_id, timeframe, priority, description, target_amount, current_amount, deadline, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [req.familyId, timeframe || null, priority || null, description || null, target_amount || 0, current_amount || 0, deadline || null, status || 'Not Started']
      );
      res.json(success({ id: result.lastID, description, target_amount }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

router.put('/:id',
  validateId(),
  sanitizeBody(['timeframe', 'priority', 'description', 'target_amount', 'current_amount', 'deadline', 'status']),
  validateNumber('priority', 1, 10),
  validateNumber('target_amount', 0, 1000000000),
  validateNumber('current_amount', 0, 1000000000),
  async (req, res) => {
    try {
      const { timeframe, priority, description, target_amount, current_amount, deadline, status } = req.body;

      // Validate status
      if (status && status !== 'Not Started' && status !== 'In Progress' && status !== 'Completed') {
        return res.status(400).json(error('Status must be "Not Started", "In Progress", or "Completed"'));
      }

      await db.run(
        'UPDATE goals SET timeframe=?, priority=?, description=?, target_amount=?, current_amount=?, deadline=?, status=? WHERE id=? AND family_id=?',
        [timeframe || null, priority || null, description || null, target_amount || 0, current_amount || 0, deadline || null, status || 'Not Started', req.params.id, req.familyId]
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
      await db.run('DELETE FROM goals WHERE id = ? AND family_id = ?', [req.params.id, req.familyId]);
      res.json(success({ deleted: true }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

module.exports = router;
