// routes/auth/index.js - Refactored authentication routes

const express = require('express');
const { validationResult } = require('express-validator');
const AuthService = require('../../services/authService');
const { 
  success, 
  created, 
  badRequest, 
  unauthorized, 
  conflict, 
  internalError,
  asyncHandler,
  formatValidationErrors 
} = require('../../utils/response');
const { 
  authLimiter, 
  registrationLimiter, 
  passwordResetLimiter 
} = require('../../middleware/rateLimiting');
const { authenticateToken } = require('../../middleware/auth');
const { 
  registerValidation, 
  loginValidation, 
  updateProfileValidation 
} = require('../../middleware/validation/index');
const { ERROR_MESSAGES } = require('../../constants');

const router = express.Router();

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', 
  registrationLimiter,
  registerValidation,
  asyncHandler(async (req, res) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, 'Validation failed', formatValidationErrors(errors));
    }

    try {
      const result = await AuthService.registerUser(req.body);
      return created(res, result, result.message);
    } catch (error) {
      if (error.message === ERROR_MESSAGES.USER_ALREADY_EXISTS) {
        return conflict(res, error.message);
      }
      
      console.error('Registration error:', error);
      return internalError(res, 'Failed to create user account');
    }
  })
);

/**
 * @route   POST /auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login',
  authLimiter,
  loginValidation,
  asyncHandler(async (req, res) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, 'Validation failed', formatValidationErrors(errors));
    }

    try {
      const { email, password } = req.body;
      const result = await AuthService.loginUser(email, password);
      return success(res, result, result.message);
    } catch (error) {
      if (error.message === ERROR_MESSAGES.INVALID_CREDENTIALS || 
          error.message === ERROR_MESSAGES.UNAUTHORIZED_ACCESS) {
        return unauthorized(res, error.message);
      }
      
      console.error('Login error:', error);
      return internalError(res, 'Login failed');
    }
  })
);

/**
 * @route   POST /auth/demo-login
 * @desc    Demo login for testing
 * @access  Public
 */
router.post('/demo-login',
  authLimiter,
  asyncHandler(async (req, res) => {
    try {
      const result = await AuthService.demoLogin();
      return success(res, result, result.message);
    } catch (error) {
      console.error('Demo login error:', error);
      return internalError(res, 'Demo login failed');
    }
  })
);

/**
 * @route   GET /auth/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const user = await AuthService.getUserProfile(req.user.userId);
      return success(res, { user }, 'Profile retrieved successfully');
    } catch (error) {
      if (error.message === ERROR_MESSAGES.USER_NOT_FOUND) {
        return unauthorized(res, error.message);
      }
      
      console.error('Profile fetch error:', error);
      return internalError(res, 'Failed to fetch profile');
    }
  })
);

/**
 * @route   PUT /auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile',
  authenticateToken,
  updateProfileValidation,
  asyncHandler(async (req, res) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, 'Validation failed', formatValidationErrors(errors));
    }

    try {
      const user = await AuthService.updateUserProfile(req.user.userId, req.body);
      return success(res, { user }, 'Profile updated successfully');
    } catch (error) {
      if (error.message === ERROR_MESSAGES.USERNAME_ALREADY_TAKEN) {
        return conflict(res, error.message);
      }
      
      console.error('Profile update error:', error);
      return internalError(res, 'Failed to update profile');
    }
  })
);

/**
 * @route   POST /auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      const result = await AuthService.logoutUser(req.user.userId, token);
      return success(res, null, result.message);
    } catch (error) {
      console.error('Logout error:', error);
      return internalError(res, 'Logout failed');
    }
  })
);

/**
 * @route   GET /auth/verify
 * @desc    Verify token validity
 * @access  Private
 */
router.get('/verify',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const user = await AuthService.getUserProfile(req.user.userId);
      return success(res, { user, valid: true }, 'Token is valid');
    } catch (error) {
      return unauthorized(res, 'Invalid token');
    }
  })
);

module.exports = router;
