const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');

router.use(validateFamily);

router.get('/', async (req, res) => {
  try {
    const goals = await db.all('SELECT * FROM goals WHERE family_id = ? ORDER BY priority', [req.familyId]);
    res.json(success(goals));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.post('/', async (req, res) => {
  try {
    const { timeframe, priority, description, target_amount, current_amount, deadline, status } = req.body;
    const result = await db.run(
      'INSERT INTO goals (family_id, timeframe, priority, description, target_amount, current_amount, deadline, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.familyId, timeframe, priority, description, target_amount || 0, current_amount || 0, deadline, status || 'Not Started']
    );
    res.json(success({ id: result.lastID, description, target_amount }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { timeframe, priority, description, target_amount, current_amount, deadline, status } = req.body;
    await db.run(
      'UPDATE goals SET timeframe=?, priority=?, description=?, target_amount=?, current_amount=?, deadline=?, status=? WHERE id=? AND family_id=?',
      [timeframe, priority, description, target_amount || 0, current_amount || 0, deadline, status, req.params.id, req.familyId]
    );
    res.json(success({ updated: true }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM goals WHERE id = ? AND family_id = ?', [req.params.id, req.familyId]);
    res.json(success({ deleted: true }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

module.exports = router;
