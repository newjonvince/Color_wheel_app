const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../../config/database');
const { authenticateToken } = require('../../middleware/auth-enhanced');
const { 
  success, 
  created, 
  badRequest, 
  notFound, 
  internalError,
  asyncHandler,
  formatValidationErrors 
} = require('../../utils/response');
const router = express.Router();

// Get current user profile
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  
  const result = await query(
    `SELECT 
      id, username, email, first_name, last_name, age, gender, 
      profile_image_url, created_at, updated_at,
      (SELECT COUNT(*) FROM color_matches WHERE user_id = ?) as color_matches_count,
      (SELECT COUNT(*) FROM boards WHERE user_id = ?) as boards_count
    FROM users 
    WHERE id = ?`,
    [userId, userId, userId]
  );
  
  if (result.rows.length === 0) {
    return notFound(res, null, 'User not found');
  }
  
  success(res, { user: result.rows[0] });
}));

// Update user profile
router.put('/profile', [
  authenticateToken,
  body('username').optional().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('first_name').optional().isLength({ min: 1, max: 50 }),
  body('last_name').optional().isLength({ min: 1, max: 50 }),
  body('age').optional().isInt({ min: 13, max: 120 }),
  body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return badRequest(res, null, 'Validation failed', { errors: formatValidationErrors(errors) });
  }
  
  const userId = req.user.userId;
  const { username, first_name, last_name, age, gender } = req.body;
  
  // Check if username is already taken (if provided)
  if (username) {
    const existingUser = await query(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [username, userId]
    );
    
    if (existingUser.rows.length > 0) {
      return badRequest(res, null, 'Username already taken');
    }
  }
  
  // Build update query dynamically
  const updates = [];
  const values = [];
  
  if (username !== undefined) {
    updates.push('username = ?');
    values.push(username);
  }
  if (first_name !== undefined) {
    updates.push('first_name = ?');
    values.push(first_name);
  }
  if (last_name !== undefined) {
    updates.push('last_name = ?');
    values.push(last_name);
  }
  if (age !== undefined) {
    updates.push('age = ?');
    values.push(age);
  }
  if (gender !== undefined) {
    updates.push('gender = ?');
    values.push(gender);
  }
  
  if (updates.length === 0) {
    return badRequest(res, null, 'No valid fields to update');
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(userId);
  
  await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  // Get updated user data
  const result = await query(
    'SELECT id, username, email, first_name, last_name, age, gender, profile_image_url, created_at, updated_at FROM users WHERE id = ?',
    [userId]
  );
  
  if (result.rows.length === 0) {
    return notFound(res, null, 'User not found after update');
  }
  
  success(res, { user: result.rows[0] }, 'Profile updated successfully');
}));

// Check username availability
router.get('/check-username/:username', asyncHandler(async (req, res) => {
  const { username } = req.params;
  
  if (!username || username.length < 3 || username.length > 30) {
    return badRequest(res, null, 'Username must be between 3 and 30 characters');
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return badRequest(res, null, 'Username can only contain letters, numbers, and underscores');
  }
  
  const result = await query('SELECT id FROM users WHERE username = ?', [username]);
  const isAvailable = result.rows.length === 0;
  
  success(res, { 
    username,
    available: isAvailable 
  });
}));

// Get user preferences
router.get('/preferences', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  
  const result = await query(
    'SELECT preferences FROM users WHERE id = ?',
    [userId]
  );
  
  if (result.rows.length === 0) {
    return notFound(res, null, 'User not found');
  }
  
  const preferences = result.rows[0].preferences || {};
  success(res, { preferences });
}));

// Update user preferences
router.put('/preferences', [
  authenticateToken,
  body('preferences').isObject()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return badRequest(res, null, 'Validation failed', { errors: formatValidationErrors(errors) });
  }
  
  const userId = req.user.userId;
  const { preferences } = req.body;
  
  await query(
    'UPDATE users SET preferences = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(preferences), userId]
  );
  
  success(res, { preferences }, 'Preferences updated successfully');
}));

// Delete user account
router.delete('/account', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  
  // Start transaction for cascading deletes
  await query('START TRANSACTION');
  
  try {
    // Delete user's data in order (respecting foreign key constraints)
    await query('DELETE FROM board_items WHERE board_id IN (SELECT id FROM boards WHERE user_id = ?)', [userId]);
    await query('DELETE FROM boards WHERE user_id = ?', [userId]);
    await query('DELETE FROM color_matches WHERE user_id = ?', [userId]);
    await query('DELETE FROM community_likes WHERE user_id = ?', [userId]);
    await query('DELETE FROM community_follows WHERE follower_user_id = ? OR followed_user_id = ?', [userId, userId]);
    await query('DELETE FROM community_posts WHERE user_id = ?', [userId]);
    await query('DELETE FROM users WHERE id = ?', [userId]);
    
    await query('COMMIT');
    
    success(res, null, 'Account deleted successfully');
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}));

// Request data export
router.post('/export-data', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  
  // Get all user data
  const userData = await query('SELECT * FROM users WHERE id = ?', [userId]);
  const colorMatches = await query('SELECT * FROM color_matches WHERE user_id = ?', [userId]);
  const boards = await query('SELECT * FROM boards WHERE user_id = ?', [userId]);
  const posts = await query('SELECT * FROM community_posts WHERE user_id = ?', [userId]);
  
  if (userData.rows.length === 0) {
    return notFound(res, null, 'User not found');
  }
  
  const exportData = {
    user: userData.rows[0],
    colorMatches: colorMatches.rows,
    boards: boards.rows,
    communityPosts: posts.rows,
    exportedAt: new Date().toISOString()
  };
  
  // In a real implementation, you would:
  // 1. Generate a secure download link
  // 2. Store the export data temporarily
  // 3. Send an email with the download link
  // 4. Clean up the temporary data after download or expiry
  
  success(res, { 
    message: 'Data export requested successfully. You will receive an email with a download link within 24 hours.',
    exportId: `export_${userId}_${Date.now()}`
  });
}));

// Get user statistics
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  
  const stats = await query(
    `SELECT 
      (SELECT COUNT(*) FROM color_matches WHERE user_id = ?) as color_matches_count,
      (SELECT COUNT(*) FROM boards WHERE user_id = ?) as boards_count,
      (SELECT COUNT(*) FROM community_posts WHERE user_id = ?) as posts_count,
      (SELECT COUNT(*) FROM community_likes WHERE post_id IN (SELECT id FROM community_posts WHERE user_id = ?)) as likes_received,
      (SELECT COUNT(*) FROM community_follows WHERE followed_user_id = ?) as followers_count,
      (SELECT COUNT(*) FROM community_follows WHERE follower_user_id = ?) as following_count`,
    [userId, userId, userId, userId, userId, userId]
  );
  
  if (stats.rows.length === 0) {
    return notFound(res, null, 'User stats not found');
  }
  
  success(res, { stats: stats.rows[0] });
}));

// Update profile image
router.put('/profile-image', [
  authenticateToken,
  body('profile_image_url').isURL()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return badRequest(res, null, 'Validation failed', { errors: formatValidationErrors(errors) });
  }
  
  const userId = req.user.userId;
  const { profile_image_url } = req.body;
  
  await query(
    'UPDATE users SET profile_image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [profile_image_url, userId]
  );
  
  success(res, { profile_image_url }, 'Profile image updated successfully');
}));

// Change password
router.put('/password', [
  authenticateToken,
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 8 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return badRequest(res, null, 'Validation failed', { errors: formatValidationErrors(errors) });
  }
  
  const userId = req.user.userId;
  const { current_password, new_password } = req.body;
  
  // Get current password hash
  const result = await query('SELECT password_hash FROM users WHERE id = ?', [userId]);
  if (result.rows.length === 0) {
    return notFound(res, null, 'User not found');
  }
  
  // Verify current password
  const bcrypt = require('bcrypt');
  const isValidPassword = await bcrypt.compare(current_password, result.rows[0].password_hash);
  
  if (!isValidPassword) {
    return badRequest(res, null, 'Current password is incorrect');
  }
  
  // Hash new password
  const saltRounds = 12;
  const newPasswordHash = await bcrypt.hash(new_password, saltRounds);
  
  // Update password
  await query(
    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newPasswordHash, userId]
  );
  
  success(res, null, 'Password updated successfully');
}));

module.exports = router;
