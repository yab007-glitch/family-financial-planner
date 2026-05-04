const express = require('express');
const router = express.Router();
const db = require('../db/queries');
const { success, error } = require('../utils/response');
const { validateRequired, sanitizeBody, sanitizeString, sanitizeError } = require('../middleware/security');

router.get('/', async (req, res) => {
  try {
    const families = await db.all('SELECT * FROM families ORDER BY created_at DESC');
    res.json(success(families));
  } catch (err) {
    res.status(500).json(error(sanitizeError(err)));
  }
});

router.post('/',
  sanitizeBody(['name', 'slug', 'location', 'tax_situation']),
  validateRequired(['name', 'slug']),
  async (req, res) => {
    try {
      const { name, slug, location, tax_situation } = req.body;

      // Validate slug format (URL-friendly)
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(slug)) {
        return res.status(400).json(error('Slug must contain only lowercase letters, numbers, and hyphens'));
      }

      const result = await db.run(
        'INSERT INTO families (name, slug, location, tax_situation) VALUES (?, ?, ?, ?)',
        [name, slug, location || null, tax_situation || null]
      );
      res.json(success({ id: result.lastID, name, slug }));
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json(error('Family slug already exists'));
      }
      res.status(500).json(error(sanitizeError(err)));
    }
  }
);

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
    res.status(500).json(error(sanitizeError(err)));
  }
});

module.exports = router;
