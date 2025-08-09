const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// General API rate limiting (already exists in server.js but creating specific ones)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(15 * 60) // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    message: 'Too many login/registration attempts from this IP, please try again later.',
    retryAfter: Math.ceil(15 * 60)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Very strict rate limiting for registration
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 registration attempts per hour
  message: {
    error: 'Too many registration attempts',
    message: 'Too many registration attempts from this IP, please try again later.',
    retryAfter: Math.ceil(60 * 60)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Username check rate limiting (for debounced requests)
const usernameCheckLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 username checks per minute
  message: {
    error: 'Too many username checks',
    message: 'Too many username availability checks, please slow down.',
    retryAfter: Math.ceil(1 * 60)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Progressive delay for repeated requests (slow down)
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes at full speed
  delayMs: 500, // slow down subsequent requests by 500ms per request
  maxDelayMs: 20000, // maximum delay of 20 seconds
});

// Password reset rate limiting
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset attempts per hour
  message: {
    error: 'Too many password reset attempts',
    message: 'Too many password reset attempts from this IP, please try again later.',
    retryAfter: Math.ceil(60 * 60)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Email verification rate limiting
const emailVerificationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // limit each IP to 5 email verification requests per 10 minutes
  message: {
    error: 'Too many email verification attempts',
    message: 'Too many email verification attempts, please try again later.',
    retryAfter: Math.ceil(10 * 60)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  authLimiter,
  registrationLimiter,
  usernameCheckLimiter,
  speedLimiter,
  passwordResetLimiter,
  emailVerificationLimiter
};
