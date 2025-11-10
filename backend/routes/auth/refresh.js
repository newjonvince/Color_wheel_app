// routes/auth/refresh.js - Token refresh endpoint
const express = require('express');
const { query } = require('../../config/database');
const { generateSecureToken, verifyRefreshToken } = require('../../utils/jwt');
const { 
  success, 
  badRequest, 
  unauthorized, 
  internalError,
  asyncHandler 
} = require('../../utils/response');
const { authLimiter } = require('../../middleware/rateLimiting');

const router = express.Router();

// normalize DB results (pg/mysql driver agnostic)
const rows = r => (Array.isArray(r) ? r : (r?.rows || []));

/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (requires valid refresh token)
 */
router.post('/refresh', 
  authLimiter,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return badRequest(res, 'Refresh token is required');
    }

    try {
      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);
      
      if (decoded.type !== 'refresh') {
        return unauthorized(res, 'Invalid refresh token type');
      }

      // Check if refresh token session exists and is valid
      const sessionResult = await query(
        `SELECT us.*, u.email, u.username
         FROM user_sessions us
         JOIN users u ON u.id = us.user_id
         WHERE us.refresh_jti = ? AND us.user_id = ? AND us.refresh_expires_at > NOW() AND us.revoked_at IS NULL`,
        [decoded.jti, decoded.userId]
      );

      const sessions = rows(sessionResult);
      if (!sessions.length) {
        return unauthorized(res, 'Invalid or expired refresh token');
      }

      const session = sessions[0];

      // Generate new access token
      const newTokenData = generateSecureToken(
        { userId: decoded.userId, email: decoded.email },
        { expiresIn: '1h' } // Shorter expiration for refreshed tokens
      );

      // Update session with new access token JTI
      await query(
        `UPDATE user_sessions 
         SET jti = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP, refresh_count = COALESCE(refresh_count, 0) + 1
         WHERE id = ?`,
        [newTokenData.jti, newTokenData.expiresAt, session.id]
      );

      // Log refresh for security monitoring
      console.log(`🔄 Manual token refresh for user ${decoded.userId} (session: ${session.id})`);

      return success(res, {
        accessToken: newTokenData.token,
        expiresAt: newTokenData.expiresAt.toISOString(),
        tokenType: 'Bearer',
        user: {
          id: session.user_id,
          email: session.email,
          username: session.username
        }
      }, 'Token refreshed successfully');

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return unauthorized(res, 'Refresh token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        return unauthorized(res, 'Invalid refresh token');
      }
      
      console.error('Token refresh error:', error);
      return internalError(res, 'Failed to refresh token');
    }
  })
);

/**
 * @route   POST /auth/revoke-refresh
 * @desc    Revoke refresh token (logout from all devices)
 * @access  Private (requires valid access token)
 */
router.post('/revoke-refresh',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization || '';
    const [, accessToken] = authHeader.split(' ');

    if (!refreshToken || !accessToken) {
      return badRequest(res, 'Both access and refresh tokens are required');
    }

    try {
      // Verify both tokens
      const refreshDecoded = verifyRefreshToken(refreshToken);
      
      // Revoke all sessions for this user
      await query(
        `UPDATE user_sessions 
         SET revoked_at = CURRENT_TIMESTAMP 
         WHERE user_id = ? AND revoked_at IS NULL`,
        [refreshDecoded.userId]
      );

      console.log(`🚫 All refresh tokens revoked for user ${refreshDecoded.userId}`);

      return success(res, null, 'All refresh tokens revoked successfully');

    } catch (error) {
      console.error('Token revocation error:', error);
      return internalError(res, 'Failed to revoke refresh tokens');
    }
  })
);

module.exports = router;
