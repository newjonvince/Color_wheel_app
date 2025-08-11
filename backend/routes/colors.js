// backend/routes/colors.js (improved)
// MySQL version — color utilities + palette persistence
// - Adds stricter validation & numeric coercion
// - Returns HEX in uppercase and includes angles when generating schemes
// - Exposes /colors/scheme, /colors/validate, /colors/blend
// - Persists palettes at /colors/matches (auth required)
// - Paginates /colors/matches
//
// Usage in server:
//   const { router: colorsRouter } = require('./routes/colors');
//   app.use('/api/colors', colorsRouter);

const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ----------------------------- helpers --------------------------------------
const ALLOWED_SCHEMES = new Set([
  'analogous',
  'complementary',
  'split-complementary',
  'triadic',
  'tetradic',
  'monochromatic'
]);

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function isValidHexColor(hex) {
  return /^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(hex);
}

function normalizeAngle(angle) {
  return (angle % 360 + 360) % 360;
}

function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
  const num = parseInt(c, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function hexToHsl(H) {
  let { r, g, b } = hexToRgb(H);
  r /= 255; g /= 255; b /= 255;
  let cmin = Math.min(r,g,b),
      cmax = Math.max(r,g,b),
      delta = cmax - cmin,
      h = 0, s = 0, l = 0;

  if (delta === 0) h = 0;
  else if (cmax === r) h = ((g - b) / delta) % 6;
  else if (cmax === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  h = Math.round(h * 60);
  if (h < 0) h += 360;
  l = (cmax + cmin) / 2;
  s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  s = +(s * 100).toFixed(1);
  l = +(l * 100).toFixed(1);
  return { h, s, l };
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n =>
    Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return `#${f(0).toString(16).padStart(2, '0')}${f(8).toString(16).padStart(2, '0')}${f(4).toString(16).padStart(2, '0')}`.toUpperCase();
}

function blendColors(c1, c2, weight = 0.5) {
  weight = clamp(Number(weight) || 0.5, 0, 1);
  const a = hexToRgb(c1), b = hexToRgb(c2);
  const r = Math.round(a.r * (1 - weight) + b.r * weight);
  const g = Math.round(a.g * (1 - weight) + b.g * weight);
  const bch = Math.round(a.b * (1 - weight) + b.b * weight);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bch).toString(16).slice(1).toUpperCase()}`;
}

function schemeAngles(h, type) {
  switch (type) {
    case 'complementary':
      return [0, 180];
    case 'split-complementary':
      return [0, 150, -150];
    case 'triadic':
      return [0, 120, -120];
    case 'tetradic':
      return [0, 90, 180, 270];
    case 'monochromatic':
      // Use base hue only; lightness variations handled by client
      return [0];
    case 'analogous':
    default:
      return [0, 30, -30];
  }
}

function getColorScheme(baseHex, scheme = 'analogous') {
  const { h, s, l } = hexToHsl(baseHex);
  const deltas = schemeAngles(h, scheme);
  const hues = deltas.map(d => normalizeAngle(h + d));
  const colors = hues.map(hh => hslToHex(hh, s, l));
  return { baseHex: baseHex.toUpperCase(), scheme, hues, colors };
}

// ------------------------------- routes -------------------------------------
router.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'Color utilities API',
    endpoints: {
      'GET /': 'This help message',
      'POST /validate': 'Validate hex color',
      'POST /scheme': 'Generate color scheme (returns HEX + angles)',
      'POST /blend': 'Blend two HEX colors',
      'GET /matches': 'List user palettes (auth)',
      'POST /matches': 'Save palette (auth)'
    }
  });
});

router.post('/validate', (req, res) => {
  const { hex } = req.body || {};
  if (!hex) return res.status(400).json({ ok: false, error: 'hex is required' });
  const upper = hex.toUpperCase();
  return res.json({ ok: true, hex: upper, valid: isValidHexColor(upper) });
});

router.post('/scheme', (req, res) => {
  const { baseColor, scheme = 'analogous' } = req.body || {};
  const base = (baseColor || '').toUpperCase();
  if (!isValidHexColor(base)) {
    return res.status(400).json({ ok: false, error: 'Valid hex baseColor is required' });
  }
  if (!ALLOWED_SCHEMES.has(scheme)) {
    return res.status(400).json({ ok: false, error: `Invalid scheme. Use one of: ${[...ALLOWED_SCHEMES].join(', ')}` });
  }
  try {
    const result = getColorScheme(base, scheme);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Failed to generate color scheme' });
  }
});

router.post('/blend', (req, res) => {
  const { color1, color2, weight = 0.5 } = req.body || {};
  if (!isValidHexColor(color1 || '') || !isValidHexColor(color2 || '')) {
    return res.status(400).json({ ok: false, error: 'color1 and color2 must be valid HEX' });
  }
  try {
    const result = blendColors(color1.toUpperCase(), color2.toUpperCase(), weight);
    res.json({ ok: true, color1: color1.toUpperCase(), color2: color2.toUpperCase(), weight, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Failed to blend colors' });
  }
});

// ---------- Palette persistence (MySQL) -------------------------------------
router.post('/matches', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    let { base_color, scheme, colors, title, description, is_public = false } = req.body || {};

    base_color = (base_color || '').toUpperCase();
    if (!isValidHexColor(base_color)) return res.status(400).json({ ok: false, error: 'Invalid base_color HEX' });

    if (!ALLOWED_SCHEMES.has(scheme)) return res.status(400).json({ ok: false, error: 'Invalid scheme' });

    if (!Array.isArray(colors) || colors.length === 0) return res.status(400).json({ ok: false, error: 'colors array is required' });
    const cleaned = colors.map(c => (c || '').toUpperCase()).filter(isValidHexColor);
    if (cleaned.length !== colors.length) return res.status(400).json({ ok: false, error: 'colors contains invalid HEX' });

    const insert = await query(
      `INSERT INTO color_matches (user_id, base_color, scheme, colors, title, description, is_public, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, base_color, scheme, JSON.stringify(cleaned), title || `${scheme} palette`, description || '', !!is_public]
    );

    const [saved] = await query(
      `SELECT id, user_id, base_color, scheme, colors, title, description, is_public, created_at
       FROM color_matches WHERE id = ?`,
      [insert.insertId]
    );

    saved.colors = JSON.parse(saved.colors);
    res.status(201).json({ ok: true, data: saved });
  } catch (e) {
    console.error('save palette failed:', e);
    res.status(500).json({ ok: false, error: 'Failed to save color match' });
  }
});

router.get('/matches', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = clamp(parseInt(req.query.limit || '50', 10), 1, 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const rows = await query(
      `SELECT id, user_id, base_color, scheme, colors, title, description, is_public, created_at
       FROM color_matches WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const data = rows.map(r => ({ ...r, colors: JSON.parse(r.colors) }));
    res.json({ ok: true, count: data.length, data });
  } catch (e) {
    console.error('list palettes failed:', e);
    res.status(500).json({ ok: false, error: 'Failed to fetch color matches' });
  }
});

module.exports = {
  router,
  // export utils for reuse
  isValidHexColor,
  normalizeAngle,
  hexToRgb,
  hexToHsl,
  hslToHex,
  blendColors,
  getColorScheme,
};
