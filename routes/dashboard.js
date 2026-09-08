const express = require('express');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const pool = req.app.locals.pool;
    await pool.query(`UPDATE surplus_food SET status='EXPIRED', updated_at=NOW() WHERE status='AVAILABLE' AND available_until <= NOW()`);
    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS "totalListings",
        COUNT(*) FILTER (WHERE status='AVAILABLE')::int AS "availableListings",
        COUNT(*) FILTER (WHERE status='CLAIMED')::int AS "claimedListings",
        COUNT(*) FILTER (WHERE status='REDISTRIBUTED')::int AS "redistributedListings"
      FROM surplus_food
    `);
    const waste = await pool.query(`SELECT COALESCE(SUM(quantity),0)::numeric AS "foodWastePrevented" FROM claims WHERE status='COMPLETED'`);
    res.json({ success: true, ...result.rows[0], foodWastePrevented: Number(waste.rows[0].foodWastePrevented) });
  } catch (err) { next(err); }
});

module.exports = router;
