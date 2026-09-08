const express = require('express');
const bcrypt = require('bcrypt');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanUser(row) {
  return { id: row.id, name: row.name, email: row.email, location: row.location, created_at: row.created_at };
}

router.post('/', async (req, res, next) => {
  const { name, email, password, location } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password || !location?.trim()) {
    return res.status(400).json({ success: false, message: 'Name, email, password, and location are required' });
  }
  if (!emailPattern.test(email.trim())) return res.status(400).json({ success: false, message: 'Enter a valid email address' });
  if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

  try {
    const pool = req.app.locals.pool;
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, location) VALUES ($1, $2, $3, $4) RETURNING id, name, email, location, created_at`,
      [name.trim(), email.trim().toLowerCase(), passwordHash, location.trim()]
    );
    res.status(201).json({ success: true, message: 'Registration successful', user: cleanUser(result.rows[0]) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email?.trim() || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ success: false, message: 'Invalid email or password' });
    const safeUser = cleanUser(user);
    const token = req.app.locals.signToken(safeUser);
    res.json({ success: true, message: 'Login successful', token, user: safeUser });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await req.app.locals.pool.query('SELECT id, name, email, location, created_at FROM users ORDER BY created_at DESC');
    res.json({ success: true, users: result.rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Invalid user id' });
  try {
    const result = await req.app.locals.pool.query('SELECT id, name, email, location, created_at FROM users WHERE id = $1', [id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
