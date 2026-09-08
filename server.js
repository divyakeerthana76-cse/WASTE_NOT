require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { Pool } = require('pg');

const userRoutes = require('./routes/users');
const surplusRoutes = require('./routes/surplus');
const claimRoutes = require('./routes/claims');
const organizationRoutes = require('./routes/organizations');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set. Configure .env before using database features.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => console.error('Unexpected PostgreSQL pool error:', err.message));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function signToken(user) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not configured');
  const payload = { id: user.id, name: user.name, email: user.email, iat: Date.now() };
  const encoded = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.id) return null;
    return payload;
  } catch {
    return null;
  }
}

function authRequired(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });
  req.user = user;
  next();
}

app.locals.pool = pool;
app.locals.signToken = signToken;

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'WasteNot API is running', database: 'connected' });
  } catch (err) {
    console.error('Health check failed:', err.message);
    res.status(503).json({ success: false, message: 'API is running but database is unavailable' });
  }
});

app.use('/api/users', userRoutes);
app.use('/api/surplus', authRequired, surplusRoutes);
app.use('/api/claims', authRequired, claimRoutes);
app.use('/api/organizations', authRequired, organizationRoutes);
app.use('/api/dashboard', authRequired, dashboardRoutes);

app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'API endpoint not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.status ? err.message : 'An unexpected server error occurred'
  });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

async function start() {
  try {
    if (process.env.DATABASE_URL) await pool.query('SELECT 1');
    app.listen(PORT, () => console.log(`WasteNot server listening on port ${PORT}`));
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', async () => { await pool.end(); process.exit(0); });
process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });

start();
