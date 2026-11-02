
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
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Encode data using Base64 URL-safe format.
function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

// Create signed tokens with an expiry time and purpose.
function signToken(user, purpose = 'access', expiresInSeconds = 12 * 60 * 60) {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error('AUTH_SECRET is not configured');
  }

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'user',
    purpose,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encoded = base64Url(JSON.stringify(payload));

  const signature = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('base64url');

  return `${encoded}.${signature}`;
}

// Verify token signature and expiry.
function verifyToken(token) {
  const secret = process.env.AUTH_SECRET;

  if (!secret || !token) return null;

  const parts = token.split('.');

  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('base64url');

  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    )
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    );

    if (
      !payload.id ||
      !payload.exp ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// Generate a temporary five-minute MFA challenge token.
function signMfaChallenge(user) {
  return signToken(user, 'mfa', 5 * 60);
}

// Verify that a token is specifically an MFA challenge.
function verifyMfaChallenge(token) {
  const payload = verifyToken(token);

  return payload && payload.purpose === 'mfa'
    ? payload
    : null;
}

// Protect routes using valid access tokens.
async function authRequired(req, res, next) {
  const header = req.get('Authorization') || '';

  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : null;

  const user = verifyToken(token);

  if (!user || user.purpose !== 'access') {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  try {
    // Fetch the latest role from the database.
    const result = await req.app.locals.pool.query(
      'SELECT id, role FROM users WHERE id = $1',
      [user.id]
    );

    if (!result.rows[0]) {
      return res.status(401).json({
        success: false,
        message: 'User account not found'
      });
    }

    req.user = {
      ...user,
      role: result.rows[0].role
    };

    next();
  } catch (err) {
    next(err);
  }
}

// Make authentication functions available to routes.
app.locals.pool = pool;
app.locals.signToken = signToken;
app.locals.signMfaChallenge = signMfaChallenge;
app.locals.verifyMfaChallenge = verifyMfaChallenge;
app.locals.authRequired = authRequired;

// API health check.
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.json({
      success: true,
      message: 'WasteNot API is running',
      database: 'connected',
      instance: process.env.INSTANCE_ID || 'local'
    });
  } catch (err) {
    console.error('Health check failed:', err.message);

    res.status(503).json({
      success: false,
      message: 'API is running but database is unavailable'
    });
  }
});

// Application routes.
app.use('/api/users', userRoutes);
app.use('/api/surplus', authRequired, surplusRoutes);
app.use('/api/claims', authRequired, claimRoutes);
app.use('/api/organizations', authRequired, organizationRoutes);
app.use('/api/dashboard', authRequired, dashboardRoutes);

// Handle unknown API endpoints.
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// Global error handler.
app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) return next(err);

  res.status(err.status || 500).json({
    success: false,
    message: err.status
      ? err.message
      : 'An unexpected server error occurred'
  });
});

// Serve frontend.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server.
async function start() {
  try {
    if (process.env.DATABASE_URL) {
      await pool.query('SELECT 1');
    }

    app.listen(PORT, () => {
      console.log(`WasteNot server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown.
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

start();
