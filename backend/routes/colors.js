// routes/colors.js — minor hardening + friendlier errors
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Helper: normalize DB results (some drivers return arrays, others return {rows: []})
const rows = (r) => (Array.isArray(r) ? r : (r?.rows || []));

// Helper: safe JSON parse with fallback
const safeJsonParse = (str, fallback = []) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

const ALLOWED_SCHEMES = new Set(['analogous','complementary','split-complementary','triadic','tetradic','monochromatic']);
function isValidHexColor(hex){ return /^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(hex); }

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ ok: true, message: 'Color utilities API' });
});

// GET /validate for health checks (query param)
router.get('/validate', (req, res) => {
  const hex = (req.query.hex || '').trim();
  const upper = hex.startsWith('#') ? hex.toUpperCase() : ('#' + hex.toUpperCase());
  const valid = /^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(upper);
  res.json({ ok: true, hex: upper, valid });
});

router.post('/validate', (req, res) => {
  const { hex } = req.body || {};
  if (!hex) return res.status(400).json({ ok: false, error: 'hex is required' });
  const upper = String(hex).trim().startsWith('#') ? String(hex).trim().toUpperCase() : `#${String(hex).trim().toUpperCase()}`;
  return res.json({ ok: true, hex: upper, valid: isValidHexColor(upper) });
});

router.post('/matches', authenticateToken, async (req, res) => {
  try {
    let { base_color, scheme, colors, title, description, isPublic, privacy, isLocked, lockedColor } = req.body || {};
    
    // Map frontend fields to database schema
    if (typeof privacy !== 'string') {
      privacy = (isPublic === true || isPublic === 'true') ? 'public' : 'private';
    }
    const is_locked = isLocked === true || isLocked === 'true' ? 1 : 0;
    const locked_color = lockedColor || null;

    base_color = (base_color || '').toUpperCase();
    if (!isValidHexColor(base_color)) return res.status(400).json({ ok: false, error: 'Invalid base_color HEX' });
    if (!ALLOWED_SCHEMES.has(scheme)) return res.status(400).json({ ok: false, error: 'Invalid scheme' });
    if (!Array.isArray(colors) || colors.length === 0) return res.status(400).json({ ok: false, error: 'colors array is required' });

    const cleaned = colors.map(c => (c || '').toUpperCase()).filter(isValidHexColor);
    if (cleaned.length !== colors.length) return res.status(400).json({ ok: false, error: 'colors contains invalid HEX' });

    const userId = req.user.userId;
    // Generate UUID in app code for consistent behavior
    const colorMatchId = uuidv4();
    
    const insert = await query(
      `INSERT INTO color_matches (id, user_id, base_color, scheme, colors, title, description, privacy, is_locked, locked_color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [colorMatchId, userId, base_color, scheme, JSON.stringify(cleaned), title || `${scheme} palette`, description || '', privacy, is_locked, locked_color]
    );

    const savedRes = await query(`SELECT id, user_id, base_color, scheme, colors, title, description, privacy, is_locked, locked_color, created_at, updated_at FROM color_matches WHERE id = ?`, [colorMatchId]);
    const saved = savedRes?.rows?.[0] ?? savedRes?.[0];
    if (!saved) {
      return res.status(500).json({ ok: false, error: 'Failed to retrieve saved color match' });
    }
    saved.colors = JSON.parse(saved.colors);
    res.status(201).json({ ok: true, data: saved });
  } catch (e) {
    console.error('save palette failed:', e);
    res.status(500).json({ ok: false, error: 'Failed to save color match' });
  }
});

// GET /matches - Get user's color matches with pagination and filtering
router.get('/matches', authenticateToken, async (req, res) => {
  try {
    let { limit, offset, is_public, scheme } = req.query;
    const toInt = (v, def) => {
      const n = Number.parseInt(v, 10);
      return Number.isFinite(n) ? n : def;
    };
    let lim = toInt(limit, 20);
    let off = toInt(offset, 0);
    // keep things sane
    lim = Math.max(1, Math.min(100, lim));
    off = Math.max(0, off);
    
    const userId = req.user.userId;
    
    let whereClause = 'WHERE user_id = ?';
    let params = [userId];
    
    if (is_public !== undefined) {
      const privacy_filter = is_public === 'true' ? 'public' : 'private';
      whereClause += ' AND privacy = ?';
      params.push(privacy_filter);
    }
    
    if (scheme && ALLOWED_SCHEMES.has(scheme)) {
      whereClause += ' AND scheme = ?';
      params.push(scheme);
    }
    
    const result = await query(`
      SELECT id, user_id, base_color, scheme, colors, title, description, privacy, is_locked, locked_color, created_at, updated_at 
      FROM color_matches 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [...params, lim, off]);
    
    // Normalize DB results and safely parse JSON colors
    const matches = rows(result);
    matches.forEach(match => {
      match.colors = safeJsonParse(match.colors, []);
    });
    
    res.json({ ok: true, data: matches, count: matches.length });
  } catch (error) {
    console.error('Get color matches error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get color matches' });
  }
});

// GET /matches/:id - Get specific color match by ID
router.get('/matches/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const result = await query(`
      SELECT id, user_id, base_color, scheme, colors, title, description, privacy, is_locked, locked_color, created_at, updated_at 
      FROM color_matches 
      WHERE id = ? AND (user_id = ? OR privacy = 'public')
    `, [id, userId]);
    
    // Normalize DB results
    const matches = rows(result);
    if (matches.length === 0) {
      return res.status(404).json({ ok: false, error: 'Color match not found' });
    }
    
    const match = matches[0];
    match.colors = safeJsonParse(match.colors, []);
    
    res.json({ ok: true, data: match });
  } catch (error) {
    console.error('Get color match error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get color match' });
  }
});

// PUT /matches/:id - Update color match
router.put('/matches/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    let { base_color, scheme, colors, title, description, isPublic, privacy, isLocked, lockedColor } = req.body || {};
    
    // Map frontend fields to database schema
    if (typeof privacy !== 'string' && isPublic !== undefined) {
      privacy = (isPublic === true || isPublic === 'true') ? 'public' : 'private';
    }
    const is_locked = isLocked === true || isLocked === 'true' ? 1 : 0;
    const locked_color = lockedColor || null;
    
    // Verify ownership
    const existing = rows(await query('SELECT user_id FROM color_matches WHERE id = ?', [id]));
    if (existing.length === 0) {
      return res.status(404).json({ ok: false, error: 'Color match not found' });
    }
    if (existing[0].user_id !== userId) {
      return res.status(403).json({ ok: false, error: 'Not authorized to update this color match' });
    }
    
    // Validate inputs if provided
    if (base_color) {
      base_color = base_color.toUpperCase();
      if (!isValidHexColor(base_color)) {
        return res.status(400).json({ ok: false, error: 'Invalid base_color HEX' });
      }
    }
    
    if (scheme && !ALLOWED_SCHEMES.has(scheme)) {
      return res.status(400).json({ ok: false, error: 'Invalid scheme' });
    }
    
    if (colors) {
      if (!Array.isArray(colors) || colors.length === 0) {
        return res.status(400).json({ ok: false, error: 'colors array is required' });
      }
      const cleaned = colors.map(c => (c || '').toUpperCase()).filter(isValidHexColor);
      if (cleaned.length !== colors.length) {
        return res.status(400).json({ ok: false, error: 'colors contains invalid HEX' });
      }
      colors = JSON.stringify(cleaned);
    }
    
    // Build dynamic update query
    const updates = [];
    const params = [];
    
    if (base_color) { updates.push('base_color = ?'); params.push(base_color); }
    if (scheme) { updates.push('scheme = ?'); params.push(scheme); }
    if (colors) { updates.push('colors = ?'); params.push(colors); }
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (privacy !== undefined) { updates.push('privacy = ?'); params.push(privacy); }
    if (isLocked !== undefined) { updates.push('is_locked = ?'); params.push(is_locked); }
    if (lockedColor !== undefined) { updates.push('locked_color = ?'); params.push(locked_color); }
    
    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'No fields to update' });
    }
    
    params.push(id);
    
    await query(`UPDATE color_matches SET ${updates.join(', ')} WHERE id = ?`, params);
    
    // Return updated record
    const updated = rows(await query(`
      SELECT id, user_id, base_color, scheme, colors, title, description, privacy, is_locked, locked_color, created_at, updated_at 
      FROM color_matches WHERE id = ?
    `, [id]));
    
    const match = updated[0];
    match.colors = safeJsonParse(match.colors, []);
    
    res.json({ ok: true, data: match });
  } catch (error) {
    console.error('Update color match error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update color match' });
  }
});

// DELETE /matches/:id - Delete color match
router.delete('/matches/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    // Verify ownership
    const existing = rows(await query('SELECT user_id FROM color_matches WHERE id = ?', [id]));
    if (existing.length === 0) {
      return res.status(404).json({ ok: false, error: 'Color match not found' });
    }
    if (existing[0].user_id !== userId) {
      return res.status(403).json({ ok: false, error: 'Not authorized to delete this color match' });
    }
    
    await query('DELETE FROM color_matches WHERE id = ?', [id]);
    
    res.json({ ok: true, message: 'Color match deleted successfully' });
  } catch (error) {
    console.error('Delete color match error:', error);
    res.status(500).json({ ok: false, error: 'Failed to delete color match' });
  }
});

// GET /public - Get public color matches for discovery
router.get('/public', async (req, res) => {
  try {
    let { limit, offset, scheme } = req.query;
    const toInt = (v, def) => {
      const n = Number.parseInt(v, 10);
      return Number.isFinite(n) ? n : def;
    };
    let lim = toInt(limit, 20);
    let off = toInt(offset, 0);
    // keep things sane
    lim = Math.max(1, Math.min(100, lim));
    off = Math.max(0, off);
    
    let whereClause = 'WHERE privacy = \'public\'';
    let params = [];
    
    if (scheme && ALLOWED_SCHEMES.has(scheme)) {
      whereClause += ' AND scheme = ?';
      params.push(scheme);
    }
    
    const list = rows(await query(`
      SELECT cm.id, cm.base_color, cm.scheme, cm.colors, cm.title, cm.description, cm.privacy, cm.is_locked, cm.locked_color, cm.created_at,
             u.username, u.id as user_id
      FROM color_matches cm
      JOIN users u ON cm.user_id = u.id
      ${whereClause}
      ORDER BY cm.created_at DESC 
      LIMIT ? OFFSET ?
    `, [...params, lim, off]));
    
    // Parse JSON colors for each match
    list.forEach(match => {
      match.colors = safeJsonParse(match.colors, []);
    });
    
    res.json({ ok: true, data: list, count: list.length });
  } catch (error) {
    console.error('Get public color matches error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get public color matches' });
  }
});

module.exports = router;
