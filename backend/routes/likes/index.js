// routes/likes/index.js - Color match likes routes
const express = require('express');
const { validationResult } = require('express-validator');
const LikesService = require('../../services/likesService');
const { 
  success, 
  created, 
  badRequest, 
  notFound, 
  internalError,
  asyncHandler,
  formatValidationErrors 
} = require('../../utils/response');
const { authenticateToken } = require('../../middleware/auth');
const { idValidation } = require('../../middleware/validation/index');

const router = express.Router();

/**
 * @route   POST /likes/color-matches/:id
 * @desc    Like a color match
 * @access  Private
 */
router.post('/color-matches/:id',
  authenticateToken,
  idValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, 'Validation failed', formatValidationErrors(errors));
    }

    try {
      const { id: colorMatchId } = req.params;
      const result = await LikesService.likeColorMatch(req.user.userId, colorMatchId);
      return created(res, result, result.message);
    } catch (error) {
      if (error.message.includes('not found')) {
        return notFound(res, error.message);
      }
      if (error.message.includes('already liked')) {
        return badRequest(res, error.message);
      }
      
      console.error('Like color match error:', error);
      return internalError(res, 'Failed to like color match');
    }
  })
);

/**
 * @route   DELETE /likes/color-matches/:id
 * @desc    Unlike a color match
 * @access  Private
 */
router.delete('/color-matches/:id',
  authenticateToken,
  idValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, 'Validation failed', formatValidationErrors(errors));
    }

    try {
      const { id: colorMatchId } = req.params;
      const result = await LikesService.unlikeColorMatch(req.user.userId, colorMatchId);
      return success(res, result, result.message);
    } catch (error) {
      if (error.message.includes('not found')) {
        return notFound(res, error.message);
      }
      
      console.error('Unlike color match error:', error);
      return internalError(res, 'Failed to unlike color match');
    }
  })
);

/**
 * @route   GET /likes/color-matches/:id
 * @desc    Get like count and user's like status for a color match
 * @access  Public/Private
 */
router.get('/color-matches/:id',
  idValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, 'Validation failed', formatValidationErrors(errors));
    }

    try {
      const { id: colorMatchId } = req.params;
      let userId = null;

      // Extract user ID if authenticated
      if (req.headers.authorization) {
        try {
          const token = req.headers.authorization.split(' ')[1];
          // You might want to verify the token here
          // For now, we'll get it from the authenticateToken middleware if present
        } catch (authError) {
          // Continue without authentication
        }
      }

      const likeCount = await LikesService.getLikeCount(colorMatchId);
      const isLiked = userId ? await LikesService.isLikedByUser(userId, colorMatchId) : false;

      return success(res, {
        color_match_id: colorMatchId,
        like_count: likeCount,
        is_liked: isLiked
      }, 'Like information retrieved successfully');
    } catch (error) {
      console.error('Get like info error:', error);
      return internalError(res, 'Failed to retrieve like information');
    }
  })
);

/**
 * @route   GET /likes/user/color-matches
 * @desc    Get user's liked color matches
 * @access  Private
 */
router.get('/user/color-matches',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const { limit, offset } = req.query;
      
      const likedColorMatches = await LikesService.getUserLikedColorMatches(req.user.userId, {
        limit: parseInt(limit) || 20,
        offset: parseInt(offset) || 0
      });

      return success(res, {
        color_matches: likedColorMatches,
        count: likedColorMatches.length
      }, 'User liked color matches retrieved successfully');
    } catch (error) {
      console.error('Get user liked color matches error:', error);
      return internalError(res, 'Failed to retrieve liked color matches');
    }
  })
);

/**
 * @route   GET /likes/popular/color-matches
 * @desc    Get most liked color matches
 * @access  Public
 */
router.get('/popular/color-matches',
  asyncHandler(async (req, res) => {
    try {
      const { limit, offset, minLikes } = req.query;
      
      const popularColorMatches = await LikesService.getMostLikedColorMatches({
        limit: parseInt(limit) || 20,
        offset: parseInt(offset) || 0,
        minLikes: parseInt(minLikes) || 1
      });

      return success(res, {
        color_matches: popularColorMatches,
        count: popularColorMatches.length
      }, 'Popular color matches retrieved successfully');
    } catch (error) {
      console.error('Get popular color matches error:', error);
      return internalError(res, 'Failed to retrieve popular color matches');
    }
  })
);

module.exports = router;
