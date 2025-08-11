// backend/routes/colors.js
const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n =>
    Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return `#${f(0).toString(16).padStart(2, '0')}${f(8).toString(16).padStart(2, '0')}${f(4).toString(16).padStart(2, '0')}`.toUpperCase();
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

function isValidHexColor(hex) {
  return /^#([0-9A-F]{3}){1,2}$/i.test(hex);
}
const validateHexColor = isValidHexColor; // alias

function normalizeAngle(angle) {
  return (angle % 360 + 360) % 360;
}

function blendColors(c1, c2, weight = 0.5) {
  const rgb1 = hexToRgb(c1);
  const rgb2 = hexToRgb(c2);
  const r = Math.round(rgb1.r * (1 - weight) + rgb2.r * weight);
  const g = Math.round(rgb1.g * (1 - weight) + rgb2.g * weight);
  const b = Math.round(rgb1.b * (1 - weight) + rgb2.b * weight);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

function getColorScheme(baseHex, schemeType = 'analogous') {
  const { h, s, l } = hexToHsl(baseHex);
  let hues = [];
  switch (schemeType) {
    case 'complementary':
      hues = [h, normalizeAngle(h + 180)];
      break;
    case 'split-complementary':
      hues = [h, normalizeAngle(h + 150), normalizeAngle(h - 150)];
      break;
    case 'triadic':
      hues = [h, normalizeAngle(h + 120), normalizeAngle(h - 120)];
      break;
    case 'tetradic':
      hues = [h, normalizeAngle(h + 90), normalizeAngle(h + 180), normalizeAngle(h + 270)];
      break;
    case 'analogous':
    default:
      hues = [h, normalizeAngle(h + 30), normalizeAngle(h - 30)];
  }
  return hues.map(hue => hslToHex(hue, s, l));
}

// API Routes for color operations
router.get('/', (req, res) => {
  res.json({
    message: 'Color utilities API',
    endpoints: {
      'GET /': 'This help message',
      'POST /validate': 'Validate hex color',
      'POST /scheme': 'Generate color scheme',
      'POST /blend': 'Blend two colors'
    }
  });
});

// Validate hex color endpoint
router.post('/validate', (req, res) => {
  const { hex } = req.body;
  if (!hex) {
    return res.status(400).json({ error: 'Hex color is required' });
  }
  
  const isValid = isValidHexColor(hex);
  res.json({ hex, valid: isValid });
});

// Generate color scheme endpoint
router.post('/scheme', (req, res) => {
  const { baseColor, scheme = 'analogous' } = req.body;
  
  if (!baseColor || !isValidHexColor(baseColor)) {
    return res.status(400).json({ error: 'Valid hex color is required' });
  }
  
  try {
    const colors = getColorScheme(baseColor, scheme);
    res.json({ baseColor, scheme, colors });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate color scheme' });
  }
});

// Blend colors endpoint
router.post('/blend', (req, res) => {
  const { color1, color2, weight = 0.5 } = req.body;
  
  if (!color1 || !color2 || !isValidHexColor(color1) || !isValidHexColor(color2)) {
    return res.status(400).json({ error: 'Two valid hex colors are required' });
  }
  
  try {
    const blended = blendColors(color1, color2, weight);
    res.json({ color1, color2, weight, result: blended });
  } catch (error) {
    res.status(500).json({ error: 'Failed to blend colors' });
  }
});

// Save color match/palette endpoint
router.post('/matches', authenticateToken, async (req, res) => {
  try {
    const { base_color, scheme, colors, title, description, is_public = false } = req.body;
    const userId = req.user.userId;
    
    // Validate required fields
    if (!base_color || !scheme || !colors || !Array.isArray(colors)) {
      return res.status(400).json({ 
        error: 'Missing required fields: base_color, scheme, colors array' 
      });
    }
    
    // Validate colors
    if (!isValidHexColor(base_color)) {
      return res.status(400).json({ error: 'Invalid base_color hex format' });
    }
    
    for (const color of colors) {
      if (!isValidHexColor(color)) {
        return res.status(400).json({ error: `Invalid color hex format: ${color}` });
      }
    }
    
    // Insert color match into database
    const result = await query(`
      INSERT INTO color_matches (
        user_id, base_color, scheme, colors, title, description, is_public, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      userId,
      base_color,
      scheme,
      JSON.stringify(colors),
      title || `${scheme} palette`,
      description || '',
      is_public
    ]);
    
    // Get the created color match
    const colorMatch = await query(`
      SELECT id, user_id, base_color, scheme, colors, title, description, is_public, created_at
      FROM color_matches 
      WHERE id = ?
    `, [result.insertId]);
    
    if (colorMatch.length === 0) {
      return res.status(500).json({ error: 'Failed to retrieve saved color match' });
    }
    
    const savedMatch = colorMatch[0];
    // Parse colors back to array
    savedMatch.colors = JSON.parse(savedMatch.colors);
    
    res.status(201).json({
      success: true,
      message: 'Color match saved successfully',
      data: savedMatch
    });
    
  } catch (error) {
    console.error('Error saving color match:', error);
    res.status(500).json({ 
      error: 'Failed to save color match',
      message: error.message 
    });
  }
});

// Get user's color matches endpoint
router.get('/matches', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 50, offset = 0 } = req.query;
    
    const matches = await query(`
      SELECT id, user_id, base_color, scheme, colors, title, description, is_public, created_at
      FROM color_matches 
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), parseInt(offset)]);
    
    // Parse colors for each match
    const parsedMatches = matches.map(match => ({
      ...match,
      colors: JSON.parse(match.colors)
    }));
    
    res.json({
      success: true,
      data: parsedMatches,
      count: parsedMatches.length
    });
    
  } catch (error) {
    console.error('Error fetching color matches:', error);
    res.status(500).json({ 
      error: 'Failed to fetch color matches',
      message: error.message 
    });
  }
});

// Export utility functions for use in other routes
module.exports = {
  router,
  hslToHex,
  hexToRgb,
  hexToHsl,
  isValidHexColor,
  validateHexColor,
  normalizeAngle,
  blendColors,
  getColorScheme
};
