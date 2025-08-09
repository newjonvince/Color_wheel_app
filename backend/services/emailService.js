const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { query } = require('../config/database');

/**
 * Email service for sending verification emails, password resets, etc.
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize the email transporter based on environment configuration
   */
  initializeTransporter() {
    try {
      // Support multiple email providers
      if (process.env.EMAIL_PROVIDER === 'gmail') {
        this.transporter = nodemailer.createTransporter({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD // Use App Password for Gmail
          }
        });
      } else if (process.env.EMAIL_PROVIDER === 'sendgrid') {
        this.transporter = nodemailer.createTransporter({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          }
        });
      } else if (process.env.EMAIL_PROVIDER === 'smtp') {
        // Generic SMTP configuration
        this.transporter = nodemailer.createTransporter({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      } else {
        // Development mode or no email provider configured
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production') {
          console.log('📧 Email service disabled - no provider configured (emails will be logged only)');
          this.transporter = null;
          return;
        }
        throw new Error('Email provider not configured');
      }

      console.log('📧 Email service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error.message);
      this.transporter = null;
    }
  }

  /**
   * Generate a secure verification token
   */
  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(email, username, userId) {
    try {
      if (!this.transporter) {
        console.log(`📧 [DISABLED] Would send verification email to ${email} (email service not configured)`);
        // Still generate and store the token for testing purposes
        const verificationToken = this.generateVerificationToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        // Store verification token in database even without email
        await query(
          `INSERT INTO email_verifications (user_id, email, token, expires_at) 
           VALUES (?, ?, ?, ?) 
           ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at), created_at = NOW()`,
          [userId, email, verificationToken, expiresAt]
        );
        
        return { success: true, token: verificationToken };
      }

      const verificationToken = this.generateVerificationToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store verification token in database
      await query(
        `INSERT INTO email_verifications (user_id, email, token, expires_at) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at), created_at = NOW()`,
        [userId, email, verificationToken, expiresAt]
      );

      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:19006'}/verify-email?token=${verificationToken}`;

      const mailOptions = {
        from: `"Fashion Color Wheel" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify Your Email - Fashion Color Wheel',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to Fashion Color Wheel!</h2>
            <p>Hi ${username},</p>
            <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
            <p>This verification link will expire in 24 hours.</p>
            <p>If you didn't create this account, please ignore this email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              Fashion Color Wheel Team<br>
              This is an automated email, please do not reply.
            </p>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Verification email sent to ${email}`);
      
      return { success: true, token: verificationToken };
    } catch (error) {
      console.error('❌ Failed to send verification email:', error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, username, userId) {
    try {
      if (!this.transporter) {
        console.log(`📧 [DISABLED] Would send password reset email to ${email} (email service not configured)`);
        // Still generate and store the token for testing purposes
        const resetToken = this.generateVerificationToken();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        
        // Store reset token in database even without email
        await query(
          `INSERT INTO password_resets (user_id, email, token, expires_at) 
           VALUES (?, ?, ?, ?) 
           ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at), created_at = NOW()`,
          [userId, email, resetToken, expiresAt]
        );
        
        return { success: true, token: resetToken };
      }

      const resetToken = this.generateVerificationToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token in database
      await query(
        `INSERT INTO password_resets (user_id, email, token, expires_at) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at), created_at = NOW()`,
        [userId, email, resetToken, expiresAt]
      );

      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:19006'}/reset-password?token=${resetToken}`;

      const mailOptions = {
        from: `"Fashion Color Wheel" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Password Reset - Fashion Color Wheel',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>Hi ${username},</p>
            <p>You requested a password reset for your Fashion Color Wheel account.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p>This reset link will expire in 1 hour.</p>
            <p>If you didn't request this password reset, please ignore this email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              Fashion Color Wheel Team<br>
              This is an automated email, please do not reply.
            </p>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Password reset email sent to ${email}`);
      
      return { success: true, token: resetToken };
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      throw error;
    }
  }

  /**
   * Verify email verification token
   */
  async verifyEmailToken(token) {
    try {
      const result = await query(
        `SELECT ev.*, u.email, u.username 
         FROM email_verifications ev 
         JOIN users u ON ev.user_id = u.id 
         WHERE ev.token = ? AND ev.expires_at > NOW() AND ev.verified_at IS NULL`,
        [token]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Invalid or expired verification token' };
      }

      const verification = result.rows[0];

      // Mark email as verified
      await query(
        'UPDATE email_verifications SET verified_at = NOW() WHERE token = ?',
        [token]
      );

      // Mark user as email verified
      await query(
        'UPDATE users SET email_verified = true, email_verified_at = NOW() WHERE id = ?',
        [verification.user_id]
      );

      console.log(`✅ Email verified for user ${verification.username}`);
      
      return { 
        success: true, 
        userId: verification.user_id,
        email: verification.email,
        username: verification.username
      };
    } catch (error) {
      console.error('❌ Email verification error:', error);
      throw error;
    }
  }

  /**
   * Verify password reset token
   */
  async verifyResetToken(token) {
    try {
      const result = await query(
        `SELECT pr.*, u.email, u.username 
         FROM password_resets pr 
         JOIN users u ON pr.user_id = u.id 
         WHERE pr.token = ? AND pr.expires_at > NOW() AND pr.used_at IS NULL`,
        [token]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Invalid or expired reset token' };
      }

      const reset = result.rows[0];
      
      return { 
        success: true, 
        userId: reset.user_id,
        email: reset.email,
        username: reset.username
      };
    } catch (error) {
      console.error('❌ Password reset token verification error:', error);
      throw error;
    }
  }

  /**
   * Mark password reset token as used
   */
  async markResetTokenUsed(token) {
    try {
      await query(
        'UPDATE password_resets SET used_at = NOW() WHERE token = ?',
        [token]
      );
    } catch (error) {
      console.error('❌ Error marking reset token as used:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();
