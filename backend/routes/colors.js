const express = require('express');
const { body, query: queryValidator, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Valid color schemes
const VALID_SCHEMES = ['complementary', 'analogous', 'triadic', 'tetradic', 'monochromatic'];

// Helper function to validate hex color
const isValidHexColor = (color) => /^#[0-9A-F]{6}$/i.test(color);

// Helper function to parse and cap pagination params
const parsePagination = (limit, offset, maxLimit = 100) => {
  const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), maxLimit);
  const parsedOffset = Math.max(parseInt(offset) || 0, 0);
  return { limit: parsedLimit, offset: parsedOffset };
};

// Custom validator for colors array
const validateColorsArray = (colors) => {
  if (!Array.isArray(colors)) {
    throw new Error('Colors must be an array');
  }
  if (colors.length < 1 || colors.length > 12) {
    throw new Error('Colors array must contain 1-12 items');
  }
  if (!colors.every(color => typeof color === 'string' && isValidHexColor(color))) {
    throw new Error('All colors must be valid hex format (#RRGGBB)');
  }
  return true;
};

// Get all color matches for a user
router.get('/', [
  authenticateToken,
  queryValidator('scheme').optional().isIn(VALID_SCHEMES).withMessage('Invalid color scheme'),
  queryValidator('privacy').optional().isIn(['private', 'public']).withMessage('Privacy must be private or public')
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
    const { privacy, scheme } = req.query;
    const { limit, offset } = parsePagination(req.query.limit, req.query.offset, 100);

    let queryText = `
      SELECT cm.*, u.username 
      FROM color_matches cm 
      JOIN users u ON cm.user_id = u.id 
      WHERE cm.user_id = ?
    `;
    const queryParams = [userId];
    let paramCount = 1;

    if (privacy) {
      queryText += ` AND cm.privacy = $${++paramCount}`;
      queryParams.push(privacy);
    }

    if (scheme) {
      queryText += ` AND cm.scheme = $${++paramCount}`;
      queryParams.push(scheme);
    }

    queryText += ` ORDER BY cm.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    queryParams.push(limit, offset);

    const result = await query(queryText, queryParams);

    res.json({
      colorMatches: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Get color matches error:', error);
    res.status(500).json({
      error: 'Failed to fetch color matches',
      message: 'Internal server error'
    });
  }
});

// Get public color matches (for discover feed)
router.get('/public', [
  queryValidator('scheme').optional().isIn(VALID_SCHEMES).withMessage('Invalid color scheme')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { scheme } = req.query;
    const { limit, offset } = parsePagination(req.query.limit, req.query.offset, 50);

    let queryText = `
      SELECT cm.*, u.username 
      FROM color_matches cm 
      JOIN users u ON cm.user_id = u.id 
      WHERE cm.privacy = 'public'
    `;
    const queryParams = [];
    let paramCount = 0;

    if (scheme) {
      queryText += ` AND cm.scheme = $${++paramCount}`;
      queryParams.push(scheme);
    }

    queryText += ` ORDER BY cm.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    queryParams.push(limit, offset);

    const result = await query(queryText, queryParams);

    res.json({
      colorMatches: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Get public color matches error:', error);
    res.status(500).json({
      error: 'Failed to fetch public color matches',
      message: 'Internal server error'
    });
  }
});

// Create new color match
router.post('/', [
  authenticateToken,
  body('base_color').matches(/^#[0-9A-F]{6}$/i).withMessage('Base color must be valid hex format (#RRGGBB)'),
  body('scheme').isIn(VALID_SCHEMES).withMessage('Invalid color scheme'),
  body('colors').custom(validateColorsArray),
  body('privacy').optional().isIn(['private', 'public']).withMessage('Privacy must be private or public'),
  body('is_locked').optional().isBoolean().withMessage('is_locked must be a boolean'),
  body('locked_color').custom((value, { req }) => {
    if (req.body.is_locked === true) {
      if (!value || !isValidHexColor(value)) {
        throw new Error('locked_color must be a valid hex color when is_locked is true');
      }
    }
    return true;
  })
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
    const { base_color, scheme, colors, privacy = 'private', is_locked = false, locked_color } = req.body;

    const result = await query(
      `INSERT INTO color_matches (user_id, base_color, scheme, colors, privacy, is_locked, locked_color)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [userId, base_color, scheme, JSON.stringify(colors), privacy, is_locked, locked_color]
    );

    res.status(201).json({
      message: 'Color match created successfully',
      colorMatch: result.rows[0]
    });

  } catch (error) {
    console.error('Create color match error:', error);
    res.status(500).json({
      error: 'Failed to create color match',
      message: 'Internal server error'
    });
  }
});

// Update color match
router.put('/:id', [
  authenticateToken,
  body('privacy').optional().isIn(['private', 'public'])
], async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { privacy } = req.body;

    // Check if color match belongs to user
    const existingMatch = await query(
      'SELECT id FROM color_matches WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (existingMatch.rows.length === 0) {
      return res.status(404).json({
        error: 'Color match not found',
        message: 'Color match does not exist or you do not have permission to modify it'
      });
    }

    const result = await query(
      'UPDATE color_matches SET privacy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [privacy, id, userId]
    );

    res.json({
      message: 'Color match updated successfully',
      colorMatch: result.rows[0]
    });

  } catch (error) {
    console.error('Update color match error:', error);
    res.status(500).json({
      error: 'Failed to update color match',
      message: 'Internal server error'
    });
  }
});

// Delete color match
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM color_matches WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Color match not found',
        message: 'Color match does not exist or you do not have permission to delete it'
      });
    }

    res.json({
      message: 'Color match deleted successfully'
    });

  } catch (error) {
    console.error('Delete color match error:', error);
    res.status(500).json({
      error: 'Failed to delete color match',
      message: 'Internal server error'
    });
  }
});

// Like/unlike color match
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Check if already liked
    const existingLike = await query(
      'SELECT id FROM color_match_likes WHERE user_id = ? AND color_match_id = ?',
      [userId, id]
    );

    if (existingLike.rows.length > 0) {
      // Unlike
      await query(
        'DELETE FROM color_match_likes WHERE user_id = ? AND color_match_id = ?',
        [userId, id]
      );
      res.json({ message: 'Color match unliked', liked: false });
    } else {
      // Like
      await query(
        'INSERT INTO color_match_likes (user_id, color_match_id) VALUES (?, ?)',
        [userId, id]
      );
      res.json({ message: 'Color match liked', liked: true });
    }

  } catch (error) {
    console.error('Like color match error:', error);
    res.status(500).json({
      error: 'Failed to like/unlike color match',
      message: 'Internal server error'
    });
  }
});

module.exports = router;
