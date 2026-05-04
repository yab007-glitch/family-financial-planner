const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');

router.use(validateFamily);

router.get('/', async (req, res) => {
  try {
    const milestones = await db.all('SELECT * FROM milestones WHERE family_id = ?', [req.familyId]);
    res.json(success(milestones));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, target_date, status, celebration_plan } = req.body;
    const result = await db.run(
      'INSERT INTO milestones (family_id, name, target_date, status, celebration_plan) VALUES (?, ?, ?, ?, ?)',
      [req.familyId, name, target_date, status || 'Not Started', celebration_plan]
    );
    res.json(success({ id: result.lastID, name, target_date, status }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, target_date, status, celebration_plan } = req.body;
    await db.run(
      'UPDATE milestones SET name=?, target_date=?, status=?, celebration_plan=? WHERE id=? AND family_id=?',
      [name, target_date, status, celebration_plan, req.params.id, req.familyId]
    );
    res.json(success({ updated: true }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM milestones WHERE id = ? AND family_id = ?', [req.params.id, req.familyId]);
    res.json(success({ deleted: true }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

module.exports = router;
