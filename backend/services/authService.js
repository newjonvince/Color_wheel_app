// services/authService.js - Authentication business logic

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { ERROR_MESSAGES, SUCCESS_MESSAGES } = require('../constants');

class AuthService {
  /**
   * Register a new user
   */
  static async registerUser(userData) {
    const { email, username, password, location, birthday, gender } = userData;
    
    // Parse birthday data
    const birthday_month = birthday?.month || null;
    const birthday_day = parseInt(birthday?.day) || null;
    const birthday_year = parseInt(birthday?.year) || null;

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      throw new Error(ERROR_MESSAGES.USER_ALREADY_EXISTS);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    
    // Insert user
    await query(
      `INSERT INTO users (id, email, username, password_hash, location, birthday_month, birthday_day, birthday_year, gender, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, email, username, hashedPassword, location, birthday_month, birthday_day, birthday_year, gender]
    );
    
    // Fetch created user
    const userResult = await query(
      'SELECT id, email, username, location, birthday_month, birthday_day, birthday_year, gender, created_at FROM users WHERE email = ?',
      [email]
    );

    if (userResult.rows.length === 0) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    const user = userResult.rows[0];
    
    // Generate token
    const token = this.generateToken(user.id);
    
    // Create session
    await this.createSession(user.id, token);

    return {
      user: this.formatUserResponse(user),
      token,
      message: SUCCESS_MESSAGES.USER_CREATED,
    };
  }

  /**
   * Login user
   */
  static async loginUser(email, password) {
    // Find user by email
    const userResult = await query(
      'SELECT id, email, username, password_hash, location, birthday_month, birthday_day, birthday_year, gender, created_at, is_active FROM users WHERE email = ?',
      [email]
    );

    if (userResult.rows.length === 0) {
      throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    const user = userResult.rows[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error(ERROR_MESSAGES.UNAUTHORIZED_ACCESS);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    // Generate token
    const token = this.generateToken(user.id);
    
    // Create session
    await this.createSession(user.id, token);

    return {
      user: this.formatUserResponse(user),
      token,
      message: SUCCESS_MESSAGES.LOGIN_SUCCESS,
    };
  }

  /**
   * Demo login
   */
  static async demoLogin() {
    const demoUser = {
      id: 'demo-user',
      email: 'demo@fashioncolorwheel.com',
      username: 'demo_user',
      location: 'United States',
      birthday_month: 'January',
      birthday_day: 1,
      birthday_year: 1990,
      gender: 'Prefer not to say',
      created_at: new Date().toISOString(),
      is_active: true,
    };

    // Generate token for demo user
    const token = this.generateToken(demoUser.id);

    return {
      user: this.formatUserResponse(demoUser),
      token,
      message: SUCCESS_MESSAGES.LOGIN_SUCCESS,
    };
  }

  /**
   * Get user profile
   */
  static async getUserProfile(userId) {
    const result = await query(
      'SELECT id, email, username, location, birthday_month, birthday_day, birthday_year, gender, created_at FROM users WHERE id = ? AND is_active = 1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    return this.formatUserResponse(result.rows[0]);
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(userId, updates) {
    const { username, location, birthday, gender } = updates;
    
    // Parse birthday if provided
    const birthday_month = birthday?.month || null;
    const birthday_day = parseInt(birthday?.day) || null;
    const birthday_year = parseInt(birthday?.year) || null;

    // Check if username is taken by another user
    if (username) {
      const existingUser = await query(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, userId]
      );

      if (existingUser.rows.length > 0) {
        throw new Error(ERROR_MESSAGES.USERNAME_ALREADY_TAKEN);
      }
    }

    // Update user
    await query(
      `UPDATE users SET 
       username = COALESCE(?, username),
       location = COALESCE(?, location),
       birthday_month = ?,
       birthday_day = ?,
       birthday_year = ?,
       gender = COALESCE(?, gender),
       updated_at = NOW()
       WHERE id = ?`,
      [username, location, birthday_month, birthday_day, birthday_year, gender, userId]
    );

    // Return updated user
    return this.getUserProfile(userId);
  }

  /**
   * Logout user
   */
  static async logoutUser(userId, token) {
    // Revoke session
    await this.revokeSession(userId, token);
    
    return {
      message: SUCCESS_MESSAGES.LOGOUT_SUCCESS,
    };
  }

  /**
   * Generate JWT token
   */
  static generateToken(userId) {
    const payload = {
      userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    };

    return jwt.sign(payload, process.env.JWT_SECRET);
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error(ERROR_MESSAGES.INVALID_TOKEN);
    }
  }

  /**
   * Create user session
   */
  static async createSession(userId, token) {
    const jti = uuidv4();
    const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours

    await query(
      `INSERT INTO user_sessions (user_id, session_token, expires_at, jti, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [userId, token, expiresAt, jti]
    );

    return jti;
  }

  /**
   * Revoke user session
   */
  static async revokeSession(userId, token) {
    await query(
      'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND session_token = ?',
      [userId, token]
    );
  }

  /**
   * Format user response (remove sensitive data)
   */
  static formatUserResponse(user) {
    const { password_hash, ...userResponse } = user;
    
    // Format birthday
    if (user.birthday_month || user.birthday_day || user.birthday_year) {
      userResponse.birthday = {
        month: user.birthday_month,
        day: user.birthday_day,
        year: user.birthday_year,
      };
    }

    // Remove individual birthday fields
    delete userResponse.birthday_month;
    delete userResponse.birthday_day;
    delete userResponse.birthday_year;

    return userResponse;
  }

  /**
   * Validate session
   */
  static async validateSession(userId, token) {
    const result = await query(
      `SELECT id FROM user_sessions 
       WHERE user_id = ? AND session_token = ? AND expires_at > NOW() AND revoked_at IS NULL`,
      [userId, token]
    );

    return result.rows.length > 0;
  }
}

module.exports = AuthService;
