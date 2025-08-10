const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Redis store setup for production (optional - falls back to memory store)
let store = undefined;
try {
  if (process.env.REDIS_URL) {
    const { RedisStore } = require('rate-limit-redis');
    const { createClient } = require('redis');
    
    const redis = createClient({ url: process.env.REDIS_URL });
    redis.connect().catch(console.error);
    
    store = new RedisStore({ 
      sendCommand: (...args) => redis.sendCommand(args) 
    });
    
    console.log('📊 Rate limiting using Redis store');
  } else {
    console.log('📊 Rate limiting using memory store (Redis not configured)');
  }
} catch (err) {
  console.warn('⚠️ Redis store setup failed, using memory store:', err.message);
}

// Skip rate limiting for health checks and preflight requests
const skipHealthAndPreflight = (req) => {
  return req.method === 'OPTIONS' || req.path === '/health' || req.path.startsWith('/health');
};

// General API rate limiting with progressive delay
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes at full speed
  delayMs: () => 500, // slow down subsequent requests by 500ms per request
  maxDelayMs: 20000, // maximum delay of 20 seconds
  skip: skipHealthAndPreflight,
  store,
  validate: { delayMs: false }, // suppress delayMs warning for express-slow-down v2
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  skip: skipHealthAndPreflight,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(15 * 60)
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  store,
});

// Authentication rate limiting (combine email + IP to prevent targeted attacks)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `auth:${(req.body?.email || '').toLowerCase()}|${req.ip}`,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please try again later.',
      retryAfter: Math.ceil(15 * 60)
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  store,
});

// Registration rate limiting (combine email + IP)
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  keyGenerator: (req) => `register:${(req.body?.email || 'noemail').toLowerCase()}|${req.ip}`,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many registration attempts',
      message: 'Too many registration attempts, please try again later.',
      retryAfter: Math.ceil(60 * 60)
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  store,
});

// Username check rate limiting (key by username being checked)
const usernameCheckLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  keyGenerator: (req) => `username:${(req.params?.username || req.body?.username || '').toLowerCase()}|${req.ip}`,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many username checks',
      message: 'Too many username availability checks, please slow down.',
      retryAfter: Math.ceil(1 * 60)
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  store,
});

// Password reset rate limiting (key by email + IP)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  keyGenerator: (req) => `reset:${(req.body?.email || '').toLowerCase()}|${req.ip}`,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many password reset attempts',
      message: 'Too many password reset attempts, please try again later.',
      retryAfter: Math.ceil(60 * 60)
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  store,
});

// Email verification rate limiting (key by email + IP)
const emailVerificationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  keyGenerator: (req) => `verify:${(req.body?.email || '').toLowerCase()}|${req.ip}`,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many email verification attempts',
      message: 'Too many email verification attempts, please try again later.',
      retryAfter: Math.ceil(10 * 60)
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  store,
});

// Community features rate limiting
const communityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // allow more requests for community browsing
  keyGenerator: (req) => `community:${req.ip}`,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many community requests',
      message: 'Too many community requests, please slow down.',
      retryAfter: Math.ceil(15 * 60)
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  store,
});

module.exports = {
  generalLimiter,
  authLimiter,
  registrationLimiter,
  usernameCheckLimiter,
  speedLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  communityLimiter
};
