const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');

router.use(validateFamily);

router.get('/', async (req, res) => {
  try {
    const members = await db.all('SELECT * FROM members WHERE family_id = ?', [req.familyId]);
    res.json(success(members));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, role, age, notes } = req.body;
    const result = await db.run(
      'INSERT INTO members (family_id, name, role, age, notes) VALUES (?, ?, ?, ?, ?)',
      [req.familyId, name, role, age || null, notes]
    );
    res.json(success({ id: result.lastID, name, role, age, notes }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, role, age, notes } = req.body;
    await db.run(
      'UPDATE members SET name=?, role=?, age=?, notes=? WHERE id=? AND family_id=?',
      [name, role, age || null, notes, req.params.id, req.familyId]
    );
    res.json(success({ updated: true }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM members WHERE id = ? AND family_id = ?', [req.params.id, req.familyId]);
    res.json(success({ deleted: true }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

module.exports = router;
