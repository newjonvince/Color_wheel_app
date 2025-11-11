const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../../config/database');
const { authenticateToken } = require('../../middleware/auth-enhanced');
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

    queryText += ' ORDER BY created_at DESC';

    const boards = await query(queryText, queryParams);
    res.json({ success: true, boards });
  } catch (error) {
    console.error('Error fetching boards:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch boards' });
  }
});

// Create a new board
router.post('/', [
  authenticateToken,
  body('title').notEmpty().withMessage('Title is required'),
  body('type').isIn(['private', 'public']).withMessage('Type must be private or public')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, description, type } = req.body;
    const userId = req.user.userId;
    const boardId = uuidv4();

    await query(
      'INSERT INTO boards (id, user_id, title, description, type) VALUES (?, ?, ?, ?, ?)',
      [boardId, userId, title, description || null, type]
    );

    const newBoard = await query('SELECT * FROM boards WHERE id = ?', [boardId]);
    res.status(201).json({ success: true, board: newBoard[0] });
  } catch (error) {
    console.error('Error creating board:', error);
    res.status(500).json({ success: false, message: 'Failed to create board' });
  }
});

// Update a board
router.put('/:boardId', [
  authenticateToken,
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  body('type').optional().isIn(['private', 'public']).withMessage('Type must be private or public')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { boardId } = req.params;
    const { title, description, type } = req.body;
    const userId = req.user.userId;

    // Check if board exists and belongs to user
    const existingBoard = await query('SELECT * FROM boards WHERE id = ? AND user_id = ?', [boardId, userId]);
    if (existingBoard.length === 0) {
      return res.status(404).json({ success: false, message: 'Board not found' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    
    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (type !== undefined) {
      updates.push('type = ?');
      values.push(type);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(boardId, userId);

    await query(
      `UPDATE boards SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    const updatedBoard = await query('SELECT * FROM boards WHERE id = ?', [boardId]);
    res.json({ success: true, board: updatedBoard[0] });
  } catch (error) {
    console.error('Error updating board:', error);
    res.status(500).json({ success: false, message: 'Failed to update board' });
  }
});

// Delete a board
router.delete('/:boardId', authenticateToken, async (req, res) => {
  try {
    const { boardId } = req.params;
    const userId = req.user.userId;

    const result = await query('DELETE FROM boards WHERE id = ? AND user_id = ?', [boardId, userId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Board not found' });
    }

    res.json({ success: true, message: 'Board deleted successfully' });
  } catch (error) {
    console.error('Error deleting board:', error);
    res.status(500).json({ success: false, message: 'Failed to delete board' });
  }
});

// Get a specific board
router.get('/:boardId', authenticateToken, async (req, res) => {
  try {
    const { boardId } = req.params;
    const userId = req.user.userId;

    const board = await query('SELECT * FROM boards WHERE id = ? AND user_id = ?', [boardId, userId]);
    
    if (board.length === 0) {
      return res.status(404).json({ success: false, message: 'Board not found' });
    }

    res.json({ success: true, board: board[0] });
  } catch (error) {
    console.error('Error fetching board:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch board' });
  }
});

module.exports = router;
