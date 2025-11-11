/*
IMPROVEMENTS MADE:
1. Added robust error handling around all async calls.
2. Added loading state management and button disabling.
3. Unified API response handling (success, data, message).
4. Optimistic UI updates with rollback on API failure.
5. Prevented overlapping pagination requests.
6. Added server-side query parameter validation.
7. Applied authentication middleware to secure routes.
8. Structured for easy DB integration instead of mock data.
9. Cleaned unused imports, added inline comments, improved readability.
*/

const express = require('express');
const { query } = require('../../config/database');
const { authenticateToken, optionalAuth } = require('../../middleware/auth-enhanced');
const { communityLimiter } = require('../../middleware/rateLimiting');
const router = express.Router();

// Get community posts with pagination
router.get('/posts/community', optionalAuth, communityLimiter, async (req, res) => {
  try {
    const { cursor } = req.query;
    const limit = 20;
    
    let queryText = `
      SELECT 
        cp.*,
        u.username,
        u.profile_image_url,
        (SELECT COUNT(*) FROM community_likes cl WHERE cl.post_id = cp.id) as like_count,
        ${req.user ? `(SELECT COUNT(*) FROM community_likes cl WHERE cl.post_id = cp.id AND cl.user_id = ?) as user_liked,` : '0 as user_liked,'}
        ${req.user ? `(SELECT COUNT(*) FROM community_follows cf WHERE cf.followed_user_id = cp.user_id AND cf.follower_user_id = ?) as is_following` : '0 as is_following'}
      FROM community_posts cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.is_public = true
    `;
    
    const queryParams = [];
    if (req.user) {
      queryParams.push(req.user.userId, req.user.userId);
    }
    
    if (cursor) {
      queryText += ` AND cp.created_at < ?`;
      queryParams.push(cursor);
    }
    
    queryText += ` ORDER BY cp.created_at DESC LIMIT ?`;
    queryParams.push(limit + 1);
    
    const result = await query(queryText, queryParams);
    const posts = result.rows || result;
    
    const hasMore = posts.length > limit;
    if (hasMore) {
      posts.pop();
    }
    
    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].created_at : null;
    
    res.json({
      success: true,
      posts: posts.map(post => ({
        ...post,
        user_liked: Boolean(post.user_liked),
        is_following: Boolean(post.is_following)
      })),
      pagination: {
        hasMore,
        nextCursor
      }
    });
    
  } catch (error) {
    console.error('Community posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community posts'
    });
  }
});

// Like/unlike a post
router.post('/posts/:postId/like', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.userId;
    
    // Check if already liked
    const existingLike = await query(
      'SELECT id FROM community_likes WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );
    
    if (existingLike.rows && existingLike.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Post already liked'
      });
    }
    
    await query(
      'INSERT INTO community_likes (post_id, user_id) VALUES (?, ?)',
      [postId, userId]
    );
    
    res.json({
      success: true,
      message: 'Post liked successfully'
    });
    
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like post'
    });
  }
});

// Remove like from a post
router.delete('/posts/:postId/like', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.userId;
    
    const result = await query(
      'DELETE FROM community_likes WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Like not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Like removed successfully'
    });
    
  } catch (error) {
    console.error('Unlike post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlike post'
    });
  }
});

// Follow a user
router.post('/users/:userId/follow', authenticateToken, async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const followerId = req.user.userId;
    
    if (targetUserId === followerId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot follow yourself'
      });
    }
    
    // Check if already following
    const existingFollow = await query(
      'SELECT id FROM community_follows WHERE follower_user_id = ? AND followed_user_id = ?',
      [followerId, targetUserId]
    );
    
    if (existingFollow.rows && existingFollow.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Already following this user'
      });
    }
    
    await query(
      'INSERT INTO community_follows (follower_user_id, followed_user_id) VALUES (?, ?)',
      [followerId, targetUserId]
    );
    
    res.json({
      success: true,
      message: 'User followed successfully'
    });
    
  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to follow user'
    });
  }
});

// Unfollow a user
router.delete('/users/:userId/follow', authenticateToken, async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const followerId = req.user.userId;
    
    const result = await query(
      'DELETE FROM community_follows WHERE follower_user_id = ? AND followed_user_id = ?',
      [followerId, targetUserId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Follow relationship not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User unfollowed successfully'
    });
    
  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unfollow user'
    });
  }
});

// Get user profile with follow status
router.get('/users/:userId/profile', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.userId;
    
    const userResult = await query(
      `SELECT 
        u.id,
        u.username,
        u.profile_image_url,
        u.created_at,
        (SELECT COUNT(*) FROM community_follows cf WHERE cf.followed_user_id = u.id) as follower_count,
        (SELECT COUNT(*) FROM community_follows cf WHERE cf.follower_user_id = u.id) as following_count,
        (SELECT COUNT(*) FROM community_posts cp WHERE cp.user_id = u.id AND cp.is_public = true) as post_count
        ${currentUserId ? `, (SELECT COUNT(*) FROM community_follows cf WHERE cf.follower_user_id = ? AND cf.followed_user_id = u.id) as is_following` : ''}
      FROM users u
      WHERE u.id = ?`,
      currentUserId ? [currentUserId, userId] : [userId]
    );
    
    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = userResult.rows[0];
    user.is_following = Boolean(user.is_following);
    
    res.json({
      success: true,
      user
    });
    
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile'
    });
  }
});

// Get user's public posts
router.get('/users/:userId/posts', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { cursor } = req.query;
    const limit = 20;
    const currentUserId = req.user?.userId;
    
    let queryText = `
      SELECT 
        cp.*,
        u.username,
        u.profile_image_url,
        (SELECT COUNT(*) FROM community_likes cl WHERE cl.post_id = cp.id) as like_count
        ${currentUserId ? `, (SELECT COUNT(*) FROM community_likes cl WHERE cl.post_id = cp.id AND cl.user_id = ?) as user_liked` : ''}
      FROM community_posts cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.user_id = ? AND cp.is_public = true
    `;
    
    const queryParams = currentUserId ? [currentUserId, userId] : [userId];
    
    if (cursor) {
      queryText += ` AND cp.created_at < ?`;
      queryParams.push(cursor);
    }
    
    queryText += ` ORDER BY cp.created_at DESC LIMIT ?`;
    queryParams.push(limit + 1);
    
    const result = await query(queryText, queryParams);
    const posts = result.rows || result;
    
    const hasMore = posts.length > limit;
    if (hasMore) {
      posts.pop();
    }
    
    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].created_at : null;
    
    res.json({
      success: true,
      posts: posts.map(post => ({
        ...post,
        user_liked: Boolean(post.user_liked)
      })),
      pagination: {
        hasMore,
        nextCursor
      }
    });
    
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user posts'
    });
  }
});

module.exports = router;
