// tests/users-enhanced.test.js - Test enhanced users.js functionality
const request = require('supertest');
const app = require('../server');

describe('Enhanced Users API', () => {
  let authToken;
  
  beforeAll(async () => {
    // Get auth token for testing (you'll need to implement this based on your auth system)
    // authToken = await getTestAuthToken();
  });

  describe('Caching Functionality', () => {
    it('should cache user profile on first request', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('retrieved successfully');
    });

    it('should return cached profile on second request', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cache');
    });

    it('should provide cache statistics', async () => {
      const response = await request(app)
        .get('/api/users/cache/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalCacheSize');
      expect(response.body.data).toHaveProperty('userCacheEntries');
      expect(response.body.data).toHaveProperty('cacheTTL');
    });

    it('should clear user cache', async () => {
      const response = await request(app)
        .delete('/api/users/cache')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cleared successfully');
    });
  });

  describe('Standardized Responses', () => {
    it('should return standardized success response format', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return standardized error response format', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('statusCode', 401);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize location input', async () => {
      const maliciousInput = '<script>alert("xss")</script>New York';
      
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ location: maliciousInput })
        .expect(200);

      expect(response.body.success).toBe(true);
      // The location should be sanitized (HTML entities escaped)
      expect(response.body.data.user.location).not.toContain('<script>');
    });
  });

  describe('Validation Error Handling', () => {
    it('should return formatted validation errors', async () => {
      const response = await request(app)
        .put('/api/users/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ favorite_colors: 'not-an-array' }) // Should be array
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
      expect(response.body.data).toHaveProperty('errors');
    });
  });

  describe('Profile Management', () => {
    it('should update user profile successfully', async () => {
      const updateData = {
        location: 'San Francisco',
        gender: 'Non-binary'
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.location).toBe(updateData.location);
      expect(response.body.data.user.gender).toBe(updateData.gender);
    });
  });

  describe('Preferences Management', () => {
    it('should create default preferences if none exist', async () => {
      const response = await request(app)
        .get('/api/users/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.preferences).toHaveProperty('notifications_enabled');
    });

    it('should update user preferences', async () => {
      const preferencesData = {
        skin_tone: 'medium',
        favorite_colors: ['#FF0000', '#00FF00', '#0000FF'],
        style_personality: 'classic',
        notifications_enabled: false
      };

      const response = await request(app)
        .put('/api/users/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(preferencesData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.preferences.skin_tone).toBe(preferencesData.skin_tone);
      expect(response.body.data.preferences.notifications_enabled).toBe(false);
    });
  });

  describe('Settings Management', () => {
    it('should update user settings', async () => {
      const settingsData = {
        notifications: true,
        share_usage: false
      };

      const response = await request(app)
        .put('/api/users/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(settingsData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.settings.notifications).toBe(true);
      expect(response.body.data.settings.share_usage).toBe(false);
    });
  });

  describe('Data Export', () => {
    it('should request data export successfully', async () => {
      const response = await request(app)
        .post('/api/users/export-data')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('requestedAt');
      expect(response.body.data).toHaveProperty('estimatedCompletion');
      expect(response.body.message).toContain('24 hours');
    });
  });
});

// Helper function to get test auth token
async function getTestAuthToken() {
  // Implement based on your auth system
  // This might involve creating a test user and logging them in
  return 'test-auth-token';
}

module.exports = {
  getTestAuthToken
};
