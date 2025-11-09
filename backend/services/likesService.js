// services/likesService.js - Color match likes management
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { ERROR_MESSAGES, SUCCESS_MESSAGES } = require('../constants');

class LikesService {
  /**
   * Like a color match
   */
  static async likeColorMatch(userId, colorMatchId) {
    try {
      // Check if color match exists
      const colorMatchResult = await query(
        'SELECT id FROM color_matches WHERE id = ?',
        [colorMatchId]
      );

      if (colorMatchResult.rows.length === 0) {
        throw new Error('Color match not found');
      }

      // Check if already liked
      const existingLike = await query(
        'SELECT id FROM color_match_likes WHERE user_id = ? AND color_match_id = ?',
        [userId, colorMatchId]
      );

      if (existingLike.rows.length > 0) {
        throw new Error('Color match already liked');
      }

      // Create like
      const likeId = uuidv4();
      await query(
        'INSERT INTO color_match_likes (id, user_id, color_match_id, created_at) VALUES (?, ?, ?, NOW())',
        [likeId, userId, colorMatchId]
      );

      // Get updated like count
      const likeCount = await this.getLikeCount(colorMatchId);

      return {
        id: likeId,
        user_id: userId,
        color_match_id: colorMatchId,
        like_count: likeCount,
        message: 'Color match liked successfully'
      };
    } catch (error) {
      console.error('Like color match error:', error);
      throw error;
    }
  }

  /**
   * Unlike a color match
   */
  static async unlikeColorMatch(userId, colorMatchId) {
    try {
      // Check if like exists
      const existingLike = await query(
        'SELECT id FROM color_match_likes WHERE user_id = ? AND color_match_id = ?',
        [userId, colorMatchId]
      );

      if (existingLike.rows.length === 0) {
        throw new Error('Like not found');
      }

      // Remove like
      await query(
        'DELETE FROM color_match_likes WHERE user_id = ? AND color_match_id = ?',
        [userId, colorMatchId]
      );

      // Get updated like count
      const likeCount = await this.getLikeCount(colorMatchId);

      return {
        color_match_id: colorMatchId,
        like_count: likeCount,
        message: 'Color match unliked successfully'
      };
    } catch (error) {
      console.error('Unlike color match error:', error);
      throw error;
    }
  }

  /**
   * Get like count for a color match
   */
  static async getLikeCount(colorMatchId) {
    try {
      const result = await query(
        'SELECT COUNT(*) as like_count FROM color_match_likes WHERE color_match_id = ?',
        [colorMatchId]
      );

      return result.rows[0]?.like_count || 0;
    } catch (error) {
      console.error('Get like count error:', error);
      return 0;
    }
  }

  /**
   * Check if user liked a color match
   */
  static async isLikedByUser(userId, colorMatchId) {
    try {
      const result = await query(
        'SELECT id FROM color_match_likes WHERE user_id = ? AND color_match_id = ?',
        [userId, colorMatchId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Check if liked error:', error);
      return false;
    }
  }

  /**
   * Get likes for multiple color matches (for list views)
   */
  static async getLikesForColorMatches(colorMatchIds, userId = null) {
    try {
      if (!Array.isArray(colorMatchIds) || colorMatchIds.length === 0) {
        return {};
      }

      // Get like counts
      const placeholders = colorMatchIds.map(() => '?').join(',');
      const countsResult = await query(
        `SELECT color_match_id, COUNT(*) as like_count 
         FROM color_match_likes 
         WHERE color_match_id IN (${placeholders})
         GROUP BY color_match_id`,
        colorMatchIds
      );

      const likeCounts = {};
      countsResult.rows.forEach(row => {
        likeCounts[row.color_match_id] = row.like_count;
      });

      // Get user's likes if userId provided
      let userLikes = {};
      if (userId) {
        const userLikesResult = await query(
          `SELECT color_match_id 
           FROM color_match_likes 
           WHERE color_match_id IN (${placeholders}) AND user_id = ?`,
          [...colorMatchIds, userId]
        );

        userLikesResult.rows.forEach(row => {
          userLikes[row.color_match_id] = true;
        });
      }

      // Combine results
      const result = {};
      colorMatchIds.forEach(id => {
        result[id] = {
          like_count: likeCounts[id] || 0,
          is_liked: userLikes[id] || false
        };
      });

      return result;
    } catch (error) {
      console.error('Get likes for color matches error:', error);
      return {};
    }
  }

  /**
   * Get user's liked color matches
   */
  static async getUserLikedColorMatches(userId, options = {}) {
    try {
      const { limit = 20, offset = 0 } = options;

      const result = await query(
        `SELECT 
          cm.*,
          cml.created_at as liked_at,
          (SELECT COUNT(*) FROM color_match_likes WHERE color_match_id = cm.id) as like_count
         FROM color_matches cm
         JOIN color_match_likes cml ON cm.id = cml.color_match_id
         WHERE cml.user_id = ?
         ORDER BY cml.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      return result.rows.map(row => ({
        ...row,
        colors: JSON.parse(row.colors),
        is_liked: true
      }));
    } catch (error) {
      console.error('Get user liked color matches error:', error);
      throw error;
    }
  }

  /**
   * Get most liked color matches
   */
  static async getMostLikedColorMatches(options = {}) {
    try {
      const { limit = 20, offset = 0, minLikes = 1 } = options;

      const result = await query(
        `SELECT 
          cm.*,
          COUNT(cml.id) as like_count
         FROM color_matches cm
         LEFT JOIN color_match_likes cml ON cm.id = cml.color_match_id
         WHERE cm.privacy = 'public'
         GROUP BY cm.id
         HAVING like_count >= ?
         ORDER BY like_count DESC, cm.created_at DESC
         LIMIT ? OFFSET ?`,
        [minLikes, limit, offset]
      );

      return result.rows.map(row => ({
        ...row,
        colors: JSON.parse(row.colors)
      }));
    } catch (error) {
      console.error('Get most liked color matches error:', error);
      throw error;
    }
  }
}

module.exports = LikesService;
