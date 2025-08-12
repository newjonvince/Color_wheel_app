
const { body, param, query, validationResult } = require('express-validator');

// Sensitive fields that should be masked in error responses
const SENSITIVE_FIELDS = new Set(['password', 'newPassword', 'confirmPassword', 'currentPassword']);

// Shared error handler with sensitive field masking
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('🚨 Validation errors:', JSON.stringify(errors.array(), null, 2));
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: SENSITIVE_FIELDS.has(err.path) ? '***' : err.value, // Mask sensitive fields
        location: err.location
      }))
    });
  }
  next();
};

// Helpers
const isValidHexColor = v => /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(v);

// Sanitize hex color - prepend # and uppercase if needed
const sanitizeHexColor = (value) => {
  if (!value) return value;
  let hex = String(value).trim();
  if (!hex.startsWith('#')) hex = '#' + hex;
  return hex.toUpperCase();
};

// Validate and construct a proper date from birthday components
const validateBirthday = (month, day, year) => {
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthIndex = monthNames.indexOf(month);
  if (monthIndex === -1) return false;
  
  const date = new Date(parseInt(year), monthIndex, parseInt(day));
  const isValidDate = date.getFullYear() == year && date.getMonth() == monthIndex && date.getDate() == day;
  
  if (!isValidDate) return false;
  
  // Check age >= 1 (must be at least 1 year old)
  const today = new Date();
  const age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  const dayDiff = today.getDate() - date.getDate();
  
  const actualAge = age - ((monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) ? 1 : 0);
  return actualAge >= 1;
};

// --- Auth ---
const registerValidation = [
  body('email')
    .isEmail().withMessage('Valid email required')
    .bail() // Stop on first error for better performance
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6, max: 128 }).withMessage('Password must be 6-128 characters')
    .bail(),
  body('username')
    .isLength({ min: 3, max: 30 }).withMessage('Username 3-30 chars')
    .bail()
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Letters, numbers, underscores only')
    .customSanitizer(v => v?.toLowerCase()),
  body('location').optional().isLength({ min: 1, max: 100 }).trim(),
  // Combined birthday validation for better date checking
  body('birthday').custom((value, { req }) => {
    const { month, day, year } = value || {};
    if (!month || !day || !year) {
      throw new Error('Birthday month, day, and year are required');
    }
    if (!validateBirthday(month, day, year)) {
      throw new Error('Invalid birthday or age must be at least 1 year');
    }
    return true;
  }),
  body('gender')
    .optional()
    .isString()
    .isIn(['male','female','non-binary','prefer-not-to-say','Female','Male','Specify another','Prefer not to say'])
    .withMessage('Invalid gender')
    .customSanitizer(v => {
      const map = {
        'Female':'female', 'Male':'male', 'Specify another':'non-binary', 'Prefer not to say':'prefer-not-to-say'
      };
      return map[v] || v;
    }),
  handleValidationErrors
];

const loginValidation = [
  body('email')
    .isEmail().withMessage('Valid email required')
    .bail()
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .bail(),
  handleValidationErrors
];

// --- Color Matches ---
const createColorMatchValidation = [
  body('base_color')
    .customSanitizer(sanitizeHexColor) // Sanitize hex input
    .custom(isValidHexColor).withMessage('base_color must be valid hex color')
    .bail(),
  body('scheme')
    .isIn(['complementary','analogous','triadic','tetradic','monochromatic'])
    .withMessage('Invalid scheme')
    .bail(),
  body('colors')
    .isArray({ min: 1, max: 10 }).withMessage('colors must be array 1-10')
    .bail()
    .customSanitizer(arr => arr.map(sanitizeHexColor)) // Sanitize all hex colors
    .custom(arr => arr.every(isValidHexColor)).withMessage('All colors must be valid hex colors'),
  // Accept both is_public (boolean) and privacy ('private'|'public') for flexibility
  body('privacy').optional().isIn(['private','public']).withMessage('privacy must be private/public'),
  body('is_public').optional().isBoolean().withMessage('is_public must be boolean'),
  // Sanitizer to convert is_public to privacy if needed
  body().custom((value, { req }) => {
    if (req.body.is_public !== undefined && req.body.privacy === undefined) {
      req.body.privacy = req.body.is_public ? 'public' : 'private';
    }
    return true;
  }),
  body('title').optional().isLength({ min: 1, max: 100 }).trim(),
  body('description').optional().isLength({ max: 500 }).trim(),
  body('is_locked').optional().isBoolean(),
  body('locked_color')
    .optional()
    .customSanitizer(sanitizeHexColor)
    .custom(isValidHexColor).withMessage('locked_color must be valid hex color'),
  handleValidationErrors
];

const updateColorMatchValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID must be positive integer'),
  body('privacy').optional().isIn(['private', 'public']),
  handleValidationErrors
];

// --- Boards ---
const createBoardValidation = [
  body('name').isLength({ min: 1, max: 100 }).trim().escape(),
  body('description').optional().isLength({ max: 500 }).trim().escape(),
  body('type').isIn(['private','public']).withMessage('type must be private/public'),
  body('scheme')
    .optional()
    .isIn(['complementary','analogous','triadic','tetradic','monochromatic','freestyle','custom']),
  handleValidationErrors
];

// --- Community ---
const createPostValidation = [
  body('description')
    .isLength({ min: 1, max: 500 }).withMessage('Description must be 1-500 characters')
    .bail()
    .trim().escape(),
  body('colors')
    .isArray({ min: 1, max: 10 }).withMessage('colors must be array 1-10')
    .bail()
    .customSanitizer(arr => arr.map(sanitizeHexColor)) // Sanitize all hex colors
    .custom(arr => arr.every(isValidHexColor)).withMessage('All colors must be valid hex colors'),
  body('colorScheme')
    .optional()
    .isIn(['complementary','analogous','triadic','tetradic','monochromatic','freestyle'])
    .withMessage('Invalid color scheme'),
  body('tags')
    .optional()
    .isArray({ max: 10 }).withMessage('Maximum 10 tags allowed')
    .custom(arr => arr.every(tag => typeof tag === 'string' && tag.length <= 50))
    .withMessage('Each tag must be a string with max 50 characters'),
  handleValidationErrors
];

const commentValidation = [
  param('postId').isInt({ min: 1 }).withMessage('Post ID must be positive integer'),
  body('content').isLength({ min: 1, max: 500 }).trim().escape(),
  handleValidationErrors
];

// --- Common ---
const paginationValidation = [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  handleValidationErrors
];

const idValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID must be positive integer'),
  handleValidationErrors
];

// --- Profile ---
const updateProfileValidation = [
  body('firstName').optional().isLength({ min:1, max:50 }).matches(/^[a-zA-Z\s\-']+$/).trim(),
  body('lastName').optional().isLength({ min:1, max:50 }).matches(/^[a-zA-Z\s\-']+$/).trim(),
  body('bio').optional().isLength({ max:500 }).trim().escape(),
  body('location').optional().isLength({ min:1, max:100 }).trim(),
  body('website').optional().isURL(),
  handleValidationErrors
];

module.exports = {
  registerValidation,
  loginValidation,
  createColorMatchValidation,
  updateColorMatchValidation,
  createBoardValidation,
  updateProfileValidation,
  createPostValidation,
  commentValidation,
  paginationValidation,
  idValidation,
  handleValidationErrors
};
