const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');

router.use(validateFamily);

router.get('/', async (req, res) => {
  try {
    const actions = await db.all('SELECT * FROM action_items WHERE family_id = ? ORDER BY phase', [req.familyId]);
    res.json(success(actions));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.post('/', async (req, res) => {
  try {
    const { phase, description, status, due_date, notes } = req.body;
    const result = await db.run(
      'INSERT INTO action_items (family_id, phase, description, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [req.familyId, phase, description, status || 'Pending', due_date, notes]
    );
    res.json(success({ id: result.lastID, phase, description, status }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { phase, description, status, due_date, notes } = req.body;
    await db.run(
      'UPDATE action_items SET phase=?, description=?, status=?, due_date=?, notes=? WHERE id=? AND family_id=?',
      [phase, description, status, due_date, notes, req.params.id, req.familyId]
    );
    res.json(success({ updated: true }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM action_items WHERE id = ? AND family_id = ?', [req.params.id, req.familyId]);
    res.json(success({ deleted: true }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

module.exports = router;
