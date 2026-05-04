const db = require('../db/queries');
const { error } = require('../utils/response');

async function getFamilyId(slug) {
  const family = await db.get('SELECT id FROM families WHERE slug = ?', [slug]);
  return family ? family.id : null;
}

async function validateFamily(req, res, next) {
  const familyId = await getFamilyId(req.params.slug);
  if (!familyId) {
    return res.status(404).json(error('Family not found', 404));
  }
  req.familyId = familyId;
  next();
}

module.exports = { validateFamily, getFamilyId };
