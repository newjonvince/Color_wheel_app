// constants/index.js - Shared constants across the backend

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// Error Messages
const ERROR_MESSAGES = {
  // Authentication
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_NOT_FOUND: 'User not found',
  USER_ALREADY_EXISTS: 'User already exists',
  EMAIL_ALREADY_TAKEN: 'Email is already taken',
  USERNAME_ALREADY_TAKEN: 'Username is already taken',
  UNAUTHORIZED_ACCESS: 'Unauthorized access',
  TOKEN_EXPIRED: 'Token has expired',
  INVALID_TOKEN: 'Invalid token',
  
  // Validation
  INVALID_INPUT: 'Invalid input provided',
  REQUIRED_FIELD_MISSING: 'Required field is missing',
  INVALID_EMAIL_FORMAT: 'Invalid email format',
  PASSWORD_TOO_SHORT: 'Password must be at least 6 characters',
  INVALID_COLOR_FORMAT: 'Invalid color format',
  INVALID_SCHEME: 'Invalid color scheme',
  
  // Resources
  RESOURCE_NOT_FOUND: 'Resource not found',
  RESOURCE_ALREADY_EXISTS: 'Resource already exists',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  
  // Server
  INTERNAL_ERROR: 'Internal server error',
  DATABASE_ERROR: 'Database operation failed',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
};

// Success Messages
const SUCCESS_MESSAGES = {
  USER_CREATED: 'User created successfully',
  USER_UPDATED: 'User updated successfully',
  USER_DELETED: 'User deleted successfully',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  RESOURCE_CREATED: 'Resource created successfully',
  RESOURCE_UPDATED: 'Resource updated successfully',
  RESOURCE_DELETED: 'Resource deleted successfully',
};

// Validation Rules
const VALIDATION_RULES = {
  EMAIL: {
    MIN_LENGTH: 5,
    MAX_LENGTH: 255,
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  PASSWORD: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 128,
  },
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9_-]+$/,
  },
  COLOR: {
    HEX_PATTERN: /^#([0-9A-F]{6}|[0-9A-F]{3})$/i,
  },
};

// Color Schemes - Updated to match frontend optimized color system
const COLOR_SCHEMES = [
  'analogous',
  'complementary', 
  'split-complementary',
  'triadic',
  'tetradic',
  'monochromatic',
  'compound',
  'shades',
  'tints'
];

// Pagination
const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  DEFAULT_OFFSET: 0,
};

// Cache TTL (Time To Live)
const CACHE_TTL = {
  SHORT: 5 * 60, // 5 minutes
  MEDIUM: 30 * 60, // 30 minutes
  LONG: 60 * 60, // 1 hour
  VERY_LONG: 24 * 60 * 60, // 24 hours
};

// File Upload
const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif'
  ],
};

// Session Configuration
const SESSION_CONFIG = {
  TTL_MS: 10 * 60 * 1000, // 10 minutes
  CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
};

// Database Configuration
const DB_CONFIG = {
  MAX_CONNECTIONS: 20,
  ACQUIRE_TIMEOUT: 60000,
  TIMEOUT: 60000,
  SLOW_QUERY_MS: 1000,
};

module.exports = {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  VALIDATION_RULES,
  COLOR_SCHEMES,
  PAGINATION,
  CACHE_TTL,
  UPLOAD_LIMITS,
  SESSION_CONFIG,
  DB_CONFIG,
};
