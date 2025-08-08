const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all color matches for a user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { privacy, scheme, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT cm.*, u.username 
      FROM color_matches cm 
      JOIN users u ON cm.user_id = u.id 
      WHERE cm.user_id = $1
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
router.get('/public', async (req, res) => {
  try {
    const { scheme, limit = 20, offset = 0 } = req.query;

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
  body('base_color').matches(/^#[0-9A-F]{6}$/i),
  body('scheme').isIn(['complementary', 'analogous', 'triadic', 'tetradic', 'monochromatic']),
  body('colors').isArray(),
  body('privacy').optional().isIn(['private', 'public'])
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
       VALUES ($1, $2, $3, $4, $5, $6, $7)
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
      'SELECT id FROM color_matches WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existingMatch.rows.length === 0) {
      return res.status(404).json({
        error: 'Color match not found',
        message: 'Color match does not exist or you do not have permission to modify it'
      });
    }

    const result = await query(
      'UPDATE color_matches SET privacy = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *',
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
      'DELETE FROM color_matches WHERE id = $1 AND user_id = $2 RETURNING id',
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
      'SELECT id FROM color_match_likes WHERE user_id = $1 AND color_match_id = $2',
      [userId, id]
    );

    if (existingLike.rows.length > 0) {
      // Unlike
      await query(
        'DELETE FROM color_match_likes WHERE user_id = $1 AND color_match_id = $2',
        [userId, id]
      );
      res.json({ message: 'Color match unliked', liked: false });
    } else {
      // Like
      await query(
        'INSERT INTO color_match_likes (user_id, color_match_id) VALUES ($1, $2)',
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
