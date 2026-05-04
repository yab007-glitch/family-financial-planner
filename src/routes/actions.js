const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');
const { validateRequired, sanitizeBody, validateId, sanitizeError } = require('../middleware/security');

router.use(validateFamily);

router.get('/', async (req, res) => {
  try {
    const actions = await db.all('SELECT * FROM action_items WHERE family_id = ? ORDER BY phase', [req.familyId]);
    res.json(success(actions));
  } catch (err) {
    res.status(500).json(error(sanitizeError(err)));
  }
});

router.post('/',
  sanitizeBody(['phase', 'description', 'status', 'due_date', 'notes']),
  validateRequired(['description']),
  async (req, res) => {
    try {
      const { phase, description, status, due_date, notes } = req.body;

      // Validate status
      if (status && status !== 'Pending' && status !== 'In Progress' && status !== 'Completed') {
        return res.status(400).json(error('Status must be "Pending", "In Progress", or "Completed"'));
      }

      const result = await db.run(
        'INSERT INTO action_items (family_id, phase, description, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [req.familyId, phase || null, description, status || 'Pending', due_date || null, notes || null]
      );
      res.json(success({ id: result.lastID, phase, description, status }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

router.put('/:id',
  validateId(),
  sanitizeBody(['phase', 'description', 'status', 'due_date', 'notes']),
  validateRequired(['description']),
  async (req, res) => {
    try {
      const { phase, description, status, due_date, notes } = req.body;

      // Validate status
      if (status && status !== 'Pending' && status !== 'In Progress' && status !== 'Completed') {
        return res.status(400).json(error('Status must be "Pending", "In Progress", or "Completed"'));
      }

      await db.run(
        'UPDATE action_items SET phase=?, description=?, status=?, due_date=?, notes=? WHERE id=? AND family_id=?',
        [phase || null, description, status || 'Pending', due_date || null, notes || null, req.params.id, req.familyId]
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
      await db.run('DELETE FROM action_items WHERE id = ? AND family_id = ?', [req.params.id, req.familyId]);
      res.json(success({ deleted: true }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

module.exports = router;
