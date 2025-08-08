const { body, param, query, validationResult } = require('express-validator');

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Color validation helpers
const isValidHexColor = (value) => {
  return /^#[0-9A-F]{6}$/i.test(value);
};

const isValidColorName = (value) => {
  return /^[a-zA-Z0-9\s\-_]{1,50}$/.test(value);
};

// Authentication validation schemas
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('firstName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('lastName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('location')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Location must be between 1 and 100 characters')
    .trim(),
  
  body('birthday')
    .optional()
    .isISO8601()
    .withMessage('Birthday must be a valid date'),
  
  body('gender')
    .optional()
    .isIn(['male', 'female', 'non-binary', 'prefer-not-to-say'])
    .withMessage('Gender must be one of: male, female, non-binary, prefer-not-to-say'),
  
  handleValidationErrors
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

// Color match validation schemas
const createColorMatchValidation = [
  body('primaryColor')
    .custom(isValidHexColor)
    .withMessage('Primary color must be a valid hex color (e.g., #FF6B6B)'),
  
  body('colorScheme')
    .isIn(['complementary', 'analogous', 'triadic', 'tetradic', 'monochromatic', 'freestyle'])
    .withMessage('Color scheme must be one of: complementary, analogous, triadic, tetradic, monochromatic, freestyle'),
  
  body('colors')
    .isArray({ min: 1, max: 10 })
    .withMessage('Colors must be an array with 1-10 items')
    .custom((colors) => {
      return colors.every(color => isValidHexColor(color));
    })
    .withMessage('All colors must be valid hex colors'),
  
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .trim()
    .escape(),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters')
    .trim()
    .escape(),
  
  body('tags')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Tags must be an array with maximum 10 items')
    .custom((tags) => {
      return tags.every(tag => 
        typeof tag === 'string' && 
        tag.length >= 1 && 
        tag.length <= 30 &&
        /^[a-zA-Z0-9\s\-_]+$/.test(tag)
      );
    })
    .withMessage('Each tag must be 1-30 characters and contain only letters, numbers, spaces, hyphens, and underscores'),
  
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean value'),
  
  body('boardId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Board ID must be a positive integer'),
  
  handleValidationErrors
];

const updateColorMatchValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Color match ID must be a positive integer'),
  
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .trim()
    .escape(),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters')
    .trim()
    .escape(),
  
  body('tags')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Tags must be an array with maximum 10 items'),
  
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean value'),
  
  handleValidationErrors
];

// Board validation schemas
const createBoardValidation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Board name must be between 1 and 100 characters')
    .trim()
    .escape(),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters')
    .trim()
    .escape(),
  
  body('type')
    .isIn(['private', 'public'])
    .withMessage('Board type must be either private or public'),
  
  body('category')
    .optional()
    .isIn(['complementary', 'analogous', 'triadic', 'tetradic', 'monochromatic', 'freestyle', 'custom'])
    .withMessage('Category must be a valid color scheme type'),
  
  handleValidationErrors
];

// User profile validation schemas
const updateProfileValidation = [
  body('firstName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes')
    .trim(),
  
  body('lastName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes')
    .trim(),
  
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio must be less than 500 characters')
    .trim()
    .escape(),
  
  body('location')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Location must be between 1 and 100 characters')
    .trim(),
  
  body('website')
    .optional()
    .isURL()
    .withMessage('Website must be a valid URL'),
  
  handleValidationErrors
];

// Community validation schemas
const createPostValidation = [
  body('description')
    .isLength({ min: 1, max: 500 })
    .withMessage('Description must be between 1 and 500 characters')
    .trim()
    .escape(),
  
  body('colors')
    .isArray({ min: 1, max: 10 })
    .withMessage('Colors must be an array with 1-10 items')
    .custom((colors) => {
      return colors.every(color => isValidHexColor(color));
    })
    .withMessage('All colors must be valid hex colors'),
  
  body('colorScheme')
    .optional()
    .isIn(['complementary', 'analogous', 'triadic', 'tetradic', 'monochromatic', 'freestyle'])
    .withMessage('Color scheme must be a valid type'),
  
  body('tags')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Tags must be an array with maximum 10 items'),
  
  handleValidationErrors
];

const commentValidation = [
  param('postId')
    .isInt({ min: 1 })
    .withMessage('Post ID must be a positive integer'),
  
  body('content')
    .isLength({ min: 1, max: 500 })
    .withMessage('Comment must be between 1 and 500 characters')
    .trim()
    .escape(),
  
  handleValidationErrors
];

// Query parameter validation
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

// ID parameter validation
const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer'),
  
  handleValidationErrors
];

module.exports = {
  // Authentication
  registerValidation,
  loginValidation,
  
  // Color matches
  createColorMatchValidation,
  updateColorMatchValidation,
  
  // Boards
  createBoardValidation,
  
  // User profile
  updateProfileValidation,
  
  // Community
  createPostValidation,
  commentValidation,
  
  // Common
  paginationValidation,
  idValidation,
  handleValidationErrors
};
