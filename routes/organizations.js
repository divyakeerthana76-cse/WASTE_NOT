const express = require('express');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const values = [];
    let where = '';
    if (req.query.location) { values.push(String(req.query.location).trim()); where = 'WHERE LOWER(location)=LOWER($1)'; }
    const result = await req.app.locals.pool.query(`SELECT * FROM organizations ${where} ORDER BY name`, values);
    res.json({ success: true, organizations: result.rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id); if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Invalid organization id' });
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM organizations WHERE id=$1', [id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Organization not found' });
    res.json({ success: true, organization: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
