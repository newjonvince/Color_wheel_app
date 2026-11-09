// services/authService.js - Authentication business logic

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { ERROR_MESSAGES, SUCCESS_MESSAGES } = require('../constants');
const { generateSecureToken, generateSecureRefreshToken, createSessionData, verifySecureToken, verifyRefreshTokenHash } = require('../utils/jwt');

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
    
    // Generate token with session (requires IP and User-Agent for security)
    const tokenData = await this.generateTokenWithSession(
      user, 
      'registration', // IP not available in service layer
      'registration'  // User-Agent not available in service layer
    );

    return {
      user: this.formatUserResponse(user),
      token: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiresAt: tokenData.expiresAt,
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

    // Generate token with session (requires IP and User-Agent for security)
    const tokenData = await this.generateTokenWithSession(
      user, 
      'login', // IP not available in service layer
      'login'  // User-Agent not available in service layer
    );

    return {
      user: this.formatUserResponse(user),
      token: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiresAt: tokenData.expiresAt,
      message: SUCCESS_MESSAGES.LOGIN_SUCCESS,
    };
  }

  /**
   * Demo login
   */
  static async demoLogin() {
    const DEMO_EMAIL = 'demo@fashioncolorwheel.com';
    const DEMO_FIELDS =
      'id, email, username, location, birthday_month, birthday_day, birthday_year, gender, created_at, is_active';

    // The demo account is a real users row with a real session, so demo tokens
    // pass the same session validation as any other login.
    let result = await query(`SELECT ${DEMO_FIELDS} FROM users WHERE email = ?`, [DEMO_EMAIL]);

    if (result.rows.length === 0) {
      // Random password: the demo account is only reachable through this endpoint
      const unusablePassword = await bcrypt.hash(uuidv4() + uuidv4(), 12);
      const username = `demo_user`;
      try {
        await query(
          `INSERT INTO users (id, email, username, password_hash, location, birthday_month, birthday_day, birthday_year, gender, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [uuidv4(), DEMO_EMAIL, username, unusablePassword, 'United States', 'January', 1, 1990, 'Prefer not to say']
        );
      } catch (err) {
        // Duplicate email means we lost a race with a concurrent demo login:
        // fine, the re-select below picks up the winner's row. A duplicate
        // username means someone registered "demo_user"; retry with a suffix.
        if (err?.code !== 'ER_DUP_ENTRY') throw err;
        const taken = await query('SELECT id FROM users WHERE email = ?', [DEMO_EMAIL]);
        if (taken.rows.length === 0) {
          await query(
            `INSERT INTO users (id, email, username, password_hash, location, birthday_month, birthday_day, birthday_year, gender, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [uuidv4(), DEMO_EMAIL, `demo_user_${uuidv4().slice(0, 8)}`, unusablePassword, 'United States', 'January', 1, 1990, 'Prefer not to say']
          );
        }
      }
      result = await query(`SELECT ${DEMO_FIELDS} FROM users WHERE email = ?`, [DEMO_EMAIL]);
    }

    if (result.rows.length === 0) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    const user = result.rows[0];
    if (!user.is_active) {
      throw new Error(ERROR_MESSAGES.UNAUTHORIZED_ACCESS);
    }

    const tokenData = await this.generateTokenWithSession(user, 'demo-login', 'demo-login');

    return {
      user: this.formatUserResponse(user),
      token: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiresAt: tokenData.expiresAt,
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
   * Generate JWT token with session
   */
  static async generateTokenWithSession(user, ipAddress, userAgent) {
    const tokenData = generateSecureToken(
      { userId: user.id, email: user.email },
      { expiresIn: '7d' }
    );
    
    const refreshData = generateSecureRefreshToken(
      { userId: user.id, email: user.email },
      tokenData.jti
    );
    
    // Create session record
    const sessionData = createSessionData({
      userId: user.id,
      jti: tokenData.jti,
      expiresAt: tokenData.expiresAt,
      ipAddress,
      userAgent
    });
    
    // Insert session into database with hashed refresh token
    const sessionResult = await query(
      `INSERT INTO user_sessions (
        user_id, jti, expires_at, ip_address, user_agent, 
        created_at, revoked_at, refresh_count, refresh_token_hash, refresh_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionData.user_id,
        sessionData.jti,
        sessionData.expires_at,
        sessionData.ip_address,
        sessionData.user_agent,
        sessionData.created_at,
        sessionData.revoked_at,
        sessionData.refresh_count,
        refreshData.tokenHash, // Store hash instead of raw JTI
        refreshData.expiresAt
      ]
    );
    
    // query() wraps the mysql2 result as { rows }; for INSERTs rows is the
    // ResultSetHeader, which carries insertId
    const insertId = sessionResult.rows?.insertId ?? null;
    
    return {
      accessToken: tokenData.token,
      refreshToken: refreshData.refreshToken,
      expiresAt: tokenData.expiresAt,
      sessionId: insertId
    };
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token) {
    try {
      return verifySecureToken(token);
    } catch (error) {
      throw new Error(ERROR_MESSAGES.INVALID_TOKEN);
    }
  }

  /**
   * Create user session (legacy method - use generateTokenWithSession instead)
   */
  static async createSession(userId, token, ipAddress = null, userAgent = null) {
    // This is kept for backward compatibility but should be replaced
    console.warn('AuthService.createSession is deprecated. Use generateTokenWithSession instead.');
    
    const tokenData = generateSecureToken(
      { userId, email: 'legacy@example.com' },
      { expiresIn: '24h' }
    );
    
    const sessionData = createSessionData({
      userId,
      jti: tokenData.jti,
      expiresAt: tokenData.expiresAt,
      ipAddress,
      userAgent
    });
    
    await query(
      `INSERT INTO user_sessions (
        user_id, jti, expires_at, ip_address, user_agent, 
        created_at, revoked_at, refresh_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionData.user_id,
        sessionData.jti,
        sessionData.expires_at,
        sessionData.ip_address,
        sessionData.user_agent,
        sessionData.created_at,
        sessionData.revoked_at,
        sessionData.refresh_count
      ]
    );

    return tokenData.jti;
  }

  /**
   * Revoke user session
   */
  static async revokeSession(userId, jti = null) {
    if (jti) {
      // Revoke specific session by JTI
      await query(
        'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND jti = ?',
        [userId, jti]
      );
    } else {
      // Revoke all sessions for user
      await query(
        'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
        [userId]
      );
    }
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
   * Validate user session
   */
  static async validateSession(userId, jti) {
    const result = await query(
      `SELECT id, expires_at FROM user_sessions 
       WHERE user_id = ? AND jti = ? AND expires_at > NOW() AND revoked_at IS NULL`,
      [userId, jti]
    );

    return result.rows && result.rows.length > 0 ? result.rows[0] : null;
  }
}

module.exports = AuthService;
