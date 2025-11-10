// middleware/auth-enhanced.js - Enhanced authentication with automatic token refresh
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { generateSecureToken, verifySecureToken, createSessionData } = require('../utils/jwt');

// Configuration for token refresh
const TOKEN_REFRESH_CONFIG = {
  // Refresh token when it has less than this time remaining (in seconds)
  REFRESH_THRESHOLD: parseInt(process.env.TOKEN_REFRESH_THRESHOLD) || 24 * 60 * 60, // 24 hours
  // Maximum age for refresh (prevent infinite refresh)
  MAX_REFRESH_AGE: parseInt(process.env.TOKEN_MAX_REFRESH_AGE) || 7 * 24 * 60 * 60, // 7 days
  // New token expiration for refreshed tokens
  REFRESH_EXPIRES_IN: process.env.TOKEN_REFRESH_EXPIRES_IN || '7d',
  // Enable/disable automatic refresh
  AUTO_REFRESH_ENABLED: process.env.TOKEN_AUTO_REFRESH !== 'false'
};

// normalize DB results (pg/mysql driver agnostic)
const rows = r => (Array.isArray(r) ? r : (r?.rows || []));

/**
 * Check if token needs refresh based on expiration time
 * @param {number} exp - Token expiration timestamp
 * @param {number} iat - Token issued at timestamp
 * @returns {boolean} - Whether token should be refreshed
 */
const shouldRefreshToken = (exp, iat) => {
  if (!TOKEN_REFRESH_CONFIG.AUTO_REFRESH_ENABLED) return false;
  
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = exp - now;
  const tokenAge = now - iat;
  
  // Refresh if:
  // 1. Token expires within threshold AND
  // 2. Token is not older than max refresh age
  return timeUntilExpiry <= TOKEN_REFRESH_CONFIG.REFRESH_THRESHOLD && 
         tokenAge <= TOKEN_REFRESH_CONFIG.MAX_REFRESH_AGE;
};

/**
 * Generate new token and update session
 * @param {Object} user - User data
 * @param {Object} session - Current session data
 * @param {string} ipAddress - Client IP
 * @param {string} userAgent - Client user agent
 * @returns {Object} - New token data
 */
const refreshUserToken = async (user, session, ipAddress, userAgent) => {
  try {
    // Generate new token
    const newTokenData = generateSecureToken(
      { userId: user.userId, email: user.email },
      { expiresIn: TOKEN_REFRESH_CONFIG.REFRESH_EXPIRES_IN }
    );

    // Update session with new JTI and expiration
    await query(
      `UPDATE user_sessions 
       SET jti = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP, refresh_count = COALESCE(refresh_count, 0) + 1
       WHERE id = ?`,
      [newTokenData.jti, newTokenData.expiresAt, session.id]
    );

    // Log refresh for security monitoring
    console.log(`🔄 Token refreshed for user ${user.userId} (session: ${session.id})`);

    return {
      token: newTokenData.token,
      jti: newTokenData.jti,
      expiresAt: newTokenData.expiresAt
    };
  } catch (error) {
    console.error('Token refresh failed:', error.message);
    throw new Error('Failed to refresh token');
  }
};

/**
 * Enhanced authentication middleware with automatic token refresh
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Case-insensitive header access
    const authHeader = req.headers.authorization || req.headers['authorization'] || '';
    const [scheme, presentedToken] = authHeader.split(' ');
    const token = /^Bearer$/i.test(scheme) ? presentedToken : authHeader.trim();

    if (!token) {
      res.set({
        'WWW-Authenticate': 'Bearer realm="API"',
        'Cache-Control': 'no-store'
      });
      return res.status(401).json({ 
        error: 'unauthorized',
        message: 'Authentication token required'
      });
    }

    // Verify token
    const verifyOpts = { algorithms: ['HS256'], clockTolerance: 30 };
    if (process.env.JWT_ISSUER) verifyOpts.issuer = process.env.JWT_ISSUER;
    if (process.env.JWT_AUDIENCE) verifyOpts.audience = process.env.JWT_AUDIENCE;

    const decoded = jwt.verify(token, process.env.JWT_SECRET, verifyOpts);

    // Validate session in database
    const result = await query(
      `SELECT us.*, u.email, u.username
       FROM user_sessions us
       JOIN users u ON u.id = us.user_id
       WHERE us.jti = ? AND us.user_id = ? AND us.expires_at > NOW() AND us.revoked_at IS NULL`,
      [decoded.jti, decoded.userId]
    );
    
    const list = rows(result);
    if (!list.length) {
      res.set('WWW-Authenticate', 'Bearer realm="API"');
      return res.status(401).json({ 
        error: 'unauthorized',
        message: 'Invalid or expired session'
      });
    }

    const sessionData = list[0];
    const user = { 
      userId: sessionData.user_id, 
      email: sessionData.email, 
      username: sessionData.username, 
      sessionId: sessionData.id, 
      jti: sessionData.jti || decoded.jti 
    };
    const session = { 
      id: sessionData.id, 
      expiresAt: sessionData.expires_at 
    };

    // Check if token needs refresh
    let refreshedToken = null;
    if (shouldRefreshToken(decoded.exp, decoded.iat)) {
      try {
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || 'unknown';
        
        refreshedToken = await refreshUserToken(user, session, ipAddress, userAgent);
        
        // Update user object with new JTI
        user.jti = refreshedToken.jti;
        session.expiresAt = refreshedToken.expiresAt;
      } catch (refreshError) {
        // Log error but don't fail the request - token is still valid
        console.error('Token refresh failed, continuing with current token:', refreshError.message);
      }
    }

    // Attach user and session to request
    req.user = user;
    req.session = session;

    // Add refresh token to response headers if refreshed
    if (refreshedToken) {
      res.set({
        'X-Token-Refreshed': 'true',
        'X-New-Token': refreshedToken.token,
        'X-Token-Expires': refreshedToken.expiresAt.toISOString()
      });
    }

    return next();
  } catch (e) {
    // Handle specific JWT errors
    let errorMessage = 'Authentication failed';
    let errorCode = 'unauthorized';

    if (e.name === 'TokenExpiredError') {
      errorMessage = 'Token has expired';
      errorCode = 'token_expired';
    } else if (e.name === 'JsonWebTokenError') {
      errorMessage = 'Invalid token format';
      errorCode = 'invalid_token';
    } else if (e.name === 'NotBeforeError') {
      errorMessage = 'Token not yet valid';
      errorCode = 'token_not_active';
    }

    // Never log raw token, only presence
    const authHeaderPresent = !!req.headers.authorization;
    console.error('Auth middleware error:', e?.message, { 
      authHeaderPresent, 
      errorName: e.name,
      userId: e.userId || 'unknown'
    });

    res.set('WWW-Authenticate', 'Bearer realm="API"');
    return res.status(401).json({ 
      error: errorCode,
      message: errorMessage
    });
  }
};

/**
 * Middleware that requires fresh token (no auto-refresh)
 * Use for sensitive operations like password changes
 */
const requireFreshToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers['authorization'] || '';
    const [scheme, presentedToken] = authHeader.split(' ');
    const token = /^Bearer$/i.test(scheme) ? presentedToken : authHeader.trim();

    if (!token) {
      return res.status(401).json({ 
        error: 'fresh_token_required',
        message: 'Fresh authentication token required for this operation'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      clockTolerance: 30
    });

    // Check if token is fresh (issued within last hour)
    const now = Math.floor(Date.now() / 1000);
    const tokenAge = now - decoded.iat;
    const maxFreshAge = 60 * 60; // 1 hour

    if (tokenAge > maxFreshAge) {
      return res.status(401).json({
        error: 'fresh_token_required',
        message: 'This operation requires a fresh authentication token. Please log in again.'
      });
    }

    // Continue with normal authentication
    return authenticateToken(req, res, next);
  } catch (error) {
    return res.status(401).json({
      error: 'fresh_token_required',
      message: 'Fresh authentication required'
    });
  }
};

/**
 * Optional authentication middleware
 * Continues even if no token provided, but validates if present
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers['authorization'] || '';
  
  if (!authHeader) {
    // No token provided, continue without authentication
    req.user = null;
    req.session = null;
    return next();
  }

  // Token provided, validate it
  return authenticateToken(req, res, next);
};

module.exports = { 
  authenticateToken, 
  requireFreshToken, 
  optionalAuth,
  TOKEN_REFRESH_CONFIG 
};
