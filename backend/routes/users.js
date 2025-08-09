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
       FROM users WHERE id = ?`,
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
       SET location = COALESCE(?, location), 
           gender = COALESCE(?, gender),
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [location, gender, userId]
    );

    // Get updated user data
    const userResult = await query(
      'SELECT id, email, username, location, birthday_month, birthday_day, birthday_year, gender, updated_at FROM users WHERE id = ?',
      [userId]
    );

    const user = userResult.rows[0];

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
      'SELECT * FROM user_preferences WHERE user_id = ?',
      [userId]
    );

    if (result.rows.length === 0) {
      // Create default preferences
      const defaultPrefs = await query(
        `INSERT INTO user_preferences (user_id, notifications_enabled)
         VALUES (?, true)`,
        [userId]
      );
      
      // Get the newly created preferences
      const newPrefsResult = await query(
        'SELECT * FROM user_preferences WHERE user_id = ?',
        [userId]
      );
      
      return res.json({
        preferences: newPrefsResult.rows[0]
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
      'SELECT id FROM user_preferences WHERE user_id = ?',
      [userId]
    );

    let result;
    if (existing.rows.length === 0) {
      // Create new preferences
      await query(
        `INSERT INTO user_preferences (user_id, skin_tone, favorite_colors, style_personality, notifications_enabled)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, skin_tone, JSON.stringify(favorite_colors), style_personality, notifications_enabled]
      );
      
      // Get the newly created preferences
      result = await query(
        'SELECT * FROM user_preferences WHERE user_id = ?',
        [userId]
      );
    } else {
      // Update existing preferences
      result = await query(
        `UPDATE user_preferences 
         SET skin_tone = COALESCE(?, skin_tone),
             favorite_colors = COALESCE(?, favorite_colors),
             style_personality = COALESCE(?, style_personality),
             notifications_enabled = COALESCE(?, notifications_enabled),
             updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = ?`,
        [skin_tone, JSON.stringify(favorite_colors), style_personality, notifications_enabled, userId]
      );
      
      // Get updated preferences
      result = await query(
        'SELECT * FROM user_preferences WHERE user_id = ?',
        [userId]
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

// Update user settings (for UserSettingsScreen toggles)
router.put('/settings', [
  authenticateToken,
  body('notifications').optional().isBoolean(),
  body('share_usage').optional().isBoolean()
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
    const { notifications, share_usage } = req.body;

    // Check if user_preferences exists
    const existing = await query(
      'SELECT id FROM user_preferences WHERE user_id = ?',
      [userId]
    );

    let result;
    if (existing.rows.length === 0) {
      // Create new preferences with settings
      await query(
        `INSERT INTO user_preferences (user_id, notifications_enabled, share_usage_data)
         VALUES (?, ?, ?)`,
        [userId, notifications !== undefined ? notifications : true, share_usage !== undefined ? share_usage : false]
      );
      
      // Get the newly created preferences
      result = await query(
        'SELECT * FROM user_preferences WHERE user_id = ?',
        [userId]
      );
    } else {
      // Update existing preferences
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (notifications !== undefined) {
        updates.push(`notifications_enabled = ?`);
        values.push(notifications);
      }

      if (share_usage !== undefined) {
        updates.push(`share_usage_data = ?`);
        values.push(share_usage);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: 'No settings to update',
          message: 'Please provide at least one setting to update'
        });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId);

      await query(
        `UPDATE user_preferences 
         SET ${updates.join(', ')}
         WHERE user_id = ?`,
        values
      );
      
      // Get updated preferences
      result = await query(
        'SELECT * FROM user_preferences WHERE user_id = ?',
        [userId]
      );
    }

    res.json({
      message: 'Settings updated successfully',
      settings: {
        notifications: result.rows[0].notifications_enabled,
        share_usage: result.rows[0].share_usage_data
      }
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      error: 'Failed to update settings',
      message: 'Internal server error'
    });
  }
});

// Request data export
router.post('/export-data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user info for email
    const userResult = await query(
      'SELECT email, username FROM users WHERE id = ?',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User account does not exist'
      });
    }

    const user = userResult.rows[0];

    // In a real implementation, you would:
    // 1. Queue a background job to collect all user data
    // 2. Generate a secure download link
    // 3. Send an email with the download link
    // 4. Set an expiration time for the download

    // For now, we'll simulate the request and log it
    console.log(`📦 Data export requested for user ${user.username} (${user.email})`);

    // TODO: Implement actual data export job
    // - Collect user profile, preferences, color matches, boards, community posts
    // - Generate JSON/CSV export file
    // - Create secure temporary download link
    // - Send email with download instructions

    res.json({
      message: 'Data export requested successfully',
      details: 'You will receive an email with your data export within 24 hours.',
      requestedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Data export request error:', error);
    res.status(500).json({
      error: 'Failed to request data export',
      message: 'Internal server error'
    });
  }
});

module.exports = router;
