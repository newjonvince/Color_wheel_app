// tests/auth-refresh.test.js - Token refresh functionality tests
// Run with: npm test auth-refresh.test.js

const request = require('supertest');
const app = require('../server');
const { generateSecureToken, generateRefreshToken } = require('../utils/jwt');

describe('Token Refresh Functionality', () => {
  let testUser = {
    userId: 'test-user-123',
    email: 'test@example.com'
  };
  
  let accessToken;
  let refreshToken;

  beforeEach(() => {
    // Generate test tokens
    const tokenData = generateSecureToken(testUser, { expiresIn: '1h' });
    const refreshData = generateRefreshToken(testUser, tokenData.jti);
    
    accessToken = tokenData.token;
    refreshToken = refreshData.refreshToken;
  });

  describe('Automatic Token Refresh', () => {
    it('should include refresh headers when token is near expiration', async () => {
      // Create a token that expires soon
      const shortToken = generateSecureToken(testUser, { expiresIn: '1m' });
      
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${shortToken.token}`)
        .expect(200);

      // Check for refresh headers
      expect(response.headers['x-token-refreshed']).toBe('true');
      expect(response.headers['x-new-token']).toBeDefined();
      expect(response.headers['x-token-expires']).toBeDefined();
    });

    it('should not refresh tokens that are still fresh', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Should not include refresh headers for fresh tokens
      expect(response.headers['x-token-refreshed']).toBeUndefined();
      expect(response.headers['x-new-token']).toBeUndefined();
    });
  });

  describe('Manual Token Refresh Endpoint', () => {
    it('should refresh token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.expiresAt).toBeDefined();
      expect(response.body.data.tokenType).toBe('Bearer');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toBe('unauthorized');
    });

    it('should require refresh token in request body', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Fresh Token Requirement', () => {
    it('should accept fresh tokens for sensitive operations', async () => {
      // This would be used for password changes, etc.
      const freshToken = generateSecureToken(testUser, { expiresIn: '1h' });
      
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${freshToken.token}`)
        .send({
          currentPassword: 'oldpass',
          newPassword: 'newpass'
        });

      // Should not be rejected for token freshness
      expect(response.status).not.toBe(401);
    });

    it('should reject old tokens for sensitive operations', async () => {
      // Create an old token (simulate 2 hours old)
      const oldTokenData = generateSecureToken(testUser, { expiresIn: '1h' });
      // Manually adjust the iat (issued at) time to be 2 hours ago
      const jwt = require('jsonwebtoken');
      const payload = jwt.decode(oldTokenData.token);
      payload.iat = Math.floor(Date.now() / 1000) - (2 * 60 * 60); // 2 hours ago
      
      const oldToken = jwt.sign(payload, process.env.JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h'
      });

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({
          currentPassword: 'oldpass',
          newPassword: 'newpass'
        })
        .expect(401);

      expect(response.body.error).toBe('fresh_token_required');
    });
  });

  describe('Token Revocation', () => {
    it('should revoke all refresh tokens for user', async () => {
      const response = await request(app)
        .post('/api/auth/revoke-refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body.message).toContain('revoked successfully');
    });
  });

  describe('Configuration', () => {
    it('should respect TOKEN_AUTO_REFRESH environment variable', async () => {
      // Temporarily disable auto-refresh
      const originalValue = process.env.TOKEN_AUTO_REFRESH;
      process.env.TOKEN_AUTO_REFRESH = 'false';

      const shortToken = generateSecureToken(testUser, { expiresIn: '1m' });
      
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${shortToken.token}`)
        .expect(200);

      // Should not refresh when disabled
      expect(response.headers['x-token-refreshed']).toBeUndefined();

      // Restore original value
      process.env.TOKEN_AUTO_REFRESH = originalValue;
    });
  });
});

// Helper function to simulate expired tokens
const createExpiredToken = (user) => {
  const jwt = require('jsonwebtoken');
  const payload = {
    userId: user.userId,
    email: user.email,
    iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    exp: Math.floor(Date.now() / 1000) - 1800  // Expired 30 minutes ago
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256' });
};

module.exports = {
  createExpiredToken
};
