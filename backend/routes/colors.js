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


// ---- OKLCH utilities (server reconciliation) ----
function srgbToLinear(c){ c/=255; return c<=0.04045? c/12.92: Math.pow((c+0.055)/1.055,2.4); }
function linearToSrgb(c){ const v=c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055; return Math.max(0,Math.min(255,Math.round(v*255))); }
function hexToRgbS(hex){ let c=hex.replace('#',''); if(c.length===3) c=c.split('').map(ch=>ch+ch).join(''); const n=parseInt(c,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
function rgbToHexS(r,g,b){ const h=n=>n.toString(16).padStart(2,'0'); return ('#'+h(r)+h(g)+h(b)).toUpperCase(); }
function rgbToOklabS(r,g,bInput){ const R=srgbToLinear(r), G=srgbToLinear(g), B=srgbToLinear(bInput);
  const l=0.4122214708*R+0.5363325363*G+0.0514459929*B;
  const m=0.2119034982*R+0.6806995451*G+0.1073969566*B;
  const s=0.0883024619*R+0.2817188376*G+0.6299787005*B;
  const l_=Math.cbrt(l), m_=Math.cbrt(m), s_=Math.cbrt(s);
  const L=0.2104542553*l_+0.7936177850*m_-0.0040720468*s_;
  const a=1.9779984951*l_-2.4285922050*m_+0.4505937099*s_;
  const bVal=0.0259040371*l_+0.7827717662*m_-0.8086757660*s_;
  return {L,a,b:bVal}; }
function oklabToRgbS(L,a,bInput){ const l_=Math.pow(L+0.3963377774*a+0.2158037573*bInput,3);
  const m_=Math.pow(L-0.1055613458*a-0.0638541728*bInput,3);
  const s_=Math.pow(L-0.0894841775*a-1.2914855480*bInput,3);
  const R=+4.0767416621*l_-3.3077115913*m_+0.2309699292*s_;
  const G=-1.2684380046*l_+2.6097574011*m_-0.3413193965*s_;
  const B=-0.0041960863*l_-0.7034186147*m_+1.7076147010*s_;
  return {r:linearToSrgb(R), g:linearToSrgb(G), b:linearToSrgb(B)}; }
function oklabToOklchS(L,a,bInput){ const C=Math.sqrt(a*a+bInput*bInput); let h=Math.atan2(bInput,a)*180/Math.PI; if(h<0) h+=360; return {L,C,h}; }
function oklchToOklabS(L,C,h){ const hr=h*Math.PI/180; return {L, a:C*Math.cos(hr), b:C*Math.sin(hr)}; }
function hexToOklchS(hex){ const {r,g,b}=hexToRgbS(hex); const {L,a,b:bVal}=rgbToOklabS(r,g,b); return oklabToOklchS(L,a,bVal); }
function oklchToHexClampedS(L,C,h,iter=20){ let lo=0,hi=C,best=null;
  for(let i=0;i<iter;i++){ const mid=(lo+hi)/2; const {a,b:bLab}=oklchToOklabS(L,mid,h); const {r,g,b:bRgb}=oklabToRgbS(L,a,bLab);
    const ok=r>=0&&r<=255&&g>=0&&g<=255&&bRgb>=0&&bRgb<=255;
    if(ok){ best={r,g,b:bRgb}; lo=mid; } else { hi=mid; } }
  if(!best){ const {a,b:bLab2}=oklchToOklabS(L,0,h); const {r,g,b:bRgb2}=oklabToRgbS(L,a,bLab2); return rgbToHexS(r,g,bRgb2); }
  return rgbToHexS(best.r,best.g,best.b); }
const OFFSETS_OKLCH_S = { analogous:[0,30,-30], complementary:[0,180], triadic:[0,120,240], tetradic:[0,90,180,270], 'split-complementary':[0,150,-150], monochromatic:[0] };
function generateOklchSchemeS(baseHex, type='analogous'){ const {L,C,h}=hexToOklchS(baseHex);
  const deltas=OFFSETS_OKLCH_S[type]||OFFSETS_OKLCH_S.analogous;
  const hues=deltas.map(d=> (h+d+360)%360);
  const colors=hues.map(hh=>oklchToHexClampedS(L,C,hh));
  return { baseHex: baseHex.toUpperCase(), scheme:type, hues, colors, scheme_version:'oklch-v1' }; }
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
