const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      `SELECT id, email, username, location, birthday_month, birthday_day, birthday_year, gender, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile does not exist'
      });
    }

    const user = result.rows[0];

    res.json({
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
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: 'Internal server error'
    });
  }
});

// Update user profile
router.put('/profile', [
  authenticateToken,
  body('location').optional().trim(),
  body('gender').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user.userId;
    const { location, gender } = req.body;

    const result = await query(
      `UPDATE users 
       SET location = COALESCE($1, location), 
           gender = COALESCE($2, gender),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, email, username, location, birthday_month, birthday_day, birthday_year, gender, updated_at`,
      [location, gender, userId]
    );

    const user = result.rows[0];

    res.json({
      message: 'Profile updated successfully',
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
        updatedAt: user.updated_at
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: 'Internal server error'
    });
  }
});

// Get user preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Create default preferences
      const defaultPrefs = await query(
        `INSERT INTO user_preferences (user_id, notifications_enabled)
         VALUES ($1, true)
         RETURNING *`,
        [userId]
      );
      
      return res.json({
        preferences: defaultPrefs.rows[0]
      });
    }

    res.json({
      preferences: result.rows[0]
    });

  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      error: 'Failed to fetch preferences',
      message: 'Internal server error'
    });
  }
});

// Update user preferences
router.put('/preferences', [
  authenticateToken,
  body('skin_tone').optional().trim(),
  body('favorite_colors').optional().isArray(),
  body('style_personality').optional().trim(),
  body('notifications_enabled').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user.userId;
    const { skin_tone, favorite_colors, style_personality, notifications_enabled } = req.body;

    // Check if preferences exist
    const existing = await query(
      'SELECT id FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    let result;
    if (existing.rows.length === 0) {
      // Create new preferences
      result = await query(
        `INSERT INTO user_preferences (user_id, skin_tone, favorite_colors, style_personality, notifications_enabled)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, skin_tone, JSON.stringify(favorite_colors), style_personality, notifications_enabled]
      );
    } else {
      // Update existing preferences
      result = await query(
        `UPDATE user_preferences 
         SET skin_tone = COALESCE($1, skin_tone),
             favorite_colors = COALESCE($2, favorite_colors),
             style_personality = COALESCE($3, style_personality),
             notifications_enabled = COALESCE($4, notifications_enabled),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $5
         RETURNING *`,
        [skin_tone, JSON.stringify(favorite_colors), style_personality, notifications_enabled, userId]
      );
    }

    res.json({
      message: 'Preferences updated successfully',
      preferences: result.rows[0]
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      error: 'Failed to update preferences',
      message: 'Internal server error'
    });
  }
});

module.exports = router;
