const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');
const { validateRequired, sanitizeBody, validateId, sanitizeError } = require('../middleware/security');

router.use(validateFamily);

router.get('/', async (req, res) => {
  try {
    const milestones = await db.all('SELECT * FROM milestones WHERE family_id = ?', [req.familyId]);
    res.json(success(milestones));
  } catch (err) {
    res.status(500).json(error(sanitizeError(err)));
  }
});

router.post('/',
  sanitizeBody(['name', 'target_date', 'status', 'celebration_plan']),
  validateRequired(['name']),
  async (req, res) => {
    try {
      const { name, target_date, status, celebration_plan } = req.body;

      // Validate status
      if (status && status !== 'Not Started' && status !== 'In Progress' && status !== 'Completed') {
        return res.status(400).json(error('Status must be "Not Started", "In Progress", or "Completed"'));
      }

      const result = await db.run(
        'INSERT INTO milestones (family_id, name, target_date, status, celebration_plan) VALUES (?, ?, ?, ?, ?)',
        [req.familyId, name, target_date || null, status || 'Not Started', celebration_plan || null]
      );
      res.json(success({ id: result.lastID, name, target_date, status }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

router.put('/:id',
  validateId(),
  sanitizeBody(['name', 'target_date', 'status', 'celebration_plan']),
  validateRequired(['name']),
  async (req, res) => {
    try {
      const { name, target_date, status, celebration_plan } = req.body;

      // Validate status
      if (status && status !== 'Not Started' && status !== 'In Progress' && status !== 'Completed') {
        return res.status(400).json(error('Status must be "Not Started", "In Progress", or "Completed"'));
      }

      await db.run(
        'UPDATE milestones SET name=?, target_date=?, status=?, celebration_plan=? WHERE id=? AND family_id=?',
        [name, target_date || null, status || 'Not Started', celebration_plan || null, req.params.id, req.familyId]
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
      await db.run('DELETE FROM milestones WHERE id = ? AND family_id = ?', [req.params.id, req.familyId]);
      res.json(success({ deleted: true }));
    } catch (err) {
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

module.exports = router;
