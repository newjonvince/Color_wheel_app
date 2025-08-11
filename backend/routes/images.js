// backend/routes/images.js
// Enhanced image color extraction route with frontend integration,
// authentication support, rate limiting, and comprehensive error handling.

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const Vibrant = require('@vibrant/core').default;
const { NodeImage } = require('@vibrant/image-node');
const sharp = require('sharp');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Rate limiting for image processing (more lenient for development/testing)
const imageProcessingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased limit: 100 image processing requests per windowMs
  message: {
    error: 'TooManyRequests',
    message: 'Too many image processing requests. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for authenticated users in development
  skip: (req) => {
    return process.env.NODE_ENV === 'development' && req.user;
  }
});

// ---------- Multer setup (memory storage + limits + file type filter) ----------
const MAX_FILE_MB = Number(process.env.IMG_MAX_MB || 6);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (okTypes.includes(file.mimetype) || file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'image'));
  },
});

// Small helper to clamp numeric inputs
const clamp = (n, min, max, def) => {
  const x = Number(n);
  if (Number.isFinite(x)) return Math.min(max, Math.max(min, x));
  return def;
};

// ---------- GET / (API Info) ------------------------------------------------
router.get('/', (req, res) => {
  res.json({
    service: 'Image Processing API',
    version: '1.0.0',
    endpoints: {
      'GET /': 'This help message',
      'POST /extract-colors': 'Extract color palette from uploaded image',
      'GET /info': 'Get image processing capabilities and limits'
    },
    limits: {
      maxFileSize: `${MAX_FILE_MB}MB`,
      supportedFormats: ['JPEG', 'PNG', 'WebP', 'HEIC', 'HEIF'],
      maxPaletteSize: 16,
      rateLimit: '20 requests per 15 minutes'
    }
  });
});

// ---------- GET /info (Processing Info) ----------------------------------------
router.get('/info', (req, res) => {
  res.json({
    maxFileSize: MAX_FILE_MB * 1024 * 1024,
    maxFileSizeMB: MAX_FILE_MB,
    supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    defaultSettings: {
      maxWidth: 600,
      quality: 85,
      topN: 8,
      vibrantQuality: 2
    },
    limits: {
      maxWidth: { min: 200, max: 2000 },
      quality: { min: 40, max: 100 },
      topN: { min: 1, max: 16 },
      vibrantQuality: { min: 1, max: 5 }
    }
  });
});

// ---------- POST /extract-colors ------------------------------------------------
// Form field: "image" (multipart/form-data)
// Optional authentication - works for both authenticated and anonymous users
router.post('/extract-colors', imageProcessingLimiter, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'NoImage',
        message: 'No image uploaded. Send multipart/form-data with field name "image".',
      });
    }

    // Tuning via query/body (all optional)
    const maxWidth = clamp(req.query.maxWidth ?? req.body?.maxWidth, 200, 2000, 600);
    const quality = clamp(req.query.quality ?? req.body?.quality, 40, 100, 85);
    const topN = clamp(req.query.topN ?? req.body?.topN, 1, 16, 8);
    const qualitySamples = clamp(req.query.vibrantQuality ?? req.body?.vibrantQuality, 1, 5, 2); // lower = slower, more accurate

    // Preprocess image: autorotate + resize for speed, then to a common format
    const buffer = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    // Extract palette
    const image = new NodeImage(buffer);
    const vib = new Vibrant(image, { quality: qualitySamples });
    const palette = await vib.getPalette(); // { Vibrant, Muted, DarkVibrant, ... }

    // Build swatches with hex + population, sort by population desc, unique by hex
    const seen = new Set();
    const swatches = Object.entries(palette)
      .map(([name, s]) => (s ? { name, hex: s.getHex().toUpperCase(), population: s.getPopulation?.() || 0 } : null))
      .filter(Boolean)
      .sort((a, b) => b.population - a.population)
      .filter((sw) => (seen.has(sw.hex) ? false : (seen.add(sw.hex), true)))
      .slice(0, topN);

    const dominant = swatches[0]?.hex || '#808080';

    // Format response for frontend compatibility
    const paletteHexArray = swatches.map(s => s.hex); // Simple hex array for CoolorsColorExtractor
    
    return res.json({
      success: true, // Frontend expects 'success' field
      ok: true,
      dominant,
      palette: paletteHexArray, // Simple array for frontend compatibility
      colors: swatches, // Detailed array with population data
      count: swatches.length,
      meta: {
        widthUsed: maxWidth,
        qualityUsed: quality,
        vibrantQuality: qualitySamples,
        bytesIn: req.file.size,
        bytesProcessed: buffer.length,
        mime: req.file.mimetype,
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - (req._startTime || Date.now())
      },
    });
  } catch (err) {
    // Multer "unexpected file type" bubbles up as MulterError
    if (err instanceof multer.MulterError) {
      const code = err.code;
      const msg =
        code === 'LIMIT_FILE_SIZE'
          ? `Image is larger than ${MAX_FILE_MB}MB.`
          : code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Unsupported file type. Please upload a valid image.'
          : 'Upload error.';
      return res.status(400).json({ ok: false, error: code, message: msg });
    }

    console.error('extract-colors failed:', err);
    return res.status(500).json({ ok: false, error: 'ServerError', message: 'Extraction failed' });
  }
});

module.exports = router;
