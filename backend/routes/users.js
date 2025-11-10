const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth-enhanced');
const { 
  success, 
  created, 
  badRequest, 
  notFound, 
  internalError,
  asyncHandler,
  formatValidationErrors 
} = require('../utils/response');
const router = express.Router();

// Simple in-memory cache for user profiles (production should use Redis)
const profileCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache helper functions
const getCacheKey = (userId, type = 'profile') => `user:${userId}:${type}`;

const getFromCache = (key) => {
  const cached = profileCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  profileCache.delete(key);
  return null;
};

const setCache = (key, data) => {
  profileCache.set(key, {
    data,
    timestamp: Date.now()
  });
};

const invalidateUserCache = (userId) => {
  const keysToDelete = [];
  for (const [key] of profileCache) {
    if (key.startsWith(`user:${userId}:`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => profileCache.delete(key));
};

// Common user data formatter
const formatUserResponse = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  location: user.location,
  birthday: {
    month: user.birthday_month,
    day: user.birthday_day,
    year: user.birthday_year
  },
  gender: user.gender,
  createdAt: user.created_at,
  updatedAt: user.updated_at
});

// Common error handler
const handleDatabaseError = (error, res, operation) => {
  console.error(`${operation} error:`, error);
  return internalError(res, `Failed to ${operation.toLowerCase()}`);
};

// Common validation error handler
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return badRequest(res, 'Validation failed', formatValidationErrors(errors));
  }
  return null;
};

// Get user profile
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const cacheKey = getCacheKey(userId, 'profile');
  
  // Check cache first
  const cachedProfile = getFromCache(cacheKey);
  if (cachedProfile) {
    return success(res, { user: cachedProfile }, 'Profile retrieved from cache');
  }

  const result = await query(
    `SELECT id, email, username, location, birthday_month, birthday_day, birthday_year, gender, created_at, updated_at
     FROM users WHERE id = ?`,
    [userId]
  );

  if (result.rows.length === 0) {
    return notFound(res, 'User profile does not exist');
  }

  const user = formatUserResponse(result.rows[0]);
  
  // Cache the result
  setCache(cacheKey, user);
  
  return success(res, { user }, 'Profile retrieved successfully');
}));

// Update user profile
router.put('/profile', [
  authenticateToken,
  body('location').optional().trim().escape(),
  body('gender').optional().trim().escape()
], asyncHandler(async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return validationError;

  const userId = req.user.userId;
  const { location, gender } = req.body;

  await query(
    `UPDATE users 
     SET location = COALESCE(?, location), 
         gender = COALESCE(?, gender),
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [location, gender, userId]
  );

  // Get updated user data
  const userResult = await query(
    'SELECT id, email, username, location, birthday_month, birthday_day, birthday_year, gender, created_at, updated_at FROM users WHERE id = ?',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return notFound(res, 'User not found');
  }

  const user = formatUserResponse(userResult.rows[0]);
  
  // Invalidate cache and set new data
  invalidateUserCache(userId);
  setCache(getCacheKey(userId, 'profile'), user);

  return success(res, { user }, 'Profile updated successfully');
}));

// Get user preferences
router.get('/preferences', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const cacheKey = getCacheKey(userId, 'preferences');
  
  // Check cache first
  const cachedPreferences = getFromCache(cacheKey);
  if (cachedPreferences) {
    return success(res, { preferences: cachedPreferences }, 'Preferences retrieved from cache');
  }

  let result = await query(
    'SELECT * FROM user_preferences WHERE user_id = ?',
    [userId]
  );

  if (result.rows.length === 0) {
    // Create default preferences
    await query(
      `INSERT INTO user_preferences (user_id, notifications_enabled)
       VALUES (?, true)`,
      [userId]
    );
    
    // Get the newly created preferences
    result = await query(
      'SELECT * FROM user_preferences WHERE user_id = ?',
      [userId]
    );
  }

  const preferences = result.rows[0];
  
  // Cache the result
  setCache(cacheKey, preferences);

  return success(res, { preferences }, 'Preferences retrieved successfully');
}));

// Update user preferences
router.put('/preferences', [
  authenticateToken,
  body('skin_tone').optional().trim().escape(),
  body('favorite_colors').optional().isArray().isLength({ max: 10 }),
  body('style_personality').optional().trim().escape(),
  body('notifications_enabled').optional().isBoolean()
], asyncHandler(async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return validationError;

  const userId = req.user.userId;
  const { skin_tone, favorite_colors, style_personality, notifications_enabled } = req.body;

  // Check if preferences exist
  const existing = await query(
    'SELECT id FROM user_preferences WHERE user_id = ?',
    [userId]
  );

  let result;
  if (existing.rows.length === 0) {
    // Create new preferences
    await query(
      `INSERT INTO user_preferences (user_id, skin_tone, favorite_colors, style_personality, notifications_enabled)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, skin_tone, JSON.stringify(favorite_colors ?? null), style_personality, notifications_enabled]
    );
  } else {
    // Update existing preferences
    await query(
      `UPDATE user_preferences 
       SET skin_tone = COALESCE(?, skin_tone),
           favorite_colors = COALESCE(?, favorite_colors),
           style_personality = COALESCE(?, style_personality),
           notifications_enabled = COALESCE(?, notifications_enabled),
           updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ?`,
      [skin_tone, JSON.stringify(favorite_colors ?? null), style_personality, notifications_enabled, userId]
    );
  }
  
  // Get updated preferences
  result = await query(
    'SELECT * FROM user_preferences WHERE user_id = ?',
    [userId]
  );

  const preferences = result.rows[0];
  
  // Invalidate cache and set new data
  invalidateUserCache(userId);
  setCache(getCacheKey(userId, 'preferences'), preferences);

  return success(res, { preferences }, 'Preferences updated successfully');
}));

// Update user settings (for UserSettingsScreen toggles)
router.put('/settings', [
  authenticateToken,
  body('notifications').optional().isBoolean(),
  body('share_usage').optional().isBoolean()
], asyncHandler(async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return validationError;

  const userId = req.user.userId;
  const { notifications, share_usage } = req.body;

  // Check if user_preferences exists
  const existing = await query(
    'SELECT id FROM user_preferences WHERE user_id = ?',
    [userId]
  );

  let result;
  if (existing.rows.length === 0) {
    // Create new preferences with settings
    await query(
      `INSERT INTO user_preferences (user_id, notifications_enabled, share_usage_data)
       VALUES (?, ?, ?)`,
      [userId, notifications !== undefined ? notifications : true, share_usage !== undefined ? share_usage : false]
    );
  } else {
    // Update existing preferences
    const updates = [];
    const values = [];

    if (notifications !== undefined) {
      updates.push(`notifications_enabled = ?`);
      values.push(notifications);
    }

    if (share_usage !== undefined) {
      updates.push(`share_usage_data = ?`);
      values.push(share_usage);
    }

    if (updates.length === 0) {
      return badRequest(res, 'Please provide at least one setting to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    await query(
      `UPDATE user_preferences 
       SET ${updates.join(', ')}
       WHERE user_id = ?`,
      values
    );
  }
  
  // Get updated preferences
  result = await query(
    'SELECT * FROM user_preferences WHERE user_id = ?',
    [userId]
  );

  const settings = {
    notifications: result.rows[0].notifications_enabled,
    share_usage: result.rows[0].share_usage_data
  };
  
  // Invalidate cache
  invalidateUserCache(userId);

  return success(res, { settings }, 'Settings updated successfully');
}));

// Request data export
router.post('/export-data', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  // Get user info for email
  const userResult = await query(
    'SELECT email, username FROM users WHERE id = ?',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return notFound(res, 'User account does not exist');
  }

  const user = userResult.rows[0];

  // In a real implementation, you would:
  // 1. Queue a background job to collect all user data
  // 2. Generate a secure download link
  // 3. Send an email with the download link
  // 4. Set an expiration time for the download

  // For now, we'll simulate the request and log it
  console.log(`📦 Data export requested for user ${user.username} (${user.email})`);

  // TODO: Implement actual data export job
  // - Collect user profile, preferences, color matches, boards, community posts
  // - Generate JSON/CSV export file
  // - Create secure temporary download link
  // - Send email with download instructions

  return success(res, {
    requestedAt: new Date().toISOString(),
    estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }, 'Data export requested successfully. You will receive an email with your data export within 24 hours.');
}));

// Cache cleanup endpoint (for maintenance)
router.delete('/cache', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  invalidateUserCache(userId);
  return success(res, null, 'User cache cleared successfully');
}));

// Cache statistics endpoint (for debugging)
router.get('/cache/stats', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const userCacheKeys = [];
  
  for (const [key] of profileCache) {
    if (key.startsWith(`user:${userId}:`)) {
      userCacheKeys.push(key);
    }
  }
  
  return success(res, {
    totalCacheSize: profileCache.size,
    userCacheEntries: userCacheKeys.length,
    userCacheKeys: userCacheKeys,
    cacheTTL: CACHE_TTL
  }, 'Cache statistics retrieved successfully');
}));

// Periodic cache cleanup (runs every 10 minutes)
setInterval(() => {
  const now = Date.now();
  const keysToDelete = [];
  
  for (const [key, value] of profileCache) {
    if (now - value.timestamp > CACHE_TTL) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => profileCache.delete(key));
  
  if (keysToDelete.length > 0) {
    console.log(`🧹 Cleaned up ${keysToDelete.length} expired cache entries`);
  }
}, 10 * 60 * 1000);

module.exports = router;
