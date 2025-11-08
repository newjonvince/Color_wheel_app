// middleware/validation/index.js - Enhanced validation middleware

const { body, param, query } = require('express-validator');
const { VALIDATION_RULES, COLOR_SCHEMES } = require('../../constants');

// Authentication validations
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .isLength({ min: VALIDATION_RULES.EMAIL.MIN_LENGTH, max: VALIDATION_RULES.EMAIL.MAX_LENGTH })
    .withMessage(`Email must be between ${VALIDATION_RULES.EMAIL.MIN_LENGTH} and ${VALIDATION_RULES.EMAIL.MAX_LENGTH} characters`),
  
  body('username')
    .isLength({ min: VALIDATION_RULES.USERNAME.MIN_LENGTH, max: VALIDATION_RULES.USERNAME.MAX_LENGTH })
    .withMessage(`Username must be between ${VALIDATION_RULES.USERNAME.MIN_LENGTH} and ${VALIDATION_RULES.USERNAME.MAX_LENGTH} characters`)
    .matches(VALIDATION_RULES.USERNAME.PATTERN)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
  
  body('password')
    .isLength({ min: VALIDATION_RULES.PASSWORD.MIN_LENGTH, max: VALIDATION_RULES.PASSWORD.MAX_LENGTH })
    .withMessage(`Password must be between ${VALIDATION_RULES.PASSWORD.MIN_LENGTH} and ${VALIDATION_RULES.PASSWORD.MAX_LENGTH} characters`),
  
  body('location')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Location must be less than 100 characters'),
  
  body('birthday.month')
    .optional()
    .isIn(['January', 'February', 'March', 'April', 'May', 'June', 
           'July', 'August', 'September', 'October', 'November', 'December'])
    .withMessage('Invalid birth month'),
  
  body('birthday.day')
    .optional()
    .isInt({ min: 1, max: 31 })
    .withMessage('Birth day must be between 1 and 31'),
  
  body('birthday.year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() })
    .withMessage('Invalid birth year'),
  
  body('gender')
    .optional()
    .isIn(['Male', 'Female', 'Non-binary', 'Prefer not to say'])
    .withMessage('Invalid gender option'),
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

const updateProfileValidation = [
  body('username')
    .optional()
    .isLength({ min: VALIDATION_RULES.USERNAME.MIN_LENGTH, max: VALIDATION_RULES.USERNAME.MAX_LENGTH })
    .withMessage(`Username must be between ${VALIDATION_RULES.USERNAME.MIN_LENGTH} and ${VALIDATION_RULES.USERNAME.MAX_LENGTH} characters`)
    .matches(VALIDATION_RULES.USERNAME.PATTERN)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
  
  body('location')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Location must be less than 100 characters'),
  
  body('birthday.month')
    .optional()
    .isIn(['January', 'February', 'March', 'April', 'May', 'June', 
           'July', 'August', 'September', 'October', 'November', 'December'])
    .withMessage('Invalid birth month'),
  
  body('birthday.day')
    .optional()
    .isInt({ min: 1, max: 31 })
    .withMessage('Birth day must be between 1 and 31'),
  
  body('birthday.year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() })
    .withMessage('Invalid birth year'),
  
  body('gender')
    .optional()
    .isIn(['Male', 'Female', 'Non-binary', 'Prefer not to say'])
    .withMessage('Invalid gender option'),
];

// Color validations
const colorValidation = [
  query('hex')
    .optional()
    .custom((value) => {
      if (value && !VALIDATION_RULES.COLOR.HEX_PATTERN.test(value)) {
        throw new Error('Invalid hex color format');
      }
      return true;
    }),
  
  body('hex')
    .optional()
    .custom((value) => {
      if (value && !VALIDATION_RULES.COLOR.HEX_PATTERN.test(value)) {
        throw new Error('Invalid hex color format');
      }
      return true;
    }),
];

const createColorMatchValidation = [
  body('base_color')
    .notEmpty()
    .withMessage('Base color is required')
    .matches(VALIDATION_RULES.COLOR.HEX_PATTERN)
    .withMessage('Invalid base color format'),
  
  body('scheme')
    .notEmpty()
    .withMessage('Color scheme is required')
    .isIn(COLOR_SCHEMES)
    .withMessage(`Invalid color scheme. Must be one of: ${COLOR_SCHEMES.join(', ')}`),
  
  body('colors')
    .isArray({ min: 1 })
    .withMessage('Colors array is required and must not be empty')
    .custom((colors) => {
      if (!Array.isArray(colors)) {
        throw new Error('Colors must be an array');
      }
      
      for (const color of colors) {
        if (!VALIDATION_RULES.COLOR.HEX_PATTERN.test(color)) {
          throw new Error(`Invalid color format: ${color}`);
        }
      }
      return true;
    }),
  
  body('title')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Title must be less than 100 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  body('privacy')
    .optional()
    .isIn(['private', 'public'])
    .withMessage('Privacy must be either "private" or "public"'),
];

const updateColorMatchValidation = [
  body('title')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Title must be less than 100 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  body('privacy')
    .optional()
    .isIn(['private', 'public'])
    .withMessage('Privacy must be either "private" or "public"'),
];

// Image processing validations
const coordinatesValidation = [
  body('x')
    .isNumeric()
    .withMessage('X coordinate must be a number'),
  
  body('y')
    .isNumeric()
    .withMessage('Y coordinate must be a number'),
  
  body('normalized')
    .optional()
    .isBoolean()
    .withMessage('Normalized must be a boolean'),
];

const sessionValidation = [
  param('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isLength({ min: 8 })
    .withMessage('Invalid session ID format'),
];

// Pagination validations
const paginationValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be 0 or greater'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be 1 or greater'),
];

// ID validations
const idValidation = [
  param('id')
    .notEmpty()
    .withMessage('ID is required')
    .isUUID()
    .withMessage('Invalid ID format'),
];

// Board validations
const createBoardValidation = [
  body('name')
    .notEmpty()
    .withMessage('Board name is required')
    .isLength({ max: 100 })
    .withMessage('Board name must be less than 100 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  body('type')
    .optional()
    .isIn(['private', 'public'])
    .withMessage('Type must be either "private" or "public"'),
  
  body('scheme')
    .optional()
    .isIn(COLOR_SCHEMES)
    .withMessage(`Invalid color scheme. Must be one of: ${COLOR_SCHEMES.join(', ')}`),
];

const updateBoardValidation = [
  body('name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Board name must be less than 100 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  body('type')
    .optional()
    .isIn(['private', 'public'])
    .withMessage('Type must be either "private" or "public"'),
  
  body('scheme')
    .optional()
    .isIn(COLOR_SCHEMES)
    .withMessage(`Invalid color scheme. Must be one of: ${COLOR_SCHEMES.join(', ')}`),
];

module.exports = {
  // Authentication
  registerValidation,
  loginValidation,
  updateProfileValidation,
  
  // Colors
  colorValidation,
  createColorMatchValidation,
  updateColorMatchValidation,
  
  // Images
  coordinatesValidation,
  sessionValidation,
  
  // Common
  paginationValidation,
  idValidation,
  
  // Boards
  createBoardValidation,
  updateBoardValidation,
};
