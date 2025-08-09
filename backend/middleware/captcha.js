// middleware/captcha.js
const { verify } = require('hcaptcha');

const isCaptchaEnabled = () =>
  process.env.ENABLE_CAPTCHA === 'true' && !!process.env.HCAPTCHA_SECRET_KEY;

function extractCaptchaToken(req) {
  // Primary: JSON body (requires express.json())
  if (req.body?.captchaToken) return req.body.captchaToken;
  // Fallbacks if you prefer:
  if (req.headers['x-captcha-token']) return req.headers['x-captcha-token'];
  if (req.query?.captchaToken) return req.query.captchaToken;
  return null;
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
      return res.status(400).json({
        error: 'CAPTCHA verification required',
        message: 'Missing captchaToken.',
      });
    }

    const secret = process.env.HCAPTCHA_SECRET_KEY;
    // Pass client IP if available (needs app.set('trust proxy', 1) in production)
    const remoteip = req.ip;

    const result = await verify(secret, captchaToken, remoteip);

    if (!result.success) {
      // Optionally expose error codes in non-production
      return res.status(400).json({
        error: 'CAPTCHA verification failed',
        message: 'Please complete CAPTCHA correctly.',
        ...(process.env.NODE_ENV !== 'production' && {
          details: result['error-codes'],
        }),
      });
    }

    // Optional: lock verification to your domain if you use web flows
    const expectedHost = process.env.HCAPTCHA_EXPECTED_HOSTNAME;
    if (expectedHost && result.hostname && result.hostname !== expectedHost) {
      return res.status(400).json({
        error: 'CAPTCHA hostname mismatch',
        message: 'Invalid CAPTCHA host.',
      });
    }

    // You could attach result to req for telemetry
    // req.captcha = result;
    return next();
  } catch (err) {
    console.error('❌ CAPTCHA verification error:', err?.message || err);
    return res.status(502).json({
      error: 'CAPTCHA verification error',
      message: 'Unable to verify CAPTCHA. Please try again.',
    });
  }
}

// Optional wrapper: only apply CAPTCHA if enabled
async function optionalCaptcha(req, res, next) {
  if (isCaptchaEnabled()) return verifyCaptcha(req, res, next);
  return next();
}

module.exports = { verifyCaptcha, optionalCaptcha };
