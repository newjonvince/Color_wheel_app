/**
 * routes/images.js (optimized)
 * Image palette extraction + pixel sampling with image tokens.
 *
 * Endpoints:
 *  POST /api/images/extract-colors   (multipart/form-data: image)
 *      -> { dominant, palette: string[], imageId, width, height }
 *
 *  POST /api/images/sample-color     (application/json: { imageId, x, y, units? })
 *      -> { hex }
 *
 *  POST /api/images/close-session    (application/json: { imageId })
 *      -> { success: true }
 *
 * Notes:
 *  - Uses in-memory store with TTL (default 10 minutes) to cache uploaded images by token.
 *  - Sampling coordinates:
 *      - If units === 'px', x and y are pixel coordinates.
 *      - Otherwise, x and y are normalized [0..1].
 *  - Performance: store raw RGBA buffer for O(1) pixel reads during sampling.
 */

const express = require('express');
const multer = require('multer');
const Vibrant = require('@vibrant/core').default;
const { NodeImage } = require('@vibrant/image-node');
const sharp = require('sharp');
const crypto = require('crypto');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 } // 12MB
});

// ---------------- Image token store (in-memory) ----------------
// Store normalized PNG buffer and precomputed raw RGBA for fast sampling
const IMAGE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const imageStore = new Map(); // token -> { buffer, raw, width, height, mime, createdAt }

function makeToken() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

function getImage(token) {
  const rec = imageStore.get(token);
  if (!rec) return null;
  if (Date.now() - rec.createdAt > IMAGE_TTL_MS) {
    imageStore.delete(token);
    return null;
  }
  return rec;
}

// Cleanup timer
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of imageStore) {
    if (now - v.createdAt > IMAGE_TTL_MS) imageStore.delete(k);
  }
}, 5 * 60 * 1000).unref?.();

// ---------------- Helpers ----------------
function toHex(r, g, b) {
  const c = (n) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${c(r)}${c(g)}${c(b)}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function getPaletteFromBuffer(buffer) {
  const image = new NodeImage(buffer);
  const vib = new Vibrant(image, { quality: 2 });
  const palette = await vib.getPalette();
  const swatches = Object.values(palette)
    .filter(Boolean)
    .sort((a, b) => (b.getPopulation?.() || 0) - (a.getPopulation?.() || 0));
  const hexes = Array.from(new Set(swatches.map(s => s.getHex().toUpperCase())));
  const dominant = hexes[0] || '#808080';
  return { dominant, hexes };
}

// ---------------- Routes ----------------

/**
 * POST /api/images/extract-colors
 * Multipart: field name 'image'
 */
router.post('/extract-colors', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // Normalize to sRGB, rotate by EXIF, keep alpha, store as PNG for sampling accuracy
    const normalized = await sharp(req.file.buffer)
      .rotate()
      .toColourspace('srgb')
      .ensureAlpha()
      .png({ compressionLevel: 6 })
      .toBuffer();

    const meta = await sharp(normalized).metadata();

    // Build palette from a downscaled version for speed
    const paletteBuffer = await sharp(normalized)
      .resize({ width: 600, withoutEnlargement: true })
      .toBuffer();

    const { dominant, hexes } = await getPaletteFromBuffer(paletteBuffer);

    // Precompute raw RGBA once for fast sampling
    const raw = await sharp(normalized).ensureAlpha().raw().toBuffer();

    // Save normalized + raw buffer to token store
    const token = makeToken();
    imageStore.set(token, {
      buffer: normalized, // PNG, if needed later
      raw,                // Uint8Array RGBA
      width: meta.width,
      height: meta.height,
      mime: 'image/png',
      createdAt: Date.now(),
    });

    return res.json({
      dominant,
      palette: hexes,
      imageId: token,
      width: meta.width,
      height: meta.height,
    });
  } catch (e) {
    console.error('extract-colors failed:', e);
    return res.status(500).json({ error: 'Extraction failed' });
  }
});

/**
 * POST /api/images/sample-color
 * JSON: { imageId, x, y, units? } where units ∈ {'px', 'normalized'} (default normalized)
 */
router.post('/sample-color', express.json(), async (req, res) => {
  try {
    const { imageId, x, y, units } = req.body || {};
    if (!imageId || (typeof x !== 'number') || (typeof y !== 'number')) {
      return res.status(400).json({ error: 'Missing imageId, x, or y' });
    }

    const rec = getImage(imageId);
    if (!rec) return res.status(404).json({ error: 'Image token not found or expired' });

    const width = rec.width || 1;
    const height = rec.height || 1;
    const isPx = units === 'px';

    const px = isPx ? x : x * width;
    const py = isPx ? y : y * height;

    const left = Math.floor(clamp(px, 0, width - 1));
    const top  = Math.floor(clamp(py, 0, height - 1));

    // Fast path: read from precomputed raw RGBA buffer
    if (rec.raw && rec.raw.length === width * height * 4) {
      const idx = (top * width + left) * 4;
      const r = rec.raw[idx];
      const g = rec.raw[idx + 1];
      const b = rec.raw[idx + 2];
      const hex = toHex(r, g, b);
      return res.json({ hex, x: left, y: top, width, height });
    }

    // Fallback path (should rarely hit): single-pixel extract via sharp
    const pixel = await sharp(rec.buffer)
      .extract({ left, top, width: 1, height: 1 })
      .ensureAlpha()
      .raw()
      .toBuffer();

    const [r, g, b/*, a*/] = pixel;
    const hex = toHex(r, g, b);

    return res.json({ hex, x: left, y: top, width, height });
  } catch (e) {
    console.error('sample-color failed:', e);
    return res.status(500).json({ error: 'Sampling failed' });
  }
});

/**
 * POST /api/images/close-session
 * JSON: { imageId }
 * Explicitly free memory before TTL for better perf on short sessions.
 */
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
