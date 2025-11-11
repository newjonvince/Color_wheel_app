// middleware/auth-compatibility.js - Compatibility layer for auth transition
// This middleware can handle both old and new auth systems during migration

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { verifySecureToken } = require('../utils/jwt');

// normalize DB results (pg/mysql driver agnostic)
const rows = r => (Array.isArray(r) ? r : (r?.rows || []));

/**
 * Compatibility authentication middleware
 * Handles both old session_token and new JTI-based sessions
 */
const authenticateTokenCompat = async (req, res, next) => {
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

    // Try to verify token with new secure method first
    let decoded;
    try {
      decoded = verifySecureToken(token);
    } catch (newError) {
      // Fallback to old JWT verification for backward compatibility
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (oldError) {
        res.set('WWW-Authenticate', 'Bearer realm="API"');
        return res.status(401).json({ 
          error: 'unauthorized',
          message: 'Invalid or expired token'
        });
      }
    }

    // Defensive token payload validation
    if (!decoded || !decoded.userId || !decoded.jti) {
      res.set('WWW-Authenticate', 'Bearer realm="API"');
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid token payload' });
    }

    // Try new JTI-based session lookup first
    let sessionResult;
    if (decoded.jti) {
      sessionResult = await query(
        `SELECT us.*, u.email, u.username
         FROM user_sessions us
         JOIN users u ON u.id = us.user_id
         WHERE us.jti = ? AND us.user_id = ? AND us.expires_at > NOW() AND us.revoked_at IS NULL`,
        [decoded.jti, decoded.userId]
      );
    }

    let list = rows(sessionResult);
    
    // Fallback to old session_token lookup if JTI lookup fails
    if (!list.length && !decoded.jti) {
      console.warn('Using legacy session lookup - consider migrating to new auth system');
      sessionResult = await query(
        `SELECT us.*, u.email, u.username
         FROM user_sessions us
         JOIN users u ON u.id = us.user_id
         WHERE us.session_token = ? AND us.user_id = ? AND us.expires_at > NOW() AND us.revoked_at IS NULL`,
        [token, decoded.userId]
      );
      list = rows(sessionResult);
    }

    // If still no session found, check if user exists (for demo tokens)
    if (!list.length) {
      if (decoded.userId === 'demo-user') {
        // Allow demo user without session
        req.user = { 
          userId: decoded.userId, 
          email: decoded.email || 'demo@fashioncolorwheel.com', 
          username: 'demo_user',
          sessionId: 'demo-session',
          jti: decoded.jti || 'demo-jti'
        };
        req.session = { 
          id: 'demo-session', 
          expiresAt: new Date(decoded.exp * 1000) 
        };
        return next();
      }

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

    // Attach user and session to request
    req.user = user;
    req.session = session;

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
    console.error('Auth compatibility middleware error:', e?.message, { 
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

module.exports = { 
  authenticateTokenCompat,
  // Export as default name for easy replacement
  authenticateToken: authenticateTokenCompat
};
