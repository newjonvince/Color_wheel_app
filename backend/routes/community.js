const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fashion_color_wheel',
  charset: 'utf8mb4'
};

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Get community posts (public posts from all users)
router.get('/posts/community', authenticateToken, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [posts] = await connection.execute(`
      SELECT 
        p.*,
        u.username,
        u.profile_image_url,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) as comments_count,
        (SELECT COUNT(*) > 0 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) as is_liked,
        (SELECT COUNT(*) > 0 FROM user_follows uf WHERE uf.following_id = p.user_id AND uf.follower_id = ?) as is_following
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.is_public = 1
      ORDER BY p.created_at DESC
      LIMIT 50
    `, [req.user.id, req.user.id]);

    // Parse colors JSON for each post
    const postsWithColors = posts.map(post => ({
      ...post,
      colors: post.colors ? JSON.parse(post.colors) : []
    }));

    await connection.end();
    res.json({ data: postsWithColors });
  } catch (error) {
    console.error('Error fetching community posts:', error);
    res.status(500).json({ error: 'Failed to fetch community posts' });
  }
});

// Get suggested users to follow
router.get('/users/suggested', authenticateToken, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [users] = await connection.execute(`
      SELECT 
        u.id,
        u.username,
        u.profile_image_url,
        u.created_at,
        (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id AND p.is_public = 1) as posts_count,
        (SELECT COUNT(*) > 0 FROM user_follows uf WHERE uf.following_id = u.id AND uf.follower_id = ?) as is_following
      FROM users u
      WHERE u.id != ?
      AND u.id NOT IN (
        SELECT following_id FROM user_follows WHERE follower_id = ?
      )
      ORDER BY posts_count DESC, u.created_at DESC
      LIMIT 10
    `, [req.user.id, req.user.id, req.user.id]);

    await connection.end();
    res.json({ data: users });
  } catch (error) {
    console.error('Error fetching suggested users:', error);
    res.status(500).json({ error: 'Failed to fetch suggested users' });
  }
});

// Get users that current user is following
router.get('/users/following', authenticateToken, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [users] = await connection.execute(`
      SELECT 
        u.id,
        u.username,
        u.profile_image_url,
        uf.created_at as followed_at
      FROM user_follows uf
      JOIN users u ON uf.following_id = u.id
      WHERE uf.follower_id = ?
      ORDER BY uf.created_at DESC
    `, [req.user.id]);

    await connection.end();
    res.json({ data: users });
  } catch (error) {
    console.error('Error fetching following users:', error);
    res.status(500).json({ error: 'Failed to fetch following users' });
  }
});

// Get users that follow current user
router.get('/users/followers', authenticateToken, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [users] = await connection.execute(`
      SELECT 
        u.id,
        u.username,
        u.profile_image_url,
        uf.created_at as followed_at,
        (SELECT COUNT(*) > 0 FROM user_follows uf2 WHERE uf2.following_id = u.id AND uf2.follower_id = ?) as is_following
      FROM user_follows uf
      JOIN users u ON uf.follower_id = u.id
      WHERE uf.following_id = ?
      ORDER BY uf.created_at DESC
    `, [req.user.id, req.user.id]);

    await connection.end();
    res.json({ data: users });
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// Follow a user
router.post('/users/:userId/follow', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId == req.user.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const connection = await mysql.createConnection(dbConfig);
    
    // Check if already following
    const [existing] = await connection.execute(
      'SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?',
      [req.user.id, userId]
    );

    if (existing.length > 0) {
      await connection.end();
      return res.status(400).json({ error: 'Already following this user' });
    }

    // Add follow relationship
    await connection.execute(
      'INSERT INTO user_follows (follower_id, following_id) VALUES (?, ?)',
      [req.user.id, userId]
    );

    await connection.end();
    res.json({ message: 'User followed successfully' });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow a user
router.delete('/users/:userId/follow', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    
    await connection.execute(
      'DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?',
      [req.user.id, userId]
    );

    await connection.end();
    res.json({ message: 'User unfollowed successfully' });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Like a post
router.post('/posts/:postId/like', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    
    // Check if already liked
    const [existing] = await connection.execute(
      'SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?',
      [req.user.id, postId]
    );

    if (existing.length > 0) {
      // Unlike the post
      await connection.execute(
        'DELETE FROM post_likes WHERE user_id = ? AND post_id = ?',
        [req.user.id, postId]
      );
    } else {
      // Like the post
      await connection.execute(
        'INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)',
        [req.user.id, postId]
      );
    }

    await connection.end();
    res.json({ message: 'Post like toggled successfully' });
  } catch (error) {
    console.error('Error toggling post like:', error);
    res.status(500).json({ error: 'Failed to toggle post like' });
  }
});

// Create a new post
router.post('/posts', authenticateToken, async (req, res) => {
  try {
    const { colors, image_url, description, is_public = true } = req.body;
    const connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute(
      'INSERT INTO posts (user_id, colors, image_url, description, is_public) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, JSON.stringify(colors), image_url, description, is_public]
    );

    await connection.end();
    res.json({ 
      message: 'Post created successfully',
      postId: result.insertId
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

module.exports = router;
