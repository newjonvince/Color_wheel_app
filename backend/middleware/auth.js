const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Middleware to authenticate JWT tokens with enhanced security
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
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

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Session has expired, been revoked, or is invalid'
      });
    }

    const session = sessionResult.rows[0];

    // Verify token userId matches session user_id to prevent token/user mismatches
    if (decoded.userId !== session.user_id) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token user mismatch'
      });
    }

    // Add user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      username: session.username,
      sessionId: session.id,
      jti: decoded.jti
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is malformed'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Please log in again'
      });
    }

    if (error.name === 'NotBeforeError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token not yet valid'
      });
    }

    res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  authenticateToken
};
