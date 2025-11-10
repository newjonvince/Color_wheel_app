// JWT utility functions for enhanced security
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a secure JWT token with JTI
 * @param {Object} payload - Token payload
 * @param {string} payload.userId - User ID
 * @param {string} payload.email - User email
 * @param {Object} options - Token options
 * @param {string} options.expiresIn - Token expiration (default: '7d')
 * @returns {Object} - { token, jti, expiresAt }
 */
const generateSecureToken = (payload, options = {}) => {
  const jti = uuidv4(); // Generate unique JWT ID
  const expiresIn = options.expiresIn || '7d';
  
  const tokenPayload = {
    ...payload,
    jti,
    iat: Math.floor(Date.now() / 1000),
  };

  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
    expiresIn,
    algorithm: 'HS256', // Constrain algorithm
    issuer: 'fashion-color-wheel',
    audience: 'fashion-color-wheel-users'
  });

  // Calculate expiration timestamp
  const expiresAt = new Date();
  if (expiresIn.endsWith('d')) {
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiresIn));
  } else if (expiresIn.endsWith('h')) {
    expiresAt.setHours(expiresAt.getHours() + parseInt(expiresIn));
  } else if (expiresIn.endsWith('m')) {
    expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(expiresIn));
  } else {
    // Default to 7 days if format not recognized
    expiresAt.setDate(expiresAt.getDate() + 7);
  }

  return { token, jti, expiresAt };
};

/**
 * Verify JWT token with enhanced security
 * @param {string} token - JWT token to verify
 * @returns {Object} - Decoded token payload
 */
const verifySecureToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256'], // Constrain algorithms
    clockTolerance: 30,    // Allow 30 seconds for clock drift
    issuer: 'fashion-color-wheel',
    audience: 'fashion-color-wheel-users'
  });
};

/**
 * Create session record with JTI
 * @param {Object} params - Session parameters
 * @param {string} params.userId - User ID
 * @param {string} params.jti - JWT ID
 * @param {Date} params.expiresAt - Expiration timestamp
 * @param {string} params.ipAddress - Client IP address
 * @param {string} params.userAgent - Client user agent
 * @returns {Object} - Session data for database insertion
 */
const createSessionData = ({ userId, jti, expiresAt, ipAddress, userAgent }) => {
  return {
    user_id: userId,
    jti,
    expires_at: expiresAt,
    ip_address: ipAddress,
    user_agent: userAgent,
    created_at: new Date(),
    revoked_at: null,
    refresh_count: 0
  };
};

/**
 * Generate refresh token with longer expiration
 * @param {Object} payload - Token payload
 * @param {string} payload.userId - User ID
 * @param {string} payload.email - User email
 * @param {string} originalJti - Original token JTI for tracking
 * @returns {Object} - { refreshToken, jti, expiresAt }
 */
const generateRefreshToken = (payload, originalJti) => {
  const jti = uuidv4();
  const expiresIn = '30d'; // Refresh tokens last 30 days
  
  const tokenPayload = {
    ...payload,
    jti,
    originalJti, // Link to original token
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
  };

  const refreshToken = jwt.sign(tokenPayload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn,
    algorithm: 'HS256',
    issuer: 'fashion-color-wheel',
    audience: 'fashion-color-wheel-refresh'
  });

  // Calculate expiration timestamp
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  return { refreshToken, jti, expiresAt };
};

/**
 * Verify refresh token
 * @param {string} refreshToken - Refresh token to verify
 * @returns {Object} - Decoded refresh token payload
 */
const verifyRefreshToken = (refreshToken) => {
  return jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    algorithms: ['HS256'],
    clockTolerance: 30,
    issuer: 'fashion-color-wheel',
    audience: 'fashion-color-wheel-refresh'
  });
};

module.exports = {
  generateSecureToken,
  verifySecureToken,
  createSessionData,
  generateRefreshToken,
  verifyRefreshToken
};
