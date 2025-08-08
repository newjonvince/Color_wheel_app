const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { registerValidation, loginValidation, idValidation } = require('../middleware/validation');
const router = express.Router();

// Register new user
router.post('/register', registerValidation, async (req, res) => {
  try {

    const { email, username, password, location, birthday_month, birthday_day, birthday_year, gender } = req.body;

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'Email or username is already taken'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await query(
      `INSERT INTO users (email, username, password_hash, location, birthday_month, birthday_day, birthday_year, gender)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, username, location, birthday_month, birthday_day, birthday_year, gender, created_at`,
      [email, username, passwordHash, location, birthday_month, birthday_day, birthday_year, gender]
    );

    const user = result.rows[0];

    // Create default boards for new user
    await query(
      `INSERT INTO boards (user_id, name, type, scheme) VALUES
       ($1, 'Private Complementary', 'private', 'complementary'),
       ($1, 'Private Analogous', 'private', 'analogous'),
       ($1, 'Private Triadic', 'private', 'triadic'),
       ($1, 'Private Tetradic', 'private', 'tetradic'),
       ($1, 'Private Monochromatic', 'private', 'monochromatic'),
       ($1, 'Public Complementary', 'public', 'complementary'),
       ($1, 'Public Analogous', 'public', 'analogous'),
       ($1, 'Public Triadic', 'public', 'triadic'),
       ($1, 'Public Tetradic', 'public', 'tetradic'),
       ($1, 'Public Monochromatic', 'public', 'monochromatic')`,
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Save session
    await query(
      'INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)] // 7 days
    );

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
        createdAt: user.created_at
      },
      token
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
router.post('/login', loginValidation, async (req, res) => {
  try {

    const { email, password } = req.body;

    // Find user
    const result = await query(
      'SELECT id, email, username, password_hash, location, birthday_month, birthday_day, birthday_year, gender, created_at FROM users WHERE email = $1 AND is_active = true',
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
      'INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES ($1, $2, $3)',
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
        createdAt: user.created_at
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
      'SELECT id, email, username FROM users WHERE id = $1 AND is_active = true',
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
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const result = await query(
      'SELECT id FROM users WHERE username = $1',
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
      message: 'Internal server error'
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
        'DELETE FROM user_sessions WHERE session_token = $1',
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

module.exports = router;
