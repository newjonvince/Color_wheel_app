// routes/images.js — v2 fix for "NodeImage is not a constructor"
// Switches to robust palette extraction with primary: node-vibrant, fallback: sharp.stats()
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');

// Try to load node-vibrant (simplest, most compatible)
let Vibrant = null;
try {
  Vibrant = require('node-vibrant');
  // In some installs, it's under .default when transpiled
  if (Vibrant && Vibrant.default && Vibrant.from == null) Vibrant = Vibrant.default;
} catch (_) {
  Vibrant = null;
}

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

const IMAGE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const imageStore = new Map(); // token -> { buffer, raw, width, height, mime, createdAt }

const makeToken = () => (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));
const getImage = (token) => {
  const rec = imageStore.get(token);
  if (!rec) return null;
  if (Date.now() - rec.createdAt > IMAGE_TTL_MS) { imageStore.delete(token); return null; }
  return rec;
};
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of imageStore) if (now - v.createdAt > IMAGE_TTL_MS) imageStore.delete(k);
}, 5 * 60 * 1000).unref?.();

const toHex = (r,g,b) => `#${[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase()}`;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

async function extractPalette(buffer) {
  // Primary: node-vibrant if available
  if (Vibrant && typeof Vibrant.from === 'function') {
    try {
      const palette = await Vibrant.from(buffer).getPalette();
      const swatches = Object.values(palette).filter(Boolean).sort((a,b)=>(b?.population || 0)-(a?.population || 0));
      const hexes = Array.from(new Set(swatches.map(s=>String(s.hex || s.getHex && s.getHex()).toUpperCase()).filter(Boolean)));
      const dominant = hexes[0] || '#808080';
      return { dominant, hexes };
    } catch (e) {
      console.warn('node-vibrant failed, falling back to sharp.stats():', e?.message || e);
    }
  }

  // Fallback: sharp.stats dominant + simple quantization sample
  const stats = await sharp(buffer).stats();
  const d = stats.dominant || { r: 128, g: 128, b: 128 };
  const dominant = toHex(d.r, d.g, d.b);

  // Build a tiny 64x64 thumbnail and sample a grid to produce ~6 diverse colors
  const thumb = await sharp(buffer).resize(64, 64, { fit: 'inside', withoutEnlargement: true }).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { data, info } = thumb; // info.width, info.height
  const width = info.width, height = info.height;
  const picks = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 6));
  for (let y = step; y < height; y += step) {
    for (let x = step; x < width; x += step) {
      const idx = (y * width + x) * 4;
      picks.push(toHex(data[idx], data[idx+1], data[idx+2]));
    }
  }
  // Dedup while preserving order
  const seen = new Set();
  const hexes = [];
  for (const h of picks) {
    if (!seen.has(h)) {
      seen.add(h);
      hexes.push(h);
      if (hexes.length >= 8) break;
    }
  }
  if (!hexes.includes(dominant)) hexes.unshift(dominant);
  return { dominant, hexes };
}

// --- Compat alias for /extract-session (so clients don’t see 404) ---
router.post('/extract-session', upload.single('image'), async (req, res) => {
  try {
    req.headers['x-session-alias'] = '1';
    return extractColorsHandler(req, res);
  } catch (e) {
    return res.status(500).json({ error: 'Session init failed' });
  }
});

// Core handler lifted so both routes can call it
async function extractColorsHandler(req, res) {
  try {
    // Accept common field names
    const file = req.file || (req.files && (req.files.image || req.files.photo || req.files.file));
    if (!file) return res.status(400).json({ error: 'No image provided', field: 'image' });

    if (file.mimetype === 'image/heic' || (file.originalname || '').toLowerCase().endsWith('.heic')) {
      return res.status(415).json({ error: 'HEIC format not supported. Please use JPEG, PNG, or WebP.' });
    }

    // Normalize to sRGB PNG for consistent sampling
    const normalized = await sharp(file.buffer).rotate().toColourspace('srgb').ensureAlpha().png({ compressionLevel: 6 }).toBuffer();
    const meta = await sharp(normalized).metadata();

    // Palette
    const paletteBuffer = await sharp(normalized).resize({ width: 600, withoutEnlargement: true }).toBuffer();
    const { dominant, hexes } = await extractPalette(paletteBuffer);

    // Precompute raw buffer for fast /sample-color
    const raw = await sharp(normalized).ensureAlpha().raw().toBuffer();

    const token = makeToken();
    imageStore.set(token, { buffer: normalized, raw, width: meta.width, height: meta.height, mime: 'image/png', createdAt: Date.now() });

    const payload = { dominant, palette: hexes, imageId: token, width: meta.width, height: meta.height };
    if (req.headers['x-session-alias']) {
      return res.json({ ...payload, sessionId: token, token });
    }
    return res.json(payload);
  } catch (e) {
    console.error('extract-colors failed:', e);
    return res.status(500).json({ error: 'Extraction failed' });
  }
}

router.post('/extract-colors', upload.single('image'), extractColorsHandler);

router.post('/sample-color', express.json(), async (req, res) => {
  try {
    const { imageId, x, y, units = 'norm', radius = 0 } = req.body || {};
    if (!imageId || (typeof x !== 'number') || (typeof y !== 'number')) return res.status(400).json({ error: 'Missing imageId, x, or y' });
    const rec = getImage(imageId);
    if (!rec) return res.status(404).json({ error: 'Image token not found or expired' });

    const width = rec.width || 1, height = rec.height || 1;
    const isPx = units === 'px';
    const px = isPx ? x : x * width;
    const py = isPx ? y : y * height;
    const rpx = Math.max(0, Math.min(
      24, // hard cap for performance
      Math.round(isPx ? radius : (radius || 0) * Math.min(width, height))
    ));

    const left = Math.floor(clamp(px, 0, width - 1));
    const top  = Math.floor(clamp(py, 0, height - 1));

    if (rec.raw && rec.raw.length === width * height * 4) {
      if (rpx <= 1) {
        const idx = (top * width + left) * 4;
        const hex = toHex(rec.raw[idx], rec.raw[idx+1], rec.raw[idx+2]);
        return res.json({ hex, x: left, y: top, width, height });
      } else {
        let rs=0, gs=0, bs=0, n=0;
        for (let yy = top - rpx; yy <= top + rpx; yy++) {
          if (yy < 0 || yy >= height) continue;
          for (let xx = left - rpx; xx <= left + rpx; xx++) {
            if (xx < 0 || xx >= width) continue;
            const idx = (yy * width + xx) * 4;
            rs += rec.raw[idx]; gs += rec.raw[idx+1]; bs += rec.raw[idx+2]; n++;
          }
        }
        const hex = toHex(Math.round(rs/n), Math.round(gs/n), Math.round(bs/n));
        return res.json({ hex, x: left, y: top, width, height, r: rpx });
      }
    }

    // Fallback when raw is not cached: extract a small block and average
    const k = Math.max(1, 2 * rpx + 1);
    const { data, info } = await sharp(rec.buffer)
      .extract({ left: Math.max(0, left - rpx), top: Math.max(0, top - rpx),
                 width: Math.min(k, width), height: Math.min(k, height) })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let rs=0, gs=0, bs=0;
    for (let i = 0; i < data.length; i += 4) { rs += data[i]; gs += data[i+1]; bs += data[i+2]; }
    const area = info.width * info.height;
    const hex = toHex(Math.round(rs/area), Math.round(gs/area), Math.round(bs/area));
    return res.json({ hex, x: left, y: top, width, height });
  } catch (e) {
    console.error('sample-color failed:', e);
    return res.status(500).json({ error: 'Sampling failed' });
  }
});

router.post('/close-session', express.json(), (req, res) => {
  try {
    const { imageId } = req.body || {};
    if (!imageId) return res.status(400).json({ error: 'imageId is required' });
    if (!imageStore.has(imageId)) return res.status(404).json({ error: 'Image token not found' });
    imageStore.delete(imageId);
    return res.json({ success: true });
  } catch (e) {
    console.error('close-session failed:', e);
    return res.status(500).json({ error: 'Close session failed' });
  }
});

module.exports = router;
