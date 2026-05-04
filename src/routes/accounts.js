const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateFamily } = require('../middleware/familySlug');

router.use(validateFamily);

router.get('/', async (req, res) => {
  try {
    const accounts = await db.all('SELECT * FROM accounts WHERE family_id = ?', [req.familyId]);
    res.json(success(accounts));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.post('/', async (req, res) => {
  try {
    const { type, institution, balance, contribution_room, notes } = req.body;
    const result = await db.run(
      'INSERT INTO accounts (family_id, type, institution, balance, contribution_room, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [req.familyId, type, institution, balance || 0, contribution_room, notes]
    );
    res.json(success({ id: result.lastID, type, institution, balance }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { type, institution, balance, contribution_room, notes } = req.body;
    await db.run(
      'UPDATE accounts SET type=?, institution=?, balance=?, contribution_room=?, notes=? WHERE id=? AND family_id=?',
      [type, institution, balance || 0, contribution_room, notes, req.params.id, req.familyId]
    );
    res.json(success({ updated: true }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM accounts WHERE id = ? AND family_id = ?', [req.params.id, req.familyId]);
    res.json(success({ deleted: true }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

module.exports = router;
