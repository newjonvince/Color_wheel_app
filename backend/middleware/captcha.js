// middleware/captcha.js — hardened hCaptcha verification with timeout & staleness checks
const { verify } = require('hcaptcha');

const isCaptchaEnabled = () =>
  process.env.ENABLE_CAPTCHA === 'true' && !!process.env.HCAPTCHA_SECRET_KEY;

function extractCaptchaToken(req) {
  if (req.body?.captchaToken) return req.body.captchaToken;
  if (req.headers['x-captcha-token']) return req.headers['x-captcha-token'];
  if (req.query?.captchaToken) return req.query.captchaToken;
  return null;
}

function msSince(dateStr) {
  const t = Date.parse(dateStr);
  return Number.isFinite(t) ? (Date.now() - t) : Infinity;
}

async function verifyWithTimeout(secret, token, remoteip, timeoutMs = 4000) {
  let timer;
  try {
    return await Promise.race([
      verify(secret, token, remoteip),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('captcha-timeout')), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function verifyCaptcha(req, res, next) {
  try {
    if (!isCaptchaEnabled()) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('⚠️  CAPTCHA disabled (ENABLE_CAPTCHA!="true" or missing secret)');
      }
      return next();
    }

    const captchaToken = extractCaptchaToken(req);
    if (!captchaToken) {
      return res.status(400).json({ error: 'CAPTCHA verification required', message: 'Missing captchaToken.' });
    }

    const secret = process.env.HCAPTCHA_SECRET_KEY;
    const remoteip = req.ip; // requires app.set('trust proxy', 1) in prod
    let result;
    try {
      result = await verifyWithTimeout(secret, captchaToken, remoteip, Number(process.env.CAPTCHA_TIMEOUT_MS || 4000));
    } catch (e) {
      const msg = e && e.message;
      if (msg === 'captcha-timeout') {
        return res.status(504).json({ error: 'CAPTCHA timeout', message: 'Captcha verification timed out. Please try again.' });
      }
      console.error('❌ CAPTCHA verify error:', msg || e);
      return res.status(502).json({ error: 'CAPTCHA verification error', message: 'Unable to verify CAPTCHA. Please try again.' });
    }

    if (!result?.success) {
      return res.status(400).json({
        error: 'CAPTCHA verification failed',
        message: 'Please complete CAPTCHA correctly.',
        ...(process.env.NODE_ENV !== 'production' && { details: result && result['error-codes'] }),
      });
    }

    // Optional: hostname + sitekey pinning
    const expectedHost = process.env.HCAPTCHA_EXPECTED_HOSTNAME;
    if (expectedHost && result.hostname && result.hostname !== expectedHost) {
      return res.status(400).json({ error: 'CAPTCHA hostname mismatch', message: 'Invalid CAPTCHA host.' });
    }
    const expectedSite = process.env.HCAPTCHA_SITE_KEY;
    if (expectedSite && result.credit && result.credit['info'] && result.credit['info'].sitekey && result.credit['info'].sitekey !== expectedSite) {
      return res.status(400).json({ error: 'CAPTCHA sitekey mismatch', message: 'Invalid CAPTCHA site.' });
    }

    // Staleness check (tolerate clock skew)
    const maxAgeMs = Number(process.env.CAPTCHA_MAX_AGE_MS || 2 * 60 * 1000);
    if (result.challenge_ts && msSince(result.challenge_ts) > maxAgeMs) {
      return res.status(400).json({ error: 'CAPTCHA expired', message: 'Captcha was issued too long ago, please retry.' });
    }

    req.captcha = { ok: true, ts: result.challenge_ts, hostname: result.hostname };
    return next();
  } catch (err) {
    console.error('❌ CAPTCHA middleware error:', err?.message || err);
    return res.status(500).json({ error: 'CAPTCHA middleware error' });
  }
}

async function optionalCaptcha(req, res, next) {
  if (isCaptchaEnabled()) return verifyCaptcha(req, res, next);
  return next();
}

module.exports = { verifyCaptcha, optionalCaptcha, isCaptchaEnabled };
