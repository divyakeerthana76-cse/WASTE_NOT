
const express = require('express');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

const router = express.Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    location: row.location,
    created_at: row.created_at,
    role: row.role || 'user',
    mfa_enabled: row.mfa_enabled || false
  };
}

// Derive a separate encryption key from AUTH_SECRET.
function getEncryptionKey() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error('AUTH_SECRET is not configured');
  }

  return crypto.createHash('sha256')
    .update(secret + ':WasteNot-MFA-encryption')
    .digest();
}

// Encrypt MFA secrets using AES-256-GCM.
function encryptSecret(plainText) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64')
  ].join(':');
}

// Decrypt stored MFA secrets.
function decryptSecret(encryptedText) {
  const [ivText, tagText, dataText] = encryptedText.split(':');

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivText, 'base64')
  );

  decipher.setAuthTag(Buffer.from(tagText, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataText, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

function verifyTotp(secret, token) {
  return (
    typeof token === 'string' &&
    /^\d{6}$/.test(token) &&
    speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1
    })
  );
}

// REGISTER USER
router.post('/', async (req, res, next) => {
  const { name, email, password, location } = req.body || {};

  if (!name?.trim() || !email?.trim() || !password || !location?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, password, and location are required'
    });
  }

  if (!emailPattern.test(email.trim())) {
    return res.status(400).json({
      success: false,
      message: 'Enter a valid email address'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters'
    });
  }

  try {
    const pool = req.app.locals.pool;
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, location)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, location, created_at, role, mfa_enabled`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        passwordHash,
        location.trim()
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: cleanUser(result.rows[0])
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    next(err);
  }
});

// LOGIN USER - PASSWORD STEP
router.post('/login', async (req, res, next) => {
  const { email, password } = req.body || {};

  if (!email?.trim() || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Upgrade older bcrypt hashes to cost factor 12.
    const currentCost = Number(user.password.split('$')[2]);

    if (currentCost < 12) {
      const upgradedHash = await bcrypt.hash(password, 12);

      await pool.query(
        'UPDATE users SET password = $1 WHERE id = $2',
        [upgradedHash, user.id]
      );
    }

    const safeUser = cleanUser(user);

    // Do not issue an access token until MFA is verified.
    if (user.mfa_enabled) {
      return res.json({
        success: true,
        mfa_required: true,
        message: 'Enter your authenticator code',
        challengeToken: req.app.locals.signMfaChallenge(safeUser)
      });
    }

    const token = req.app.locals.signToken(safeUser);

    res.json({
      success: true,
      mfa_required: false,
      message: 'Login successful',
      token,
      user: safeUser
    });
  } catch (err) {
    next(err);
  }
});

// MFA SETUP - GENERATE SECRET AND QR CODE
router.post('/mfa/setup', (req, res, next) => {
  return req.app.locals.authRequired(req, res, async () => {
    try {
      const pool = req.app.locals.pool;

      const result = await pool.query(
        'SELECT id, email, mfa_enabled FROM users WHERE id = $1',
        [req.user.id]
      );

      const user = result.rows[0];

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.mfa_enabled) {
        return res.status(409).json({
          success: false,
          message: 'MFA is already enabled'
        });
      }

      const secret = speakeasy.generateSecret({
        name: `WasteNot (${user.email})`,
        issuer: 'WasteNot',
        length: 20
      });

      const encryptedSecret = encryptSecret(secret.base32);

      await pool.query(
        'UPDATE users SET mfa_pending_secret = $1 WHERE id = $2',
        [encryptedSecret, user.id]
      );

      const qrCode = await QRCode.toDataURL(secret.otpauth_url);

      res.json({
        success: true,
        message: 'Scan this QR code with your authenticator app, then verify the code',
        qrCode,
        manualEntryKey: secret.base32
      });
    } catch (err) {
      next(err);
    }
  });
});

// MFA SETUP - VERIFY AND ACTIVATE
router.post('/mfa/verify-setup', (req, res, next) => {
  return req.app.locals.authRequired(req, res, async () => {
    const { token } = req.body || {};

    if (typeof token !== 'string' || !/^\d{6}$/.test(token)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid six-digit authenticator code'
      });
    }

    try {
      const pool = req.app.locals.pool;

      const result = await pool.query(
        'SELECT mfa_pending_secret, mfa_enabled FROM users WHERE id = $1',
        [req.user.id]
      );

      const user = result.rows[0];

      if (!user || !user.mfa_pending_secret || user.mfa_enabled) {
        return res.status(400).json({
          success: false,
          message: 'No pending MFA setup found'
        });
      }

      const secret = decryptSecret(user.mfa_pending_secret);

      if (!verifyTotp(secret, token)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid authenticator code'
        });
      }

      await pool.query(
        `UPDATE users
         SET mfa_secret = mfa_pending_secret,
             mfa_pending_secret = NULL,
             mfa_enabled = TRUE
         WHERE id = $1`,
        [req.user.id]
      );

      res.json({
        success: true,
        message: 'Two-factor authentication enabled successfully'
      });
    } catch (err) {
      next(err);
    }
  });
});

// MFA LOGIN - VERIFY AUTHENTICATOR CODE
router.post('/login/mfa', async (req, res, next) => {
  const { challengeToken, token } = req.body || {};

  if (!challengeToken || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
    return res.status(400).json({
      success: false,
      message: 'Challenge token and six-digit authenticator code are required'
    });
  }

  try {
    const challenge = req.app.locals.verifyMfaChallenge(challengeToken);

    if (!challenge) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired MFA challenge'
      });
    }

    const pool = req.app.locals.pool;

    const result = await pool.query(
      `SELECT id, name, email, location, created_at, role,
              mfa_enabled, mfa_secret
       FROM users WHERE id = $1`,
      [challenge.id]
    );

    const user = result.rows[0];

    if (!user || !user.mfa_enabled || !user.mfa_secret) {
      return res.status(401).json({
        success: false,
        message: 'MFA is not configured for this account'
      });
    }

    const secret = decryptSecret(user.mfa_secret);

    if (!verifyTotp(secret, token)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authenticator code'
      });
    }

    const safeUser = cleanUser(user);
    const accessToken = req.app.locals.signToken(safeUser);

    res.json({
      success: true,
      message: 'MFA verification successful. Login complete.',
      token: accessToken,
      user: safeUser
    });
  } catch (err) {
    next(err);
  }
});

// GET ALL USERS
router.get('/', async (req, res, next) => {
  try {
    const result = await req.app.locals.pool.query(
      `SELECT id, name, email, location, created_at, role, mfa_enabled
       FROM users ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      users: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// GET USER BY ID
router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user id'
    });
  }

  try {
    const result = await req.app.locals.pool.query(
      `SELECT id, name, email, location, created_at, role, mfa_enabled
       FROM users WHERE id = $1`,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
