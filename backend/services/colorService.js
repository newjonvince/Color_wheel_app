// services/colorService.js - Color management business logic

const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { ERROR_MESSAGES, SUCCESS_MESSAGES, COLOR_SCHEMES, PAGINATION } = require('../constants');

class ColorService {
  /**
   * Validate hex color format
   */
  static validateHexColor(hex) {
    const cleanHex = hex.startsWith('#') ? hex : `#${hex}`;
    return /^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(cleanHex);
  }

  /**
   * Normalize hex color
   */
  static normalizeHexColor(hex) {
    let cleanHex = hex.trim();
    if (!cleanHex.startsWith('#')) {
      cleanHex = `#${cleanHex}`;
    }
    return cleanHex.toUpperCase();
  }

  /**
   * Validate color scheme
   */
  static validateColorScheme(scheme) {
    return COLOR_SCHEMES.includes(scheme);
  }

  /**
   * Create color match
   */
  static async createColorMatch(userId, colorMatchData) {
    const { base_color, scheme, colors, title, description, privacy = 'private' } = colorMatchData;

    // Validate inputs
    if (!this.validateHexColor(base_color)) {
      throw new Error('Invalid base color format');
    }

    if (!this.validateColorScheme(scheme)) {
      throw new Error('Invalid color scheme');
    }

    if (!Array.isArray(colors) || colors.length === 0) {
      throw new Error('Colors array is required and cannot be empty');
    }

    // Validate all colors in the array
    for (const color of colors) {
      if (!this.validateHexColor(color)) {
        throw new Error(`Invalid color format: ${color}`);
      }
    }

    // Normalize colors
    const normalizedBaseColor = this.normalizeHexColor(base_color);
    const normalizedColors = colors.map(color => this.normalizeHexColor(color));

    const colorMatchId = uuidv4();
    
    await query(
      `INSERT INTO color_matches (id, user_id, base_color, scheme, colors, title, description, privacy, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        colorMatchId, 
        userId, 
        normalizedBaseColor, 
        scheme, 
        JSON.stringify(normalizedColors), 
        title || `${scheme} palette`,
        description || '',
        privacy
      ]
    );

    // Fetch the created color match
    const result = await query(
      'SELECT * FROM color_matches WHERE id = ?',
      [colorMatchId]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to create color match');
    }

    return this.formatColorMatchResponse(result.rows[0]);
  }

  /**
   * Get color matches for user
   */
  static async getUserColorMatches(userId, options = {}) {
    const { 
      limit = PAGINATION.DEFAULT_LIMIT, 
      offset = PAGINATION.DEFAULT_OFFSET,
      scheme = null,
      privacy = null 
    } = options;

    let queryText = `
      SELECT cm.*, u.username 
      FROM color_matches cm 
      JOIN users u ON cm.user_id = u.id 
      WHERE cm.user_id = ?
    `;
    const queryParams = [userId];

    if (scheme) {
      queryText += ' AND cm.scheme = ?';
      queryParams.push(scheme);
    }

    if (privacy) {
      queryText += ' AND cm.privacy = ?';
      queryParams.push(privacy);
    }

    queryText += ' ORDER BY cm.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, queryParams);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM color_matches WHERE user_id = ?';
    const countParams = [userId];

    if (scheme) {
      countQuery += ' AND scheme = ?';
      countParams.push(scheme);
    }

    if (privacy) {
      countQuery += ' AND privacy = ?';
      countParams.push(privacy);
    }

    const countResult = await query(countQuery, countParams);
    const total = countResult.rows[0]?.total || 0;

    return {
      colorMatches: result.rows.map(row => this.formatColorMatchResponse(row)),
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit: parseInt(limit),
        total: parseInt(total),
      }
    };
  }

  /**
   * Get public color matches
   */
  static async getPublicColorMatches(options = {}) {
    const { 
      limit = PAGINATION.DEFAULT_LIMIT, 
      offset = PAGINATION.DEFAULT_OFFSET,
      scheme = null 
    } = options;

    let queryText = `
      SELECT cm.*, u.username 
      FROM color_matches cm 
      JOIN users u ON cm.user_id = u.id 
      WHERE cm.privacy = 'public'
    `;
    const queryParams = [];

    if (scheme) {
      queryText += ' AND cm.scheme = ?';
      queryParams.push(scheme);
    }

    queryText += ' ORDER BY cm.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, queryParams);

    // Get total count
    let countQuery = "SELECT COUNT(*) as total FROM color_matches WHERE privacy = 'public'";
    const countParams = [];

    if (scheme) {
      countQuery += ' AND scheme = ?';
      countParams.push(scheme);
    }

    const countResult = await query(countQuery, countParams);
    const total = countResult.rows[0]?.total || 0;

    return {
      colorMatches: result.rows.map(row => this.formatColorMatchResponse(row)),
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit: parseInt(limit),
        total: parseInt(total),
      }
    };
  }

  /**
   * Get color match by ID
   */
  static async getColorMatchById(matchId, userId = null) {
    let queryText = `
      SELECT cm.*, u.username 
      FROM color_matches cm 
      JOIN users u ON cm.user_id = u.id 
      WHERE cm.id = ?
    `;
    const queryParams = [matchId];

    // If userId is provided, check ownership or public visibility
    if (userId) {
      queryText += ' AND (cm.user_id = ? OR cm.privacy = "public")';
      queryParams.push(userId);
    } else {
      queryText += ' AND cm.privacy = "public"';
    }

    const result = await query(queryText, queryParams);

    if (result.rows.length === 0) {
      throw new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    return this.formatColorMatchResponse(result.rows[0]);
  }

  /**
   * Update color match
   */
  static async updateColorMatch(matchId, userId, updates) {
    // First check if the color match exists and belongs to the user
    const existingMatch = await query(
      'SELECT id FROM color_matches WHERE id = ? AND user_id = ?',
      [matchId, userId]
    );

    if (existingMatch.rows.length === 0) {
      throw new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    const { title, description, privacy } = updates;

    await query(
      `UPDATE color_matches SET 
       title = COALESCE(?, title),
       description = COALESCE(?, description),
       privacy = COALESCE(?, privacy),
       updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [title, description, privacy, matchId, userId]
    );

    // Return updated color match
    return this.getColorMatchById(matchId, userId);
  }

  /**
   * Delete color match
   */
  static async deleteColorMatch(matchId, userId) {
    const result = await query(
      'DELETE FROM color_matches WHERE id = ? AND user_id = ?',
      [matchId, userId]
    );

    if (result.affectedRows === 0) {
      throw new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    return { message: SUCCESS_MESSAGES.RESOURCE_DELETED };
  }

  /**
   * Validate hex color (API endpoint)
   */
  static validateColor(hex) {
    const normalizedHex = this.normalizeHexColor(hex);
    const isValid = this.validateHexColor(normalizedHex);
    
    return {
      hex: normalizedHex,
      valid: isValid,
    };
  }

  /**
   * Format color match response
   */
  static formatColorMatchResponse(colorMatch) {
    return {
      id: colorMatch.id,
      user_id: colorMatch.user_id,
      username: colorMatch.username,
      base_color: colorMatch.base_color,
      scheme: colorMatch.scheme,
      colors: typeof colorMatch.colors === 'string' 
        ? JSON.parse(colorMatch.colors) 
        : colorMatch.colors,
      title: colorMatch.title,
      description: colorMatch.description,
      privacy: colorMatch.privacy,
      created_at: colorMatch.created_at,
      updated_at: colorMatch.updated_at,
      like_count: colorMatch.like_count || 0,
      is_liked: Boolean(colorMatch.is_liked),
    };
  }
}

module.exports = ColorService;
