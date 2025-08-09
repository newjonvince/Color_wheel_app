// server/routes/images.js
const express = require('express');
const multer = require('multer');
const Vibrant = require('@vibrant/core').default;
const { NodeImage } = require('@vibrant/image-node');
const sharp = require('sharp');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } }); // 6MB

router.post('/extract-colors', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    // Downscale for speed (no visual output; just for palette analysis)
    const buffer = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 600, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const image = new NodeImage(buffer);
    const vib = new Vibrant(image, { quality: 2 }); // lower = slower but higher quality
    const palette = await vib.getPalette();

    // Build palette list (dedupe + hex uppercase)
    const swatches = Object.values(palette)
      .filter(Boolean)
      .sort((a, b) => (b.getPopulation?.() || 0) - (a.getPopulation?.() || 0));

    const hexes = Array.from(new Set(swatches.map(s => s.getHex().toUpperCase())));
    const dominant = hexes[0] || '#808080';

    return res.json({ dominant, palette: hexes });
  } catch (e) {
    console.error('extract-colors failed:', e);
    return res.status(500).json({ error: 'Extraction failed' });
  }
});

module.exports = router;
