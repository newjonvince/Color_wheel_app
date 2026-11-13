// routes/community/index.js - The community feed is every palette its owner made public.
// Likes live in routes/likes; saving to a board lives in routes/boards.

const express = require('express');
const { query } = require('../../config/database');
const { authenticateToken, optionalAuth } = require('../../middleware/auth-enhanced');
const { communityLimiter } = require('../../middleware/rateLimiting');
const ColorService = require('../../services/colorService');
const { success, created, badRequest, notFound, asyncHandler } = require('../../utils/response');

const router = express.Router();

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 40;
const REPORT_REASONS = ['inappropriate', 'spam', 'harassment', 'copyright', 'other'];

/**
 * @route   GET /community/feed?limit=&offset=
 * @desc    Public palettes, newest first. Signed-in users don't see people they blocked
 *          or palettes they reported.
 */
router.get('/feed', optionalAuth, communityLimiter, asyncHandler(async (req, res) => {
  const userId = req.user?.userId || null;
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || PAGE_SIZE));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  const params = [];
  let likedSelect = '0 AS is_liked';
  let hidden = '';
  if (userId) {
    likedSelect = 'EXISTS(SELECT 1 FROM color_match_likes l2 WHERE l2.color_match_id = cm.id AND l2.user_id = ?) AS is_liked';
    params.push(userId);
    hidden = `
       AND cm.user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ?)
       AND cm.id NOT IN (SELECT color_match_id FROM content_reports WHERE reporter_id = ?)`;
    params.push(userId, userId);
  }

  // limit/offset are validated integers, inlined because mysql2 cannot bind LIMIT on MySQL >= 8.0.22
  const result = await query(
    `SELECT cm.*, u.username,
        (ci.color_match_id IS NOT NULL) AS has_image, ci.width AS image_width, ci.height AS image_height,
        (SELECT COUNT(*) FROM color_match_likes l WHERE l.color_match_id = cm.id) AS like_count,
        ${likedSelect}
     FROM color_matches cm
     JOIN users u ON u.id = cm.user_id
     LEFT JOIN color_match_images ci ON ci.color_match_id = cm.id
     WHERE cm.privacy = 'public' AND (ci.source IS NULL OR ci.source <> 'web')${hidden}
     ORDER BY cm.created_at DESC, cm.id DESC
     LIMIT ${limit + 1} OFFSET ${offset}`,
    params
  );

  const rows = result.rows;
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  return success(res, {
    palettes: rows.map((row) => ColorService.formatColorMatchResponse(row)),
    next_offset: hasMore ? offset + limit : null,
  });
}));

// ----- "Explore inspiration": shared palettes closest to a set of colors -----

const SIMILAR_POOL = 600;     // newest public palettes considered
const SIMILAR_RESULTS = 40;
const HEX6 = /^#?[0-9a-f]{6}$/i;

// sRGB hex -> CIE Lab, where straight-line distance tracks how different two colors look
const hexToLab = (hex) => {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = lin((n >> 16) & 255);
  const g = lin((n >> 8) & 255);
  const b = lin(n & 255);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};

const labDistance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Average distance from each color in `from` to its nearest color in `to`
const coverage = (from, to) =>
  from.reduce((sum, a) => sum + Math.min(...to.map((b) => labDistance(a, b))), 0) / from.length;

// Lower is closer. Mostly "does this palette contain my colors"; a palette that also carries
// unrelated colors ranks a little lower than one that is just my colors.
const paletteDistance = (wanted, candidate) => coverage(wanted, candidate) + 0.35 * coverage(candidate, wanted);

/**
 * @route   GET /community/similar?colors=FF6B6B,4ECDC4
 * @desc    Public palettes ranked by how close their colors are to the given ones (closest first)
 */
router.get('/similar', optionalAuth, communityLimiter, asyncHandler(async (req, res) => {
  const hexes = String(req.query.colors || '').split(',').map((c) => c.trim()).filter((c) => HEX6.test(c)).slice(0, 8);
  if (hexes.length === 0) return badRequest(res, 'colors must be a comma-separated list of hex colors');
  const wanted = hexes.map(hexToLab);

  const userId = req.user?.userId || null;
  const params = [];
  let likedSelect = '0 AS is_liked';
  let hidden = '';
  if (userId) {
    likedSelect = 'EXISTS(SELECT 1 FROM color_match_likes l2 WHERE l2.color_match_id = cm.id AND l2.user_id = ?) AS is_liked';
    params.push(userId);
    hidden = `
       AND cm.user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ?)
       AND cm.id NOT IN (SELECT color_match_id FROM content_reports WHERE reporter_id = ?)`;
    params.push(userId, userId);
  }

  const result = await query(
    `SELECT cm.*, u.username,
        (ci.color_match_id IS NOT NULL) AS has_image, ci.width AS image_width, ci.height AS image_height,
        (SELECT COUNT(*) FROM color_match_likes l WHERE l.color_match_id = cm.id) AS like_count,
        ${likedSelect}
     FROM color_matches cm
     JOIN users u ON u.id = cm.user_id
     LEFT JOIN color_match_images ci ON ci.color_match_id = cm.id
     WHERE cm.privacy = 'public' AND (ci.source IS NULL OR ci.source <> 'web')${hidden}
     ORDER BY cm.created_at DESC, cm.id DESC
     LIMIT ${SIMILAR_POOL}`,
    params
  );

  const ranked = [];
  for (const row of result.rows) {
    const palette = ColorService.formatColorMatchResponse(row);
    const colors = (Array.isArray(palette.colors) ? palette.colors : []).filter((c) => HEX6.test(c));
    if (colors.length === 0 && HEX6.test(palette.base_color)) colors.push(palette.base_color);
    if (colors.length === 0) continue;
    ranked.push({ palette, distance: paletteDistance(wanted, colors.map(hexToLab)) });
  }
  ranked.sort((a, b) => a.distance - b.distance);

  return success(res, {
    palettes: ranked.slice(0, SIMILAR_RESULTS).map((r) => r.palette),
    next_offset: null,
  });
}));

/**
 * @route   POST /community/reports
 * @desc    Report a shared palette; it disappears from the reporter's feed
 */
router.post('/reports', authenticateToken, asyncHandler(async (req, res) => {
  const { color_match_id: matchId, reason, details } = req.body;
  if (typeof matchId !== 'string' || !matchId) return badRequest(res, 'color_match_id is required');
  if (!REPORT_REASONS.includes(reason)) return badRequest(res, `reason must be one of: ${REPORT_REASONS.join(', ')}`);

  const palette = await query("SELECT id FROM color_matches WHERE id = ? AND privacy = 'public'", [matchId]);
  if (palette.rows.length === 0) return notFound(res, 'Palette not found');

  await query(
    `INSERT INTO content_reports (reporter_id, color_match_id, reason, details)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE reason = VALUES(reason), details = VALUES(details)`,
    [req.user.userId, matchId, reason, typeof details === 'string' ? details.slice(0, 500) : null]
  );
  console.warn('Content report filed:', { matchId, reason, reporter: req.user.userId });

  return created(res, null, 'Report received');
}));

/**
 * @route   POST /community/blocks/:userId
 * @desc    Stop seeing another user's palettes
 */
router.post('/blocks/:userId', authenticateToken, asyncHandler(async (req, res) => {
  const blockedId = req.params.userId;
  if (blockedId === req.user.userId) return badRequest(res, 'You cannot block yourself');

  const target = await query('SELECT id FROM users WHERE id = ?', [blockedId]);
  if (target.rows.length === 0) return notFound(res, 'User not found');

  await query('INSERT IGNORE INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)', [req.user.userId, blockedId]);
  return created(res, null, 'User blocked');
}));

/**
 * @route   DELETE /community/blocks/:userId
 * @desc    Unblock a user
 */
router.delete('/blocks/:userId', authenticateToken, asyncHandler(async (req, res) => {
  await query('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', [req.user.userId, req.params.userId]);
  return success(res, null, 'User unblocked');
}));

module.exports = router;
