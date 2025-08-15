const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// normalize DB results (pg/mysql driver agnostic)
const rows = (r) => (Array.isArray(r) ? r : (r?.rows || []));

// Middleware to authenticate JWT tokens with enhanced security
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const [scheme, presentedToken] = authHeader.split(' ');
    const token = /^Bearer$/i.test(scheme) ? presentedToken : authHeader.trim(); // tolerate case/format
    
    if (!token) {
      console.log('🚨 Auth middleware: No token provided', {
        authHeader: authHeader.substring(0, 20) + '...',
        userAgent: req.headers['user-agent']?.substring(0, 50),
        ip: req.ip
      });
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    // Verify JWT token with constrained algorithm and clock tolerance
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'], // Constrain to prevent algorithm confusion attacks
      clockTolerance: 30     // Allow 30 seconds for clock drift
    });

    // Ensure required claims are present
    if (!decoded.jti || !decoded.userId) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token missing required claims'
      });
    }

    // Check session by JTI instead of token string for better security
    const sessionResult = await query(
      `SELECT us.*, u.email, u.username 
       FROM user_sessions us 
       JOIN users u ON us.user_id = u.id 
       WHERE us.jti = ? AND us.user_id = ? AND us.expires_at > NOW() AND us.revoked_at IS NULL`,
      [decoded.jti, decoded.userId]
    );

    const list = rows(sessionResult);
    if (list.length === 0) {
      console.log('🚨 Auth middleware: Invalid session', {
        jti: decoded.jti,
        userId: decoded.userId,
        userAgent: req.headers['user-agent']?.substring(0, 50),
        ip: req.ip
      });
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Session has expired, been revoked, or is invalid'
      });
    }

    const session = list[0];

    // Verify token userId matches session user_id to prevent token/user mismatches
    if (decoded.userId !== session.user_id) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token user mismatch'
      });
    }

    // Add user info to request
    req.user = {
      userId: session.user_id,
      email: session.email,
      username: session.username,
      sessionId: session.id,
      jti: session.jti || decoded.jti
    };
    req.session = { id: session.id, expiresAt: session.expires_at };

    next();
  } catch (error) {
    console.error('🚨 Auth middleware error:', {
      name: error.name,
      message: error.message,
      userAgent: req.headers['user-agent']?.substring(0, 50),
      ip: req.ip,
      authHeader: req.headers['authorization'] ? 'Bearer ***' : 'missing'
    });
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please log in again.'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is malformed or invalid'
      });
    } else {
      return res.status(500).json({
        error: 'Authentication failed',
        message: 'An error occurred during authentication'
      });
    }
  }
};

module.exports = {
  authenticateToken
};
