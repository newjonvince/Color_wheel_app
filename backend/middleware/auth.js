const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// normalize DB results (pg/mysql driver agnostic)
const rows = r => (Array.isArray(r) ? r : (r?.rows || []));

const authenticateToken = async (req, res, next) => {
  try {
    // Case-insensitive header access
    const authHeader = req.headers.authorization || req.headers['authorization'] || '';
    const [scheme, presentedToken] = authHeader.split(' ');
    const token = /^Bearer$/i.test(scheme) ? presentedToken : authHeader.trim();

    if (!token) {
      res.set({
        'WWW-Authenticate': 'Bearer realm="API"',
        'Cache-Control': 'no-store'
      });
      return res.status(401).json({ error: 'unauthorized' });
    }

    const verifyOpts = { algorithms: ['HS256'], clockTolerance: 30 };
    if (process.env.JWT_ISSUER) verifyOpts.issuer = process.env.JWT_ISSUER;
    if (process.env.JWT_AUDIENCE) verifyOpts.audience = process.env.JWT_AUDIENCE;

    const decoded = jwt.verify(token, process.env.JWT_SECRET, verifyOpts);

    // Defensive token payload validation
    if (!decoded || !decoded.userId || !decoded.jti) {
      res.set('WWW-Authenticate', 'Bearer realm="API"');
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid token payload' });
    }

    const result = await query(
      `SELECT us.*, u.email, u.username
         FROM user_sessions us
         JOIN users u ON u.id = us.user_id
        WHERE us.jti = ? AND us.user_id = ? AND us.expires_at > NOW() AND us.revoked_at IS NULL`,
      [decoded.jti, decoded.userId]
    );
    const list = rows(result);
    if (!list.length) {
      res.set('WWW-Authenticate', 'Bearer realm="API"');
      return res.status(401).json({ error: 'unauthorized' });
    }

    const s = list[0];
    req.user = { userId: s.user_id, email: s.email, username: s.username, sessionId: s.id, jti: s.jti || decoded.jti };
    req.session = { id: s.id, expiresAt: s.expires_at };
    return next();
  } catch (e) {
    // Never log raw token, only presence
    const authHeaderPresent = !!req.headers.authorization;
    console.error('Auth middleware error:', e?.message, { authHeaderPresent });
    res.set('WWW-Authenticate', 'Bearer realm="API"');
    return res.status(401).json({ error: 'unauthorized' });
  }
};

module.exports = { authenticateToken };
