// routes/colors/index.js - Refactored color routes

const express = require('express');
const { validationResult } = require('express-validator');
const ColorService = require('../../services/colorService');
const { 
  success, 
  created, 
  badRequest, 
  notFound, 
  internalError,
  paginated,
  asyncHandler,
  formatValidationErrors 
} = require('../../utils/response');
const { authenticateToken } = require('../../middleware/auth');
const { 
  createColorMatchValidation,
  updateColorMatchValidation,
  colorValidation 
} = require('../../middleware/validation');

const router = express.Router();

// Disable caching on all color endpoints
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.removeHeader('ETag');
  res.removeHeader('Last-Modified');
  
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
  
  next();
});

/**
 * @route   GET /colors
 * @desc    Get color utilities info
 * @access  Public
 */
router.get('/', (req, res) => {
  success(res, { 
    message: 'Color utilities API',
    endpoints: [
      'GET /colors/validate - Validate hex color',
      'POST /colors/matches - Create color match',
      'GET /colors/matches - Get color matches',
      'GET /colors/matches/:id - Get color match by ID',
      'PUT /colors/matches/:id - Update color match',
      'DELETE /colors/matches/:id - Delete color match'
    ]
  });
});

/**
 * @route   GET /colors/validate
 * @desc    Validate hex color
 * @access  Public
 */
router.get('/validate', 
  colorValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, 'Validation failed', formatValidationErrors(errors));
    }

    try {
      const { hex } = req.query;
      const result = ColorService.validateColor(hex);
      return success(res, result, 'Color validation complete');
    } catch (error) {
      console.error('Color validation error:', error);
      return internalError(res, 'Color validation failed');
    }
  })
);

/**
 * @route   POST /colors/validate
 * @desc    Validate hex color (POST version for health checks)
 * @access  Public
 */
router.post('/validate',
  colorValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, 'Validation failed', formatValidationErrors(errors));
    }

    try {
      const { hex } = req.body;
      const result = ColorService.validateColor(hex);
      return success(res, result, 'Color validation complete');
    } catch (error) {
      console.error('Color validation error:', error);
      return internalError(res, 'Color validation failed');
    }
  })
);

/**
 * @route   POST /colors/matches
 * @desc    Create a new color match
 * @access  Private
 */
router.post('/matches',
  authenticateToken,
  createColorMatchValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, 'Validation failed', formatValidationErrors(errors));
    }

    try {
      const colorMatch = await ColorService.createColorMatch(req.user.userId, req.body);
      return created(res, colorMatch, 'Color match created successfully');
    } catch (error) {
      if (error.message.includes('Invalid') || error.message.includes('required')) {
        return badRequest(res, error.message);
      }
      
      console.error('Create color match error:', error);
      return internalError(res, 'Failed to create color match');
    }
  })
);

/**
 * @route   GET /colors/matches
 * @desc    Get color matches (user's own or public)
 * @access  Public/Private
 */
router.get('/matches',
  asyncHandler(async (req, res) => {
    try {
      const { limit, offset, scheme, privacy, public: isPublic } = req.query;
      
      let result;
      
      if (isPublic === 'true') {
        // Get public color matches
        result = await ColorService.getPublicColorMatches({
          limit,
          offset,
          scheme
        });
      } else if (req.headers.authorization) {
        // Get user's own color matches (if authenticated)
        try {
          const token = req.headers.authorization.split(' ')[1];
          const decoded = ColorService.verifyToken ? ColorService.verifyToken(token) : null;
          
          if (decoded) {
            result = await ColorService.getUserColorMatches(decoded.userId, {
              limit,
              offset,
              scheme,
              privacy
            });
          } else {
            result = await ColorService.getPublicColorMatches({ limit, offset, scheme });
          }
        } catch (authError) {
          // If token is invalid, fall back to public matches
          result = await ColorService.getPublicColorMatches({ limit, offset, scheme });
        }
      } else {
        // No authentication, return public matches
        result = await ColorService.getPublicColorMatches({ limit, offset, scheme });
      }

      return paginated(res, result.colorMatches, result.pagination, 'Color matches retrieved successfully');
    } catch (error) {
      console.error('Get color matches error:', error);
      return internalError(res, 'Failed to retrieve color matches');
    }
  })
);

/**
 * @route   GET /colors/matches/user
 * @desc    Get user's color matches
 * @access  Private
 */
router.get('/matches/user',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const { limit, offset, scheme, privacy } = req.query;
      
      const result = await ColorService.getUserColorMatches(req.user.userId, {
        limit,
        offset,
        scheme,
        privacy
      });

      return paginated(res, result.colorMatches, result.pagination, 'User color matches retrieved successfully');
    } catch (error) {
      console.error('Get user color matches error:', error);
      return internalError(res, 'Failed to retrieve user color matches');
    }
  })
);

/**
 * @route   GET /colors/matches/:id
 * @desc    Get color match by ID
 * @access  Public/Private
 */
router.get('/matches/:id',
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      let userId = null;

      // Extract user ID if authenticated
      if (req.headers.authorization) {
        try {
          const token = req.headers.authorization.split(' ')[1];
          const decoded = ColorService.verifyToken ? ColorService.verifyToken(token) : null;
          userId = decoded?.userId;
        } catch (authError) {
          // Continue without authentication
        }
      }

      const colorMatch = await ColorService.getColorMatchById(id, userId);
      return success(res, colorMatch, 'Color match retrieved successfully');
    } catch (error) {
      if (error.message.includes('not found')) {
        return notFound(res, error.message);
      }
      
      console.error('Get color match error:', error);
      return internalError(res, 'Failed to retrieve color match');
    }
  })
);

/**
 * @route   PUT /colors/matches/:id
 * @desc    Update color match
 * @access  Private
 */
router.put('/matches/:id',
  authenticateToken,
  updateColorMatchValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, 'Validation failed', formatValidationErrors(errors));
    }

    try {
      const { id } = req.params;
      const colorMatch = await ColorService.updateColorMatch(id, req.user.userId, req.body);
      return success(res, colorMatch, 'Color match updated successfully');
    } catch (error) {
      if (error.message.includes('not found')) {
        return notFound(res, error.message);
      }
      
      console.error('Update color match error:', error);
      return internalError(res, 'Failed to update color match');
    }
  })
);

/**
 * @route   DELETE /colors/matches/:id
 * @desc    Delete color match
 * @access  Private
 */
router.delete('/matches/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const result = await ColorService.deleteColorMatch(id, req.user.userId);
      return success(res, null, result.message);
    } catch (error) {
      if (error.message.includes('not found')) {
        return notFound(res, error.message);
      }
      
      console.error('Delete color match error:', error);
      return internalError(res, 'Failed to delete color match');
    }
  })
);

module.exports = router;
