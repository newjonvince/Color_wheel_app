const express = require('express'); 
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { registerValidation, loginValidation, idValidation } = require('../middleware/validation');
const { 
  authLimiter, 
  registrationLimiter, 
  usernameCheckLimiter, 
  passwordResetLimiter, 
  emailVerificationLimiter 
} = require('../middleware/rateLimiting');
const { authenticateToken } = require('../middleware/auth');
const { generateSecureToken, createSessionData } = require('../utils/jwt');
const emailService = require('../services/emailService');
const router = express.Router();

// Register new user
router.post('/register', registrationLimiter, registerValidation, async (req, res) => {
  try {
    const { email, username, password, location, birthday, gender } = req.body;
    const birthday_month = birthday?.month || null;
    const birthday_day = parseInt(birthday?.day) || null;
    const birthday_year = parseInt(birthday?.year) || null;

    const existingUser = await query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'Email or username is already taken'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    // Generate UUID in app code for consistent behavior
    const userId = uuidv4();
    
    // Insert user with app-generated UUID
    await query(
      `INSERT INTO users (id, email, username, password_hash, location, birthday_month, birthday_day, birthday_year, gender, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, email, username, hashedPassword, location, birthday_month, birthday_day, birthday_year, gender]
    );
    
    // Fetch by unique email to retrieve the newly created user
    const userResult = await query(
      'SELECT id, email, username, location, birthday_month, birthday_day, birthday_year, gender, created_at FROM users WHERE email = ?',
      [email]
    );
    const user = userResult.rows[0];

    await query(
      `INSERT INTO boards (user_id, name, type, scheme) VALUES
       (?, 'Private Complementary', 'private', 'complementary'),
       (?, 'Private Analogous', 'private', 'analogous'),
       (?, 'Private Triadic', 'private', 'triadic'),
       (?, 'Private Tetradic', 'private', 'tetradic'),
       (?, 'Private Monochromatic', 'private', 'monochromatic'),
       (?, 'Public Complementary', 'public', 'complementary'),
       (?, 'Public Analogous', 'public', 'analogous'),
       (?, 'Public Triadic', 'public', 'triadic'),
       (?, 'Public Tetradic', 'public', 'tetradic'),
       (?, 'Public Monochromatic', 'public', 'monochromatic')`,
      Array(10).fill(user.id)
    );

    // Generate secure JWT with JTI and enhanced security
    const { token, jti, expiresAt } = generateSecureToken(
      { userId: user.id, email: user.email }
    );

    // Create session data with JTI for secure lookup
    const sessionData = createSessionData({
      userId: user.id,
      jti,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    await query(
      'INSERT INTO user_sessions (user_id, session_token, jti, expires_at, ip_address, user_agent, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [sessionData.user_id, token, sessionData.jti, sessionData.expires_at, sessionData.ip_address, sessionData.user_agent, sessionData.created_at, sessionData.revoked_at]
    );

    try {
      await emailService.sendVerificationEmail(user.email, user.username, user.id);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        location: user.location,
        birthday: {
          month: user.birthday_month,
          day: user.birthday_day,
          year: user.birthday_year
        },
        gender: user.gender,
        createdAt: user.created_at,
        emailVerified: false
      },
      token,
      emailVerificationSent: true
    });
  } catch (error) {
    // Handle duplicate key (email/username) gracefully and log details
    if (error && (error.code === 'ER_DUP_ENTRY' || /duplicate/i.test(String(error.message)))) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'Email or username is already taken'
      });
    }
    console.error('Registration error:', { message: error.message, code: error.code, stack: error.stack });
    res.status(500).json({
      error: 'Registration failed',
      message: 'Internal server error'
    });
  }
});

// Login user
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await query(
      'SELECT id, email, username, password_hash, location, birthday_month, birthday_day, birthday_year, gender, created_at, email_verified FROM users WHERE email = ?',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials', message: 'Email or password is incorrect' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials', message: 'Email or password is incorrect' });
    }

    // Generate secure JWT with JTI and enhanced security
    const { token, jti, expiresAt } = generateSecureToken(
      { userId: user.id, email: user.email }
    );

    // Create session data with JTI for secure lookup
    const sessionData = createSessionData({
      userId: user.id,
      jti,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    await query(
      'INSERT INTO user_sessions (user_id, session_token, jti, expires_at, ip_address, user_agent, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [sessionData.user_id, token, sessionData.jti, sessionData.expires_at, sessionData.ip_address, sessionData.user_agent, sessionData.created_at, sessionData.revoked_at]
    );

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        location: user.location,
        birthday: {
          month: user.birthday_month,
          day: user.birthday_day,
          year: user.birthday_year
        },
        gender: user.gender,
        createdAt: user.created_at,
        emailVerified: user.email_verified || false
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Internal server error'
    });
  }
});

// Demo login endpoint
router.post('/demo-login', authLimiter, async (req, res) => {
  try {
    let demoUser = await query(
      'SELECT * FROM users WHERE email = ?',
      ['demo@fashioncolorwheel.com']
    );
    if (demoUser.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('demo123', 12);
      const userId = uuidv4();
      await query(
        `INSERT INTO users (id, email, username, password_hash, location, birthday_month, birthday_day, birthday_year, gender, email_verified, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [userId, 'demo@fashioncolorwheel.com', 'demo_user', hashedPassword, 'United States', 'January', 1, 1990, 'Prefer not to say', true]
      );
      demoUser = await query(
        'SELECT * FROM users WHERE email = ?',
        ['demo@fashioncolorwheel.com']
      );
    }
    const user = demoUser.rows[0];
    
    // Generate secure JWT with JTI and enhanced security
    const { token, jti, expiresAt } = generateSecureToken(
      { userId: user.id, email: user.email, username: user.username }
    );

    // Create session data with JTI for secure lookup
    const sessionData = createSessionData({
      userId: user.id,
      jti,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    await query(
      'INSERT INTO user_sessions (user_id, session_token, jti, expires_at, ip_address, user_agent, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [sessionData.user_id, token, sessionData.jti, sessionData.expires_at, sessionData.ip_address, sessionData.user_agent, sessionData.created_at, sessionData.revoked_at]
    );

    res.json({
      success: true,
      message: 'Demo login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        location: user.location,
        birthday: {
          month: user.birthday_month,
          day: user.birthday_day,
          year: user.birthday_year
        },
        gender: user.gender,
        createdAt: user.created_at,
        demo: true
      },
      token
    });
  } catch (error) {
    console.error('Demo login error:', error);
    res.status(500).json({
      success: false,
      error: 'Demo login failed',
      message: 'Unable to create demo session. Please try again.'
    });
  }
});


// Check username availability
router.get('/check-username/:username', usernameCheckLimiter, async (req, res) => {
  try {
    const { username } = req.params;
    const result = await query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    
    res.json({
      available: result.rows.length === 0,
      message: result.rows.length === 0 ? 'Username is available' : 'Username is already taken'
    });
  } catch (error) {
    console.error('Username check error:', error);
    res.status(500).json({
      error: 'Username check failed',
      message: 'Internal server error'
    });
  }
});

// Token refresh endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token (implement your refresh token logic here)
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const newToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token: newToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Invalid refresh token',
      message: 'Token refresh failed'
    });
  }
});

// Email verification endpoint
router.post('/verify-email', emailVerificationLimiter, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    const verification = await query(
      'SELECT * FROM email_verifications WHERE token = ? AND expires_at > NOW() AND verified_at IS NULL',
      [token]
    );

    if (verification.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired token',
        message: 'Email verification failed'
      });
    }

    const verificationRecord = verification.rows[0];
    
    // Mark email as verified
    await query(
      'UPDATE users SET email_verified = true, email_verified_at = NOW() WHERE id = ?',
      [verificationRecord.user_id]
    );

    // Mark verification as used
    await query(
      'UPDATE email_verifications SET verified_at = NOW() WHERE id = ?',
      [verificationRecord.id]
    );

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Email verification failed',
      message: 'Internal server error'
    });
  }
});

// Password reset request
router.post('/reset-password', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await query(
      'SELECT id, email, username FROM users WHERE email = ?',
      [email]
    );

    if (user.rows.length === 0) {
      // Don't reveal if email exists for security
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    const userData = user.rows[0];
    
    try {
      await emailService.sendPasswordResetEmail(userData.email, userData.username, userData.id);
      res.json({
        success: true,
        message: 'Password reset link has been sent to your email.'
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      res.status(500).json({
        error: 'Failed to send reset email',
        message: 'Please try again later'
      });
    }
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      error: 'Password reset failed',
      message: 'Internal server error'
    });
  }
});

// Profile endpoint alias for frontend compatibility
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await query(
      'SELECT id, email, username, location, birthday_month, birthday_day, birthday_year, gender, created_at, email_verified FROM users WHERE id = ?',
      [req.user.userId]
    );
    
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = user.rows[0];
    res.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        location: userData.location,
        birthday: {
          month: userData.birthday_month,
          day: userData.birthday_day,
          year: userData.birthday_year
        },
        gender: userData.gender,
        createdAt: userData.created_at,
        emailVerified: userData.email_verified || false
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

module.exports = router;
