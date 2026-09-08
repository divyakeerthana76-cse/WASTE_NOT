const express = require('express');
const router = express.Router();

function idOrNull(v) { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; }

router.post('/', async (req, res, next) => {
  const { surplus_id, quantity, claim_type, organization_id = null } = req.body || {};
  const surplusId = idOrNull(surplus_id);
  const qty = Number(quantity);
  const orgId = organization_id === null || organization_id === '' ? null : idOrNull(organization_id);
  if (!surplusId || !Number.isFinite(qty) || qty <= 0) return res.status(400).json({ success: false, message: 'Valid surplus_id and positive quantity are required' });
  if (!['PERSONAL', 'REDISTRIBUTION'].includes(claim_type)) return res.status(400).json({ success: false, message: 'claim_type must be PERSONAL or REDISTRIBUTION' });
  if (claim_type === 'PERSONAL' && orgId !== null) return res.status(400).json({ success: false, message: 'Personal claims cannot include an organization' });
  if (claim_type === 'REDISTRIBUTION' && !orgId) return res.status(400).json({ success: false, message: 'An organization is required for redistribution' });

  const pool = req.app.locals.pool;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const foodResult = await client.query('SELECT * FROM surplus_food WHERE id=$1 FOR UPDATE', [surplusId]);
    const food = foodResult.rows[0];
    if (!food) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Food listing not found' }); }
    if (food.status !== 'AVAILABLE') { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: `Food is no longer available (${food.status})` }); }
    if (new Date(food.available_until) <= new Date()) {
      await client.query(`UPDATE surplus_food SET status='EXPIRED', updated_at=NOW() WHERE id=$1`, [surplusId]);
      await client.query('COMMIT');
      return res.status(409).json({ success: false, message: 'This food listing has expired' });
    }
    if (qty > Number(food.quantity)) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, message: 'Claim quantity cannot exceed available quantity' }); }

    if (claim_type === 'REDISTRIBUTION') {
      const org = await client.query('SELECT id, name, location FROM organizations WHERE id=$1', [orgId]);
      if (!org.rows[0]) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, message: 'Selected organization does not exist' }); }
      if (org.rows[0].location.trim().toLowerCase() !== food.location.trim().toLowerCase()) {
        await client.query('ROLLBACK'); return res.status(400).json({ success: false, message: 'Organization location must match the food location' });
      }
    }

    const existing = await client.query('SELECT id FROM claims WHERE surplus_id=$1 AND status=\'COMPLETED\' LIMIT 1', [surplusId]);
    if (existing.rows[0]) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'This food has already been claimed or redistributed' }); }

    const claim = await client.query(
      `INSERT INTO claims (surplus_id, user_id, organization_id, quantity, claim_type, status, claimed_at)
       VALUES ($1,$2,$3,$4,$5,'COMPLETED',NOW()) RETURNING *`,
      [surplusId, req.user.id, orgId, qty, claim_type]
    );
    const newStatus = claim_type === 'PERSONAL' ? 'CLAIMED' : 'REDISTRIBUTED';
    await client.query(`UPDATE surplus_food SET status=$1, updated_at=NOW() WHERE id=$2`, [newStatus, surplusId]);
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: claim_type === 'PERSONAL' ? 'Food claimed successfully' : 'Food redistributed successfully', claim: claim.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'This food has already been claimed' });
    next(err);
  } finally { client.release(); }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await req.app.locals.pool.query(
      `SELECT c.*, s.food_name, s.unit, s.location AS food_location, u.name AS claimant_name, o.name AS organization_name
       FROM claims c JOIN surplus_food s ON s.id=c.surplus_id JOIN users u ON u.id=c.user_id
       LEFT JOIN organizations o ON o.id=c.organization_id
       WHERE c.user_id=$1 OR s.user_id=$1 ORDER BY c.claimed_at DESC`, [req.user.id]
    );
    res.json({ success: true, claims: result.rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  const id = idOrNull(req.params.id); if (!id) return res.status(400).json({ success: false, message: 'Invalid claim id' });
  try {
    const result = await req.app.locals.pool.query(
      `SELECT c.*, s.food_name, s.unit, s.location AS food_location, u.name AS claimant_name, o.name AS organization_name
       FROM claims c JOIN surplus_food s ON s.id=c.surplus_id JOIN users u ON u.id=c.user_id LEFT JOIN organizations o ON o.id=c.organization_id WHERE c.id=$1`, [id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Claim not found' });
    const row = result.rows[0];
    if (row.user_id !== req.user.id && row.surplus_owner_id !== req.user.id) {
      const owner = await req.app.locals.pool.query('SELECT user_id FROM surplus_food WHERE id=$1', [row.surplus_id]);
      if (!owner.rows[0] || owner.rows[0].user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized to view this claim' });
    }
    res.json({ success: true, claim: row });
  } catch (err) { next(err); }
});

module.exports = router;
