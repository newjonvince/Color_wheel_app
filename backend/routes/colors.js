// routes/colors.js — minor hardening + friendlier errors
const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const ALLOWED_SCHEMES = new Set(['analogous','complementary','split-complementary','triadic','tetradic','monochromatic']);
function isValidHexColor(hex){ return /^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(hex); }

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ ok: true, message: 'Color utilities API' });
});

router.post('/validate', (req, res) => {
  const { hex } = req.body || {};
  if (!hex) return res.status(400).json({ ok: false, error: 'hex is required' });
  const upper = String(hex).trim().startsWith('#') ? String(hex).trim().toUpperCase() : `#${String(hex).trim().toUpperCase()}`;
  return res.json({ ok: true, hex: upper, valid: isValidHexColor(upper) });
});

router.post('/matches', authenticateToken, async (req, res) => {
  try {
    let { base_color, scheme, colors, title, description, is_public } = req.body || {};
    if (typeof is_public !== 'boolean' && typeof req.body?.privacy === 'string') {
      is_public = req.body.privacy === 'public';
    }

    base_color = (base_color || '').toUpperCase();
    if (!isValidHexColor(base_color)) return res.status(400).json({ ok: false, error: 'Invalid base_color HEX' });
    if (!ALLOWED_SCHEMES.has(scheme)) return res.status(400).json({ ok: false, error: 'Invalid scheme' });
    if (!Array.isArray(colors) || colors.length === 0) return res.status(400).json({ ok: false, error: 'colors array is required' });

    const cleaned = colors.map(c => (c || '').toUpperCase()).filter(isValidHexColor);
    if (cleaned.length !== colors.length) return res.status(400).json({ ok: false, error: 'colors contains invalid HEX' });

    const userId = req.user.userId;
    const insert = await query(
      `INSERT INTO color_matches (user_id, base_color, scheme, colors, title, description, is_public, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, base_color, scheme, JSON.stringify(cleaned), title || `${scheme} palette`, description || '', !!is_public]
    );

    const [saved] = await query(`SELECT id, user_id, base_color, scheme, colors, title, description, is_public, created_at FROM color_matches WHERE id = ?`, [insert.insertId]);
    saved.colors = JSON.parse(saved.colors);
    res.status(201).json({ ok: true, data: saved });
  } catch (e) {
    console.error('save palette failed:', e);
    res.status(500).json({ ok: false, error: 'Failed to save color match' });
  }
});

module.exports = router;
