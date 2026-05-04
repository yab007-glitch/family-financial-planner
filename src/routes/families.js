const express = require('express');
const router = express.Router();
const db = require('../db/queries');
const { success, error } = require('../utils/response');

router.get('/', async (req, res) => {
  try {
    const families = await db.all('SELECT * FROM families ORDER BY created_at DESC');
    res.json(success(families));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) {
      return res.status(400).json(error('Name and slug are required'));
    }
    const result = await db.run('INSERT INTO families (name, slug) VALUES (?, ?)', [name, slug]);
    res.json(success({ id: result.lastID, name, slug }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const family = await db.get('SELECT * FROM families WHERE slug = ?', [req.params.slug]);
    if (!family) return res.status(404).json(error('Family not found', 404));

    family.members = await db.all('SELECT * FROM members WHERE family_id = ?', [family.id]);
    family.accounts = await db.all('SELECT * FROM accounts WHERE family_id = ?', [family.id]);
    family.debts = await db.all('SELECT * FROM debts WHERE family_id = ?', [family.id]);
    family.insurance = await db.all('SELECT * FROM insurance WHERE family_id = ?', [family.id]);
    family.goals = await db.all('SELECT * FROM goals WHERE family_id = ? ORDER BY priority', [family.id]);
    family.budget = await db.all('SELECT * FROM budget_entries WHERE family_id = ?', [family.id]);
    family.actions = await db.all('SELECT * FROM action_items WHERE family_id = ? ORDER BY phase', [family.id]);
    family.milestones = await db.all('SELECT * FROM milestones WHERE family_id = ?', [family.id]);

    res.json(success(family));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

module.exports = router;
