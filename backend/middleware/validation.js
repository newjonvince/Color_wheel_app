
const { body, param, query, validationResult } = require('express-validator');

// Shared error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('🚨 Validation errors:', JSON.stringify(errors.array(), null, 2));
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value,
        location: err.location
      }))
    });
  }
  next();
};

// Helpers
const isValidHexColor = v => /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(v);

// --- Auth ---
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6, max: 128 }).withMessage('Password must be 6-128 characters'),
  body('username')
    .isLength({ min: 3, max: 30 }).withMessage('Username 3-30 chars')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Letters, numbers, underscores only')
    .customSanitizer(v => v?.toLowerCase()),
  body('location').optional().isLength({ min: 1, max: 100 }).trim(),
  body('birthday.month')
    .isString()
    .isIn(['January','February','March','April','May','June','July','August','September','October','November','December'])
    .withMessage('Valid month name required'),
  body('birthday.day')
    .isString()
    .isInt({ min: 1, max: 31 })
    .withMessage('Day must be 1-31'),
  body('birthday.year')
    .isString()
    .isInt({ min: 1900, max: new Date().getFullYear() })
    .withMessage('Valid birth year required'),
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
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

// --- Color Matches ---
const createColorMatchValidation = [
  body('base_color').custom(isValidHexColor).withMessage('base_color must be hex'),
  body('scheme')
    .isIn(['complementary','analogous','triadic','tetradic','monochromatic'])
    .withMessage('Invalid scheme'),
  body('colors')
    .isArray({ min: 1, max: 10 }).withMessage('colors must be array 1-10')
    .custom(arr => arr.every(isValidHexColor)).withMessage('All colors must be hex'),
  body('privacy').optional().isIn(['private','public']).withMessage('privacy must be private/public'),
  body('is_locked').optional().isBoolean(),
  body('locked_color').optional().custom(isValidHexColor).withMessage('locked_color must be hex'),
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
  body('description').isLength({ min: 1, max: 500 }).trim().escape(),
  body('colors').isArray({ min: 1, max: 10 })
    .custom(arr => arr.every(isValidHexColor)).withMessage('All colors must be hex'),
  body('colorScheme')
    .optional()
    .isIn(['complementary','analogous','triadic','tetradic','monochromatic','freestyle']),
  body('tags').optional().isArray({ max: 10 }),
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
