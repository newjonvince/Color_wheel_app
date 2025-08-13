const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all boards for a user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type } = req.query; // private or public

    let queryText = 'SELECT * FROM boards WHERE user_id = ?';
    const queryParams = [userId];

    if (type) {
      queryText += ' AND type = ?';
      queryParams.push(type);
    }

    queryText += ' ORDER BY scheme, name';

    const result = await query(queryText, queryParams);

    res.json({
      boards: result.rows
    });

  } catch (error) {
    console.error('Get boards error:', error);
    res.status(500).json({
      error: 'Failed to fetch boards',
      message: 'Internal server error'
    });
  }
});

// Get board items (color matches in a board)
router.get('/:boardId/items', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { boardId } = req.params;

    // Verify board belongs to user
    const boardCheck = await query(
      'SELECT id FROM boards WHERE id = ? AND user_id = ?',
      [boardId, userId]
    );

    if (boardCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Board not found',
        message: 'Board does not exist or you do not have access to it'
      });
    }

    const result = await query(
      `SELECT cm.*, bi.added_at 
       FROM board_items bi 
       JOIN color_matches cm ON bi.color_match_id = cm.id 
       WHERE bi.board_id = ? 
       ORDER BY bi.added_at DESC`,
      [boardId]
    );

    res.json({
      items: result.rows
    });

  } catch (error) {
    console.error('Get board items error:', error);
    res.status(500).json({
      error: 'Failed to fetch board items',
      message: 'Internal server error'
    });
  }
});

// Add color match to board
router.post('/:boardId/items', [
  authenticateToken,
  body('colorMatchId').isUUID()
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
    const { boardId } = req.params;
    const { colorMatchId } = req.body;

    // Verify board belongs to user
    const boardCheck = await query(
      'SELECT id FROM boards WHERE id = ? AND user_id = ?',
      [boardId, userId]
    );

    if (boardCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Board not found',
        message: 'Board does not exist or you do not have access to it'
      });
    }

    // Verify color match belongs to user
    const colorMatchCheck = await query(
      'SELECT id FROM color_matches WHERE id = ? AND user_id = ?',
      [colorMatchId, userId]
    );

    if (colorMatchCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Color match not found',
        message: 'Color match does not exist or you do not have access to it'
      });
    }

    // Check if already in board
    const existingItem = await query(
      'SELECT id FROM board_items WHERE board_id = ? AND color_match_id = ?',
      [boardId, colorMatchId]
    );

    if (existingItem.rows.length > 0) {
      return res.status(409).json({
        error: 'Item already exists',
        message: 'This color match is already in the board'
      });
    }

    // Add to board with app-generated UUID
    const boardItemId = uuidv4();
    await query(
      'INSERT INTO board_items (id, board_id, color_match_id) VALUES (?, ?, ?)',
      [boardItemId, boardId, colorMatchId]
    );
    
    // Get the newly created item
    const result = await query(
      'SELECT * FROM board_items WHERE board_id = ? AND color_match_id = ? ORDER BY added_at DESC LIMIT 1',
      [boardId, colorMatchId]
    );

    res.status(201).json({
      message: 'Color match added to board successfully',
      item: result.rows[0]
    });

  } catch (error) {
    console.error('Add to board error:', error);
    res.status(500).json({
      error: 'Failed to add color match to board',
      message: 'Internal server error'
    });
  }
});

// Remove color match from board
router.delete('/:boardId/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { boardId, itemId } = req.params;

    // Verify board belongs to user and remove item
    const result = await query(
      `DELETE FROM board_items 
       WHERE id = ? AND board_id = ? AND board_id IN (
         SELECT id FROM boards WHERE user_id = ?
       )`,
      [itemId, boardId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Item not found',
        message: 'Board item does not exist or you do not have access to it'
      });
    }

    res.json({
      message: 'Color match removed from board successfully'
    });

  } catch (error) {
    console.error('Remove from board error:', error);
    res.status(500).json({
      error: 'Failed to remove color match from board',
      message: 'Internal server error'
    });
  }
});

module.exports = router;
