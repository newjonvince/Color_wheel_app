// routes/boards/index.js - Boards are folders of saved palettes.
// A board holds the owner's own palettes and public palettes saved from other people.

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../../config/database');
const { authenticateToken } = require('../../middleware/auth-enhanced');
const ColorService = require('../../services/colorService');
const {
  success,
  created,
  badRequest,
  notFound,
  asyncHandler,
} = require('../../utils/response');

const router = express.Router();

const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;
const PREVIEW_PALETTES = 4;

const cleanName = (value) => (typeof value === 'string' ? value.trim() : '');

const parseColors = (colors) => (typeof colors === 'string' ? JSON.parse(colors) : colors);

const formatBoard = (row, previews = []) => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  palette_count: Number(row.palette_count) || 0,
  previews,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const findOwnedBoard = async (boardId, userId) => {
  const result = await query('SELECT * FROM boards WHERE id = ? AND user_id = ?', [boardId, userId]);
  return result.rows[0] || null;
};

// Palettes a user may see: their own, or anyone's public ones
const VISIBLE = "(cm.user_id = ? OR cm.privacy = 'public')";

/**
 * @route   GET /boards
 * @desc    The user's boards with a palette count and a few palettes for the cover
 */
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const boards = await query(
    `SELECT b.*,
        (SELECT COUNT(*) FROM board_items bi
           JOIN color_matches cm ON cm.id = bi.color_match_id
          WHERE bi.board_id = b.id AND ${VISIBLE}) AS palette_count
     FROM boards b
     WHERE b.user_id = ?
     ORDER BY b.updated_at DESC, b.created_at DESC`,
    [userId, userId]
  );

  const covers = await query(
    `SELECT bi.board_id, cm.id, cm.colors, (ci.color_match_id IS NOT NULL) AS has_image
     FROM board_items bi
     JOIN boards b ON b.id = bi.board_id
     JOIN color_matches cm ON cm.id = bi.color_match_id
     LEFT JOIN color_match_images ci ON ci.color_match_id = cm.id
     WHERE b.user_id = ? AND ${VISIBLE}
     ORDER BY bi.added_at DESC`,
    [userId, userId]
  );

  const previewsByBoard = {};
  for (const row of covers.rows) {
    const list = previewsByBoard[row.board_id] || (previewsByBoard[row.board_id] = []);
    if (list.length < PREVIEW_PALETTES) {
      list.push({ id: row.id, colors: parseColors(row.colors), has_image: Boolean(Number(row.has_image)) });
    }
  }

  return success(res, boards.rows.map((b) => formatBoard(b, previewsByBoard[b.id] || [])));
}));

/**
 * @route   POST /boards
 * @desc    Create a board
 */
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  const name = cleanName(req.body.name);
  const description = cleanName(req.body.description);
  if (!name) return badRequest(res, 'Board name is required');
  if (name.length > NAME_MAX) return badRequest(res, `Board name must be ${NAME_MAX} characters or fewer`);
  if (description.length > DESCRIPTION_MAX) return badRequest(res, 'Description is too long');

  const boardId = uuidv4();
  await query(
    'INSERT INTO boards (id, user_id, name, type, description) VALUES (?, ?, ?, ?, ?)',
    [boardId, req.user.userId, name, 'private', description || null]
  );

  const board = await findOwnedBoard(boardId, req.user.userId);
  return created(res, formatBoard(board), 'Board created');
}));

/**
 * @route   GET /boards/:boardId
 * @desc    A board and the palettes in it
 */
router.get('/:boardId', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const board = await findOwnedBoard(req.params.boardId, userId);
  if (!board) return notFound(res, 'Board not found');

  const palettes = await query(
    `SELECT cm.*, u.username,
        (ci.color_match_id IS NOT NULL) AS has_image, ci.width AS image_width, ci.height AS image_height, ci.source AS image_source,
        (SELECT COUNT(*) FROM color_match_likes l WHERE l.color_match_id = cm.id) AS like_count,
        EXISTS(SELECT 1 FROM color_match_likes l2 WHERE l2.color_match_id = cm.id AND l2.user_id = ?) AS is_liked
     FROM board_items bi
     JOIN color_matches cm ON cm.id = bi.color_match_id
     JOIN users u ON u.id = cm.user_id
     LEFT JOIN color_match_images ci ON ci.color_match_id = cm.id
     WHERE bi.board_id = ? AND ${VISIBLE}
     ORDER BY bi.added_at DESC`,
    [userId, board.id, userId]
  );

  return success(res, {
    board: formatBoard({ ...board, palette_count: palettes.rows.length }),
    palettes: palettes.rows.map((row) => ColorService.formatColorMatchResponse(row)),
  });
}));

/**
 * @route   PUT /boards/:boardId
 * @desc    Rename a board or change its description
 */
router.put('/:boardId', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const board = await findOwnedBoard(req.params.boardId, userId);
  if (!board) return notFound(res, 'Board not found');

  const name = req.body.name === undefined ? board.name : cleanName(req.body.name);
  const description = req.body.description === undefined ? (board.description || '') : cleanName(req.body.description);
  if (!name) return badRequest(res, 'Board name is required');
  if (name.length > NAME_MAX) return badRequest(res, `Board name must be ${NAME_MAX} characters or fewer`);
  if (description.length > DESCRIPTION_MAX) return badRequest(res, 'Description is too long');

  await query(
    'UPDATE boards SET name = ?, description = ? WHERE id = ? AND user_id = ?',
    [name, description || null, board.id, userId]
  );

  return success(res, formatBoard(await findOwnedBoard(board.id, userId)), 'Board updated');
}));

/**
 * @route   DELETE /boards/:boardId
 * @desc    Delete a board (the palettes themselves are kept)
 */
router.delete('/:boardId', authenticateToken, asyncHandler(async (req, res) => {
  const result = await query(
    'DELETE FROM boards WHERE id = ? AND user_id = ?',
    [req.params.boardId, req.user.userId]
  );
  if (result.rows.affectedRows === 0) return notFound(res, 'Board not found');
  return success(res, null, 'Board deleted');
}));

/**
 * @route   POST /boards/:boardId/items
 * @desc    Save a palette into a board (own palette, or someone's public one)
 */
router.post('/:boardId/items', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const matchId = req.body.color_match_id;
  if (typeof matchId !== 'string' || !matchId) return badRequest(res, 'color_match_id is required');

  const board = await findOwnedBoard(req.params.boardId, userId);
  if (!board) return notFound(res, 'Board not found');

  const palette = await query(
    `SELECT cm.id FROM color_matches cm WHERE cm.id = ? AND ${VISIBLE}`,
    [matchId, userId]
  );
  if (palette.rows.length === 0) return notFound(res, 'Palette not found');

  const existing = await query(
    'SELECT id FROM board_items WHERE board_id = ? AND color_match_id = ?',
    [board.id, matchId]
  );
  if (existing.rows.length === 0) {
    await query(
      'INSERT INTO board_items (id, board_id, color_match_id) VALUES (?, ?, ?)',
      [uuidv4(), board.id, matchId]
    );
    // Surface recently used boards first
    await query('UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [board.id]);
  }

  return created(res, { board_id: board.id, color_match_id: matchId }, 'Saved to board');
}));

/**
 * @route   DELETE /boards/:boardId/items/:matchId
 * @desc    Take a palette out of a board
 */
router.delete('/:boardId/items/:matchId', authenticateToken, asyncHandler(async (req, res) => {
  const board = await findOwnedBoard(req.params.boardId, req.user.userId);
  if (!board) return notFound(res, 'Board not found');

  const result = await query(
    'DELETE FROM board_items WHERE board_id = ? AND color_match_id = ?',
    [board.id, req.params.matchId]
  );
  if (result.rows.affectedRows === 0) return notFound(res, 'Palette is not in this board');
  return success(res, null, 'Removed from board');
}));

module.exports = router;
