// routes/images/index.js - Refactored image processing routes

const express = require('express');
const multer = require('multer');
const { validationResult } = require('express-validator');
const imageService = require('../../services/imageService');
const { 
  success, 
  created, 
  badRequest, 
  notFound, 
  internalError,
  asyncHandler,
  formatValidationErrors 
} = require('../../utils/response');
const { 
  coordinatesValidation,
  sessionValidation 
} = require('../../middleware/validation');
const { UPLOAD_LIMITS } = require('../../constants');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { 
    fileSize: UPLOAD_LIMITS.MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (UPLOAD_LIMITS.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  }
});

/**
 * @route   GET /images
 * @desc    Get image processing API info
 * @access  Public
 */
router.get('/', (req, res) => {
  success(res, {
    message: 'Image processing API',
    endpoints: [
      'POST /images/extract - Extract colors from image',
      'POST /images/session - Create image extraction session',
      'POST /images/session/:id/sample - Sample color at coordinates',
      'DELETE /images/session/:id - Close extraction session',
      'GET /images/stats - Get service statistics'
    ],
    limits: {
      maxFileSize: `${UPLOAD_LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      allowedTypes: UPLOAD_LIMITS.ALLOWED_MIME_TYPES,
    }
  });
});

/**
 * @route   POST /images/extract
 * @desc    Extract color palette from image (one-shot)
 * @access  Public
 */
router.post('/extract',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    try {
      if (!req.file) {
        return badRequest(res, 'No image file provided');
      }

      const result = await imageService.extractColorPalette(req.file);
      return success(res, result, result.message);
    } catch (error) {
      if (error.message.includes('Unsupported') || 
          error.message.includes('exceeds') ||
          error.message.includes('No image')) {
        return badRequest(res, error.message);
      }
      
      console.error('Image extraction error:', error);
      return internalError(res, 'Failed to extract colors from image');
    }
  })
);

/**
 * @route   POST /images/session
 * @desc    Create image extraction session
 * @access  Public
 */
router.post('/session',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    try {
      if (!req.file) {
        return badRequest(res, 'No image file provided');
      }

      const options = {
        maxWidth: parseInt(req.body.maxWidth) || 1200,
        maxHeight: parseInt(req.body.maxHeight) || 1200,
      };

      const result = await imageService.createExtractionSession(req.file, options);
      return created(res, result, result.message);
    } catch (error) {
      if (error.message.includes('Unsupported') || 
          error.message.includes('exceeds') ||
          error.message.includes('No image')) {
        return badRequest(res, error.message);
      }
      
      console.error('Session creation error:', error);
      return internalError(res, 'Failed to create extraction session');
    }
  })
);

/**
 * @route   POST /images/session/:sessionId/sample
 * @desc    Sample color at specific coordinates
 * @access  Public
 */
router.post('/session/:sessionId/sample',
  sessionValidation,
  coordinatesValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, 'Validation failed', formatValidationErrors(errors));
    }

    try {
      const { sessionId } = req.params;
      const { x, y, normalized } = req.body;

      const result = await imageService.sampleColorAt(sessionId, { x, y, normalized });
      return success(res, result, 'Color sampled successfully');
    } catch (error) {
      if (error.message.includes('Invalid') || error.message.includes('expired')) {
        return notFound(res, error.message);
      }
      
      console.error('Color sampling error:', error);
      return internalError(res, 'Failed to sample color');
    }
  })
);

/**
 * @route   GET /images/session/:sessionId
 * @desc    Get session information
 * @access  Public
 */
router.get('/session/:sessionId',
  sessionValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, 'Validation failed', formatValidationErrors(errors));
    }

    try {
      const { sessionId } = req.params;
      const session = imageService.getSession(sessionId);
      
      if (!session) {
        return notFound(res, 'Session not found or expired');
      }

      const sessionInfo = {
        sessionId,
        width: session.width,
        height: session.height,
        format: session.format,
        originalName: session.originalName,
        originalSize: session.originalSize,
        createdAt: new Date(session.createdAt).toISOString(),
        expiresAt: new Date(session.createdAt + imageService.SESSION_CONFIG?.TTL_MS || 600000).toISOString(),
      };

      return success(res, sessionInfo, 'Session information retrieved');
    } catch (error) {
      console.error('Session info error:', error);
      return internalError(res, 'Failed to retrieve session information');
    }
  })
);

/**
 * @route   DELETE /images/session/:sessionId
 * @desc    Close extraction session
 * @access  Public
 */
router.delete('/session/:sessionId',
  sessionValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, 'Validation failed', formatValidationErrors(errors));
    }

    try {
      const { sessionId } = req.params;
      const result = imageService.closeSession(sessionId);
      return success(res, result, result.message);
    } catch (error) {
      console.error('Session close error:', error);
      return internalError(res, 'Failed to close session');
    }
  })
);

/**
 * @route   GET /images/stats
 * @desc    Get image service statistics
 * @access  Public
 */
router.get('/stats',
  asyncHandler(async (req, res) => {
    try {
      const stats = imageService.getSessionStats();
      return success(res, stats, 'Statistics retrieved successfully');
    } catch (error) {
      console.error('Stats error:', error);
      return internalError(res, 'Failed to retrieve statistics');
    }
  })
);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return badRequest(res, `File size exceeds limit of ${UPLOAD_LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return badRequest(res, 'Too many files uploaded');
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return badRequest(res, 'Unexpected file field');
    }
  }
  
  if (error.message.includes('Unsupported file type')) {
    return badRequest(res, error.message);
  }
  
  return internalError(res, 'File upload error');
});

module.exports = router;
