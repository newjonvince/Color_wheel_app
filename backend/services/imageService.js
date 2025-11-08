// services/imageService.js - Image processing business logic

const sharp = require('sharp');
const crypto = require('crypto');
const { SESSION_CONFIG, UPLOAD_LIMITS } = require('../constants');

// Try to load node-vibrant
let Vibrant = null;
try {
  Vibrant = require('node-vibrant');
  if (Vibrant && Vibrant.default && Vibrant.from == null) {
    Vibrant = Vibrant.default;
  }
} catch (_) {
  Vibrant = null;
}

class ImageService {
  constructor() {
    this.imageStore = new Map();
    this.startCleanupInterval();
  }

  /**
   * Start cleanup interval for expired sessions
   */
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.imageStore) {
        if (now - value.createdAt > SESSION_CONFIG.TTL_MS) {
          this.imageStore.delete(key);
        }
      }
    }, SESSION_CONFIG.CLEANUP_INTERVAL).unref?.();
  }

  /**
   * Generate session token
   */
  generateToken() {
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  }

  /**
   * Validate image file
   */
  validateImage(file) {
    if (!file) {
      throw new Error('No image file provided');
    }

    if (file.size > UPLOAD_LIMITS.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds limit of ${UPLOAD_LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    if (!UPLOAD_LIMITS.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error(`Unsupported file type. Allowed types: ${UPLOAD_LIMITS.ALLOWED_MIME_TYPES.join(', ')}`);
    }

    return true;
  }

  /**
   * Process and store image for extraction session
   */
  async createExtractionSession(file, options = {}) {
    this.validateImage(file);

    const { maxWidth = 1200, maxHeight = 1200 } = options;
    const token = this.generateToken();

    try {
      // Process image with sharp
      const processedImage = await sharp(file.buffer)
        .resize(maxWidth, maxHeight, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Get image metadata
      const metadata = await sharp(processedImage).metadata();

      // Store processed image
      this.imageStore.set(token, {
        buffer: processedImage,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        createdAt: Date.now(),
        originalName: file.originalname,
        originalSize: file.size,
      });

      return {
        sessionId: token,
        imageId: token, // Backward compatibility
        token, // Backward compatibility
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        message: 'Image processing session created successfully',
      };
    } catch (error) {
      console.error('Image processing error:', error);
      throw new Error('Failed to process image');
    }
  }

  /**
   * Extract color palette from image
   */
  async extractColorPalette(file, options = {}) {
    this.validateImage(file);

    try {
      // Process image
      const processedBuffer = await sharp(file.buffer)
        .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Extract colors
      const palette = await this.extractPalette(processedBuffer);

      return {
        dominant: palette.dominant,
        colors: palette.hexes,
        slots: palette.hexes, // Backward compatibility
        message: 'Color extraction completed successfully',
      };
    } catch (error) {
      console.error('Color extraction error:', error);
      throw new Error('Failed to extract colors from image');
    }
  }

  /**
   * Sample color at specific coordinates
   */
  async sampleColorAt(sessionId, coordinates) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Invalid or expired session');
    }

    const { x, y, normalized = false } = coordinates;
    
    try {
      let pixelX, pixelY;
      
      if (normalized) {
        // Convert normalized coordinates (0-1) to pixel coordinates
        pixelX = Math.round(x * session.width);
        pixelY = Math.round(y * session.height);
      } else {
        pixelX = Math.round(x);
        pixelY = Math.round(y);
      }

      // Ensure coordinates are within bounds
      pixelX = Math.max(0, Math.min(pixelX, session.width - 1));
      pixelY = Math.max(0, Math.min(pixelY, session.height - 1));

      // Extract pixel color
      const { data } = await sharp(session.buffer)
        .extract({ left: pixelX, top: pixelY, width: 1, height: 1 })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const [r, g, b] = data;
      const hex = this.rgbToHex(r, g, b);

      return {
        hex,
        rgb: { r, g, b },
        coordinates: { x: pixelX, y: pixelY },
        normalized: { x: pixelX / session.width, y: pixelY / session.height },
      };
    } catch (error) {
      console.error('Color sampling error:', error);
      throw new Error('Failed to sample color at coordinates');
    }
  }

  /**
   * Get session data
   */
  getSession(sessionId) {
    const session = this.imageStore.get(sessionId);
    if (!session) return null;

    // Check if session has expired
    if (Date.now() - session.createdAt > SESSION_CONFIG.TTL_MS) {
      this.imageStore.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Close extraction session
   */
  closeSession(sessionId) {
    const existed = this.imageStore.has(sessionId);
    this.imageStore.delete(sessionId);
    
    return {
      closed: existed,
      message: existed ? 'Session closed successfully' : 'Session not found or already closed',
    };
  }

  /**
   * Extract color palette using available libraries
   */
  async extractPalette(buffer) {
    // Try node-vibrant first (most reliable)
    if (Vibrant && typeof Vibrant.from === 'function') {
      try {
        const palette = await Vibrant.from(buffer).getPalette();
        const swatches = Object.values(palette)
          .filter(Boolean)
          .sort((a, b) => (b?.population || 0) - (a?.population || 0));
        
        const hexes = Array.from(new Set(
          swatches
            .map(s => String(s.hex || (s.getHex && s.getHex())).toUpperCase())
            .filter(Boolean)
        ));

        const dominant = hexes[0] || '#808080';
        
        return { dominant, hexes: hexes.slice(0, 8) }; // Limit to 8 colors
      } catch (error) {
        console.warn('node-vibrant failed, falling back to sharp.stats():', error?.message || error);
      }
    }

    // Fallback to sharp stats
    try {
      const { stats } = await sharp(buffer).stats();
      const channels = stats.channels;
      
      if (channels && channels.length >= 3) {
        const [r, g, b] = channels;
        const dominant = this.rgbToHex(
          Math.round(r.mean),
          Math.round(g.mean),
          Math.round(b.mean)
        );
        
        // Generate a simple palette based on the dominant color
        const hexes = this.generatePaletteFromDominant(dominant);
        
        return { dominant, hexes };
      }
    } catch (error) {
      console.warn('Sharp stats failed:', error?.message || error);
    }

    // Last resort: return default palette
    return {
      dominant: '#808080',
      hexes: ['#808080', '#A0A0A0', '#606060', '#C0C0C0', '#404040']
    };
  }

  /**
   * Generate palette from dominant color
   */
  generatePaletteFromDominant(hexColor) {
    const rgb = this.hexToRgb(hexColor);
    if (!rgb) return [hexColor];

    const palette = [hexColor];
    
    // Generate variations
    const variations = [
      { r: Math.min(255, rgb.r + 40), g: Math.min(255, rgb.g + 40), b: Math.min(255, rgb.b + 40) },
      { r: Math.max(0, rgb.r - 40), g: Math.max(0, rgb.g - 40), b: Math.max(0, rgb.b - 40) },
      { r: Math.min(255, rgb.r + 20), g: rgb.g, b: rgb.b },
      { r: rgb.r, g: Math.min(255, rgb.g + 20), b: rgb.b },
      { r: rgb.r, g: rgb.g, b: Math.min(255, rgb.b + 20) },
    ];

    variations.forEach(color => {
      palette.push(this.rgbToHex(color.r, color.g, color.b));
    });

    return palette.slice(0, 6); // Limit to 6 colors
  }

  /**
   * Convert RGB to hex
   */
  rgbToHex(r, g, b) {
    return `#${[r, g, b]
      .map(n => Math.round(Math.max(0, Math.min(255, n)))
        .toString(16)
        .padStart(2, '0'))
      .join('')
      .toUpperCase()}`;
  }

  /**
   * Convert hex to RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    return {
      activeSessions: this.imageStore.size,
      oldestSession: this.imageStore.size > 0 
        ? Math.min(...Array.from(this.imageStore.values()).map(s => s.createdAt))
        : null,
    };
  }
}

// Create singleton instance
const imageService = new ImageService();

module.exports = imageService;
