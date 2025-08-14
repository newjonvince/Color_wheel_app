// rateLimiting.js — tuned to avoid false OOPS during uploads
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
    store = new RedisStore({ sendCommand: (...args) => redis.sendCommand(args) });
    console.log('📊 Rate limiting using Redis store');
  } else {
    console.log('📊 Rate limiting using memory store (Redis not configured)');
  }
} catch (err) {
  console.warn('⚠️ Redis store setup failed, using memory store:', err.message);
}

// Helpers
const isMultipart = (req) => (req.headers['content-type'] || '').includes('multipart/form-data');
const skipHealthAndPreflight = (req) => {
  return req.method === 'OPTIONS' || 
         req.path === '/health' || 
         req.path === '/healthz' ||
         req.path === '/api/health' ||
         req.path.startsWith('/health') ||
         (req.path === '/api/colors/validate' && req.method === 'GET'); // Health check endpoint
};

// Progressive delay — but skip for multipart uploads to prevent client timeouts on iOS
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: () => 300,
  maxDelayMs: 5000,
  skip: (req) => skipHealthAndPreflight(req) || isMultipart(req),
  store,
  validate: { delayMs: false },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  skip: (req) => skipHealthAndPreflight(req) || (process.env.NODE_ENV === 'development' && req.user),
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests', message: 'Too many requests from this IP, please try again later.', retryAfter: Math.ceil(15 * 60) });
  },
  standardHeaders: true,
  legacyHeaders: false,
  store,
});

// Focused limiters unchanged
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `auth:${(req.body?.email || '').toLowerCase()}|${req.ip}`,
  handler: (req, res) => res.status(429).json({ error: 'Too many authentication attempts', message: 'Please try again later.', retryAfter: Math.ceil(15 * 60) }),
  standardHeaders: true, legacyHeaders: false, store,
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => `register:${(req.body?.email || 'noemail').toLowerCase()}|${req.ip}`,
  handler: (req, res) => res.status(429).json({ error: 'Too many registration attempts', message: 'Too many registration attempts, please try again later.', retryAfter: Math.ceil(60 * 60) }),
  standardHeaders: true, legacyHeaders: false, store,
});

const usernameCheckLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, max: 30,
  keyGenerator: (req) => `username:${(req.params?.username || req.body?.username || '').toLowerCase()}|${req.ip}`,
  handler: (req, res) => res.status(429).json({ error: 'Too many username checks', message: 'Too many username availability checks, please slow down.', retryAfter: Math.ceil(60) }),
  standardHeaders: true, legacyHeaders: false, store,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 3,
  keyGenerator: (req) => `reset:${(req.body?.email || '').toLowerCase()}|${req.ip}`,
  handler: (req, res) => res.status(429).json({ error: 'Too many password reset attempts', message: 'Too many password reset attempts, please try again later.', retryAfter: Math.ceil(60 * 60) }),
  standardHeaders: true, legacyHeaders: false, store,
});

const emailVerificationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 5,
  keyGenerator: (req) => `verify:${(req.body?.email || '').toLowerCase()}|${req.ip}`,
  handler: (req, res) => res.status(429).json({ error: 'Too many email verification attempts', message: 'Too many email verification attempts, please try again later.', retryAfter: Math.ceil(10 * 60) }),
  standardHeaders: true, legacyHeaders: false, store,
});

const communityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  keyGenerator: (req) => `community:${req.ip}`,
  handler: (req, res) => res.status(429).json({ error: 'Too many community requests', message: 'Too many community requests, please slow down.', retryAfter: Math.ceil(15 * 60) }),
  standardHeaders: true, legacyHeaders: false, store,
});

module.exports = { generalLimiter, authLimiter, registrationLimiter, usernameCheckLimiter, speedLimiter, passwordResetLimiter, emailVerificationLimiter, communityLimiter };
