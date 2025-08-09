const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { query } = require('../config/database');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      const provider = process.env.EMAIL_PROVIDER; // 'gmail' | 'sendgrid' | 'smtp'
      if (!provider) {
        console.log('📧 No EMAIL_PROVIDER set. Email sending disabled (will log only).');
        this.transporter = null;
        return;
      }

      if (provider === 'gmail') {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD, // App Password
          },
        });
      } else if (provider === 'sendgrid') {
        // Use SMTP for SendGrid
        this.transporter = nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY,
          },
        });
      } else if (provider === 'smtp') {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
      } else {
        console.log(`📧 Unknown EMAIL_PROVIDER: ${provider}. Email disabled.`);
        this.transporter = null;
        return;
      }

      console.log('📧 Email service initialized');
    } catch (err) {
      console.error('❌ Email transporter init failed:', err.message);
      this.transporter = null;
    }
  }

  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async sendVerificationEmail(email, username, userId) {
    const token = this.generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Store/Upsert token (MySQL style)
    await query(
      `INSERT INTO email_verifications (user_id, email, token, expires_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at), created_at = NOW()`,
      [userId, email, token, expiresAt]
    );

    const base = process.env.FRONTEND_URL || 'https://your-production-site.example';
    const verificationUrl = `${base}/verify-email?token=${token}`;

    if (!this.transporter) {
      console.log(`📧 [DISABLED] Verification link for ${email}: ${verificationUrl}`);
      // Only return token in non-prod (so QA can click it)
      return { success: true, token: process.env.NODE_ENV === 'production' ? undefined : token };
    }

    await this.transporter.sendMail({
      from: `"Fashion Color Wheel" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - Fashion Color Wheel',
      html: /* html */`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome, ${username}!</h2>
          <p>Please verify your email address:</p>
          <p><a href="${verificationUrl}">Verify Email</a></p>
          <p style="word-break: break-all;">${verificationUrl}</p>
        </div>
      `,
    });

    return { success: true };
  }

  async sendPasswordResetEmail(email, username, userId) {
    const token = this.generateVerificationToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await query(
      `INSERT INTO password_resets (user_id, email, token, expires_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at), created_at = NOW()`,
      [userId, email, token, expiresAt]
    );

    const base = process.env.FRONTEND_URL || 'https://your-production-site.example';
    const resetUrl = `${base}/reset-password?token=${token}`;

    if (!this.transporter) {
      console.log(`📧 [DISABLED] Reset link for ${email}: ${resetUrl}`);
      return { success: true, token: process.env.NODE_ENV === 'production' ? undefined : token };
    }

    await this.transporter.sendMail({
      from: `"Fashion Color Wheel" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset - Fashion Color Wheel',
      html: /* html */`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset</h2>
          <p>Hi ${username}, click the link to reset:</p>
          <p><a href="${resetUrl}">Reset Password</a></p>
          <p style="word-break: break-all;">${resetUrl}</p>
        </div>
      `,
    });

    return { success: true };
  }

  async verifyEmailToken(token) {
    const [rows] = await query(
      `SELECT ev.*, u.email, u.username
       FROM email_verifications ev
       JOIN users u ON ev.user_id = u.id
       WHERE ev.token = ? AND ev.expires_at > NOW() AND ev.verified_at IS NULL`,
      [token]
    );
    if (!rows.length) return { success: false, error: 'Invalid or expired verification token' };

    const v = rows[0];
    await query('UPDATE email_verifications SET verified_at = NOW() WHERE token = ?', [token]);
    await query('UPDATE users SET email_verified = 1, email_verified_at = NOW() WHERE id = ?', [v.user_id]);

    return { success: true, userId: v.user_id, email: v.email, username: v.username };
  }

  async verifyResetToken(token) {
    const [rows] = await query(
      `SELECT pr.*, u.email, u.username
       FROM password_resets pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.token = ? AND pr.expires_at > NOW() AND pr.used_at IS NULL`,
      [token]
    );
    if (!rows.length) return { success: false, error: 'Invalid or expired reset token' };

    const r = rows[0];
    return { success: true, userId: r.user_id, email: r.email, username: r.username };
  }

  async markResetTokenUsed(token) {
    await query('UPDATE password_resets SET used_at = NOW() WHERE token = ?', [token]);
  }
}

module.exports = new EmailService();
