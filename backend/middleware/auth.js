const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// normalize DB results (pg/mysql driver agnostic)
const rows = r => (Array.isArray(r) ? r : (r?.rows || []));

module.exports = async function authenticateToken(req, res, next) {
  try {
    const raw = (req.headers['authorization'] || '').trim();
    // Accept "Bearer <token>" (any case) OR just "<token>"
    let token = '';
    const m = raw.match(/^Bearer\s+(.+)$/i);
    token = m ? m[1].trim() : raw;

    if (!token) {
      console.warn('Auth middleware: No token provided', {
        authHeaderPresent: !!raw,
        userAgent: req.headers['user-agent'],
        ip: req.headers['x-real-ip'] || req.ip,
      });
      return res.status(401).json({ error: 'Missing token' });
    }

    const verifyOpts = { algorithms: ['HS256'], clockTolerance: 30 };
    if (process.env.JWT_ISSUER) verifyOpts.issuer = process.env.JWT_ISSUER;
    if (process.env.JWT_AUDIENCE) verifyOpts.audience = process.env.JWT_AUDIENCE;

    const decoded = jwt.verify(token, process.env.JWT_SECRET, verifyOpts);

    const result = await query(
      `SELECT us.*, u.email, u.username
         FROM user_sessions us
         JOIN users u ON u.id = us.user_id
        WHERE us.jti = ? AND us.user_id = ? AND us.expires_at > NOW() AND us.revoked_at IS NULL`,
      [decoded.jti, decoded.userId]
    );
    const list = rows(result);
    if (!list.length) return res.status(401).json({ error: 'Invalid or expired session' });

    const s = list[0];
    req.user = { userId: s.user_id, email: s.email, username: s.username, sessionId: s.id, jti: s.jti || decoded.jti };
    req.session = { id: s.id, expiresAt: s.expires_at };
    return next();
  } catch (e) {
    console.error('Auth middleware error:', e?.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};
