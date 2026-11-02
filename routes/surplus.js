
const express = require('express');
const router = express.Router();

const VALID_CATEGORIES = new Set([
  'Cooked Food',
  'Groceries',
  'Bakery',
  'Fruits & Vegetables',
  'Beverages',
  'Other'
]);

const VALID_STATUSES = new Set([
  'AVAILABLE',
  'CLAIMED',
  'REDISTRIBUTED',
  'EXPIRED'
]);

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validatePayload(body, partial = false) {
  const errors = [];

  const required = [
    'food_name',
    'category',
    'quantity',
    'unit',
    'available_until',
    'location'
  ];

  if (!partial) {
    required.forEach((key) => {
      if (
        body[key] === undefined ||
        body[key] === null ||
        String(body[key]).trim() === ''
      ) {
        errors.push(`${key} is required`);
      }
    });
  }

  if (body.food_name !== undefined && !String(body.food_name).trim()) {
    errors.push('Food name cannot be empty');
  }

  if (body.category !== undefined && !VALID_CATEGORIES.has(body.category)) {
    errors.push('Invalid food category');
  }

  if (
    body.quantity !== undefined &&
    (!Number.isFinite(Number(body.quantity)) || Number(body.quantity) <= 0)
  ) {
    errors.push('Quantity must be greater than 0');
  }

  if (body.unit !== undefined && !String(body.unit).trim()) {
    errors.push('Unit cannot be empty');
  }

  if (
    body.available_until !== undefined &&
    Number.isNaN(Date.parse(body.available_until))
  ) {
    errors.push('available_until must be a valid date/time');
  }

  if (
    body.available_until !== undefined &&
    !Number.isNaN(Date.parse(body.available_until)) &&
    new Date(body.available_until) <= new Date()
  ) {
    errors.push('available_until must be in the future');
  }

  if (body.location !== undefined && !String(body.location).trim()) {
    errors.push('Location cannot be empty');
  }

  return errors;
}

async function expireListing(pool, id) {
  await pool.query(
    `UPDATE surplus_food
     SET status = 'EXPIRED', updated_at = NOW()
     WHERE id = $1
       AND status = 'AVAILABLE'
       AND available_until <= NOW()`,
    [id]
  );
}

// CREATE FOOD LISTING
router.post('/', async (req, res, next) => {
  const errors = validatePayload(req.body || {});

  if (errors.length) {
    return res.status(400).json({
      success: false,
      message: errors.join('; ')
    });
  }

  const {
    food_name,
    category,
    quantity,
    unit,
    available_until,
    location,
    description = ''
  } = req.body;

  try {
    const result = await req.app.locals.pool.query(
      `INSERT INTO surplus_food
       (user_id, food_name, category, quantity, unit,
        available_until, location, description, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'AVAILABLE')
       RETURNING *`,
      [
        req.user.id,
        food_name.trim(),
        category,
        Number(quantity),
        unit.trim(),
        new Date(available_until),
        location.trim(),
        String(description).trim()
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Surplus food listed successfully',
      surplus: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// GET FOOD LISTINGS
router.get('/', async (req, res, next) => {
  const { location, status, category, mine } = req.query;

  if (status && !VALID_STATUSES.has(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status filter'
    });
  }

  try {
    const pool = req.app.locals.pool;

    await pool.query(
      `UPDATE surplus_food
       SET status = 'EXPIRED', updated_at = NOW()
       WHERE status = 'AVAILABLE'
         AND available_until <= NOW()`
    );

    const values = [];
    const conditions = [];

    if (location) {
      values.push(location.trim());
      conditions.push(`LOWER(s.location) = LOWER($${values.length})`);
    }

    if (status) {
      values.push(status);
      conditions.push(`s.status = $${values.length}`);
    }

    if (category) {
      values.push(category);
      conditions.push(`s.category = $${values.length}`);
    }

    if (mine === 'true') {
      values.push(req.user.id);
      conditions.push(`s.user_id = $${values.length}`);
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await pool.query(
      `SELECT s.*, u.name AS owner_name
       FROM surplus_food s
       JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY s.created_at DESC`,
      values
    );

    res.json({
      success: true,
      surplus: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// GET FOOD LISTING BY ID
router.get('/:id', async (req, res, next) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invalid surplus id'
    });
  }

  try {
    const pool = req.app.locals.pool;

    await expireListing(pool, id);

    const result = await pool.query(
      `SELECT s.*, u.name AS owner_name
       FROM surplus_food s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Food listing not found'
      });
    }

    res.json({
      success: true,
      surplus: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// UPDATE FOOD LISTING - ROLE-BASED ACCESS CONTROL
router.put('/:id', async (req, res, next) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invalid surplus id'
    });
  }

  const errors = validatePayload(req.body || {}, true);

  if (errors.length) {
    return res.status(400).json({
      success: false,
      message: errors.join('; ')
    });
  }

  try {
    const pool = req.app.locals.pool;
    const isAdmin = req.user.role === 'admin';

    await expireListing(pool, id);

    const current = await pool.query(
      'SELECT * FROM surplus_food WHERE id = $1',
      [id]
    );

    if (!current.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Food listing not found'
      });
    }

    // Normal users can edit only their own listings.
    // Admins can edit listings belonging to any user.
    if (!isAdmin && current.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own listings'
      });
    }

    if (!['AVAILABLE', 'EXPIRED'].includes(current.rows[0].status)) {
      return res.status(409).json({
        success: false,
        message: 'Completed listings cannot be modified'
      });
    }

    const b = req.body;

    const merged = {
      food_name: b.food_name ?? current.rows[0].food_name,
      category: b.category ?? current.rows[0].category,
      quantity: b.quantity ?? current.rows[0].quantity,
      unit: b.unit ?? current.rows[0].unit,
      available_until: b.available_until ?? current.rows[0].available_until,
      location: b.location ?? current.rows[0].location,
      description: b.description ?? current.rows[0].description
    };

    const mergedErrors = validatePayload(merged);

    if (mergedErrors.length) {
      return res.status(400).json({
        success: false,
        message: mergedErrors.join('; ')
      });
    }

    const query = isAdmin
      ? `UPDATE surplus_food
         SET food_name=$1, category=$2, quantity=$3, unit=$4,
             available_until=$5, location=$6, description=$7,
             status='AVAILABLE', updated_at=NOW()
         WHERE id=$8
         RETURNING *`
      : `UPDATE surplus_food
         SET food_name=$1, category=$2, quantity=$3, unit=$4,
             available_until=$5, location=$6, description=$7,
             status='AVAILABLE', updated_at=NOW()
         WHERE id=$8 AND user_id=$9
         RETURNING *`;

    const values = [
      String(merged.food_name).trim(),
      merged.category,
      Number(merged.quantity),
      String(merged.unit).trim(),
      new Date(merged.available_until),
      String(merged.location).trim(),
      String(merged.description || '').trim(),
      id
    ];

    if (!isAdmin) {
      values.push(req.user.id);
    }

    const result = await pool.query(query, values);

    if (!result.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Food listing not found or access denied'
      });
    }

    res.json({
      success: true,
      message: 'Surplus listing updated',
      surplus: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// DELETE FOOD LISTING - ROLE-BASED ACCESS CONTROL
router.delete('/:id', async (req, res, next) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invalid surplus id'
    });
  }

  try {
    const pool = req.app.locals.pool;
    const isAdmin = req.user.role === 'admin';

    await expireListing(pool, id);

    const current = await pool.query(
      'SELECT * FROM surplus_food WHERE id = $1',
      [id]
    );

    if (!current.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Food listing not found'
      });
    }

    // Normal users can delete only their own listings.
    // Admins can delete listings belonging to any user.
    if (!isAdmin && current.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own listings'
      });
    }

    if (!['AVAILABLE', 'EXPIRED'].includes(current.rows[0].status)) {
      return res.status(409).json({
        success: false,
        message: 'Completed listings cannot be deleted'
      });
    }

    const query = isAdmin
      ? 'DELETE FROM surplus_food WHERE id = $1 RETURNING id'
      : 'DELETE FROM surplus_food WHERE id = $1 AND user_id = $2 RETURNING id';

    const values = isAdmin ? [id] : [id, req.user.id];

    const result = await pool.query(query, values);

    if (!result.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Food listing not found or access denied'
      });
    }

    res.json({
      success: true,
      message: 'Food listing deleted'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
