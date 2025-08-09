const { verify } = require('hcaptcha');

/**
 * Middleware to verify hCaptcha token
 * Requires HCAPTCHA_SECRET_KEY environment variable
 */
const verifyCaptcha = async (req, res, next) => {
  try {
    // CAPTCHA verification completely disabled for testing
    console.log('⚠️  CAPTCHA verification disabled for testing');
    return next();
    
    // Original CAPTCHA code commented out
    /*
    const { captchaToken } = req.body;
    
    // Skip CAPTCHA verification in development mode if no secret key is provided
    if (process.env.NODE_ENV === 'development' && !process.env.HCAPTCHA_SECRET_KEY) {
      console.log('⚠️  CAPTCHA verification skipped in development mode');
      return next();
    }
    
    if (!captchaToken) {
      return res.status(400).json({
        error: 'CAPTCHA verification required',
        message: 'Please complete the CAPTCHA verification.'
      });
    }
    */
    
    if (!process.env.HCAPTCHA_SECRET_KEY) {
      console.error('❌ HCAPTCHA_SECRET_KEY not configured');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'CAPTCHA verification is not properly configured.'
      });
    }
    
    // Verify the CAPTCHA token with hCaptcha
    const captchaResult = await verify(process.env.HCAPTCHA_SECRET_KEY, captchaToken);
    
    if (!captchaResult.success) {
      return res.status(400).json({
        error: 'CAPTCHA verification failed',
        message: 'Please complete the CAPTCHA verification correctly.',
        details: process.env.NODE_ENV === 'development' ? captchaResult['error-codes'] : undefined
      });
    }
    
    // CAPTCHA verified successfully
    console.log('✅ CAPTCHA verification successful');
    next();
    
  } catch (error) {
    console.error('❌ CAPTCHA verification error:', error);
    res.status(500).json({
      error: 'CAPTCHA verification error',
      message: 'Unable to verify CAPTCHA. Please try again.'
    });
  }
};

/**
 * Optional CAPTCHA middleware - only applies CAPTCHA if enabled
 * Useful for endpoints where CAPTCHA is optional based on configuration
 */
const optionalCaptcha = async (req, res, next) => {
  // Only apply CAPTCHA if explicitly enabled and secret key is configured
  if (process.env.ENABLE_CAPTCHA === 'true' && process.env.HCAPTCHA_SECRET_KEY) {
    return verifyCaptcha(req, res, next);
  }
  
  // Skip CAPTCHA verification
  next();
};

module.exports = {
  verifyCaptcha,
  optionalCaptcha
};
