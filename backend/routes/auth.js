const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { registerValidation, loginValidation, idValidation } = require('../middleware/validation');
const { 
  authLimiter, 
  registrationLimiter, 
  usernameCheckLimiter, 
  passwordResetLimiter, 
  emailVerificationLimiter 
} = require('../middleware/rateLimiting');
// CAPTCHA verification removed for testing
const emailService = require('../services/emailService');
const router = express.Router();

// Register new user
router.post('/register', registrationLimiter, registerValidation, async (req, res) => {
  try {

    const { email, username, password, location, birthday, gender } = req.body;
    
    // Extract birthday fields from object (frontend sends birthday as object)
    const birthday_month = birthday?.month || null;
    const birthday_day = birthday?.day || null;
    const birthday_year = birthday?.year || null;

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = :email OR username = :username',
      { email, username }
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'Email or username is already taken'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const result = await query(
      `INSERT INTO users (email, username, password_hash, location, birthday_month, birthday_day, birthday_year, gender, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [email, username, hashedPassword, location, birthday_month, birthday_day, birthday_year, gender]
    );

    // Get the newly created user data (MySQL2 returns insertId)
    const insertId = result.rows.insertId || result.insertId;
    const userResult = await query(
      'SELECT id, email, username, location, birthday_month, birthday_day, birthday_year, gender, created_at FROM users WHERE id = ?',
      [insertId]
    );
    
    const user = userResult.rows[0];

    // Create default boards for new user
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
      [user.id, user.id, user.id, user.id, user.id, user.id, user.id, user.id, user.id, user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Save session
    await query(
      'INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)] // 7 days
    );

    // Send email verification
    try {
      await emailService.sendVerificationEmail(user.email, user.username, user.id);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails
    }

    res.status(201).json({
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
    console.error('Registration error:', error);
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

    // Find user
    const result = await query(
      'SELECT id, email, username, password_hash, location, birthday_month, birthday_day, birthday_year, gender, created_at, email_verified FROM users WHERE email = ? AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Save session
    await query(
      'INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );

    res.json({
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

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required'
      });
    }
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        error: 'Invalid refresh token'
      });
    }
    
    // Get user
    const result = await query(
      'SELECT id, email, username FROM users WHERE id = ? AND is_active = true',
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'User not found'
      });
    }
    
    const user = result.rows[0];
    
    // Generate new tokens
    const newToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    const newRefreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token: newToken,
      refreshToken: newRefreshToken
    });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Invalid refresh token'
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
      username
    });

  } catch (error) {
    console.error('Username check error:', error);
    res.status(500).json({
      error: 'Username check failed',
    });
  }
});

// Demo login endpoint for testing
router.post('/demo-login', authLimiter, async (req, res) => {
  try {
    // Create or get demo user
    let demoUser = await query(
      'SELECT * FROM users WHERE email = ?',
      ['demo@fashioncolorwheel.com']
    );

    if (demoUser.rows.length === 0) {
      // Create demo user if it doesn't exist
      const hashedPassword = await bcrypt.hash('demo123', 12);
      await query(
        `INSERT INTO users (email, username, password_hash, location, birthday_month, birthday_day, birthday_year, gender, email_verified, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        ['demo@fashioncolorwheel.com', 'demo_user', hashedPassword, 'United States', 'January', 1, 1990, 'Prefer not to say', true]
      );
      
      // Fetch the created user
      demoUser = await query(
        'SELECT * FROM users WHERE email = ?',
        ['demo@fashioncolorwheel.com']
      );
    }

    const user = demoUser.rows[0];
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        username: user.username 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return user data and token
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

// Logout user
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      // Remove session from database
      await query(
        'DELETE FROM user_sessions WHERE session_token = ?',
        [token]
      );
    }

    res.json({
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'Internal server error'
    });
  }
});

// Verify email address
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Verification token required',
        message: 'Please provide a verification token.'
      });
    }

    const result = await emailService.verifyEmailToken(token);

    if (!result.success) {
      return res.status(400).json({
        error: 'Verification failed',
        message: result.error
      });
    }

    res.json({
      message: 'Email verified successfully',
      user: {
        id: result.userId,
        email: result.email,
        username: result.username,
        emailVerified: true
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Email verification failed',
      message: 'Internal server error'
    });
  }
});

// Resend email verification
router.post('/resend-verification', emailVerificationLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email required',
        message: 'Please provide an email address.'
      });
    }

    // Find user
    const result = await query(
      'SELECT id, email, username, email_verified FROM users WHERE email = ? AND is_active = true',
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found with this email address.'
      });
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return res.status(400).json({
        error: 'Email already verified',
        message: 'This email address is already verified.'
      });
    }

    // Send verification email
    await emailService.sendVerificationEmail(user.email, user.username, user.id);

    res.json({
      message: 'Verification email sent',
      email: user.email
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      error: 'Failed to resend verification',
      message: 'Internal server error'
    });
  }
});

// Request password reset
router.post('/request-password-reset', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email required',
        message: 'Please provide an email address.'
      });
    }

    // Find user
    const result = await query(
      'SELECT id, email, username FROM users WHERE email = ? AND is_active = true',
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      // Don't reveal if email exists or not for security
      return res.json({
        message: 'If an account with this email exists, a password reset link has been sent.'
      });
    }

    const user = result.rows[0];

    // Send password reset email
    await emailService.sendPasswordResetEmail(user.email, user.username, user.id);

    res.json({
      message: 'If an account with this email exists, a password reset link has been sent.'
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      error: 'Password reset request failed',
      message: 'Internal server error'
    });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: 'Token and new password required',
        message: 'Please provide both reset token and new password.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Password too short',
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Verify reset token
    const tokenResult = await emailService.verifyResetToken(token);

    if (!tokenResult.success) {
      return res.status(400).json({
        error: 'Invalid reset token',
        message: tokenResult.error
      });
    }

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    await query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, tokenResult.userId]
    );

    // Mark reset token as used
    await emailService.markResetTokenUsed(token);

    // Invalidate all existing sessions for security
    await query(
      'DELETE FROM user_sessions WHERE user_id = ?',
      [tokenResult.userId]
    );

    res.json({
      message: 'Password reset successful',
      user: {
        id: tokenResult.userId,
        email: tokenResult.email,
        username: tokenResult.username
      }
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      error: 'Password reset failed',
      message: 'Internal server error'
    });
  }
});

module.exports = router;
