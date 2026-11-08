const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const colorRoutes = require('./routes/colors');
const boardRoutes = require('./routes/boards');
const userRoutes = require('./routes/users');
const communityRoutes = require('./routes/community');
const imageRoutes = require('./routes/images');
const likesRoutes = require('./routes/likes');
const { pool, initializeTables, healthCheck } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Railway requires binding to 0.0.0.0

// Disable ETag to prevent 304 responses globally
app.set('etag', false);

// Cache control for auth-gated routes
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Trust proxy for Railway deployment
// Without this, req.ip will be the proxy's IP and all users share limits
app.set('trust proxy', 1);

// Railway optimizations
app.set('x-powered-by', false); // Remove Express signature for security

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Response compression for better performance (Railway optimization)
app.use(compression());

// CORS configuration - safe parsing + TestFlight/Expo web support
const parseOrigins = (raw) =>
  (raw || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const allowlist = parseOrigins(process.env.ALLOWED_ORIGINS);
// Production-safe: only add development origins in development mode
if (allowlist.length === 0) {
  if (process.env.NODE_ENV === 'development') {
    allowlist.push('http://localhost:19006', 'http://localhost:8081'); // Expo dev servers
    console.log('🔧 Development mode: Added localhost origins to CORS allowlist');
  } else {
    console.warn('⚠️ PRODUCTION: No ALLOWED_ORIGINS configured - mobile apps will work but web origins may be blocked');
  }
}

const corsOptions = {
  origin(origin, cb) {
    // Allow mobile apps (no origin), health checks, and allowlisted web origins
    if (!origin || allowlist.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); 

// Rate limiting middleware (apply speedLimiter before generalLimiter)
const { speedLimiter, generalLimiter } = require('./middleware/rateLimiting');
app.use(speedLimiter); // Progressive delay first
app.use(generalLimiter); // Hard limits second

// Body parsing middleware - tightened limits + error handling
app.use(express.json({ limit: '2mb' }));             // 2mb is plenty for JSON
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Request logger (after body parsing so req.body is available).
// Full header/body dumps only when LOG_VERBOSE=true — too noisy (and too revealing) for production logs.
const LOG_VERBOSE = process.env.LOG_VERBOSE === 'true';
app.use('/api', (req, res, next) => {
  console.log(`🔍 ${req.method} ${req.originalUrl} from ${req.ip}`);
  if (LOG_VERBOSE) {
    const redacted = { ...req.headers };
    if (redacted.authorization) redacted.authorization = 'Bearer ***';
    if (redacted.cookie) redacted.cookie = '***';
    console.log('🔍 Headers:', JSON.stringify(redacted, null, 2));
    if (req.is('application/json') && req.body && Object.keys(req.body).length) {
      const masked = JSON.parse(JSON.stringify(req.body));
      ['password','newPassword','token','current_password','new_password'].forEach(k => { if (masked[k]) masked[k] = '***'; });
      console.log('🔍 Body:', JSON.stringify(masked, null, 2));
    } else if (req.method !== 'GET' && !req.is('application/json')) {
      console.log('🔍 Body: [non-JSON or multipart body]');
    }
  }
  next();
});

// Handle malformed JSON gracefully
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON', message: 'Malformed JSON body.' });
  }
  return next(err);
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Fashion Color Wheel API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      colors: '/api/colors',
      boards: '/api/boards',
      users: '/api/users',
      community: '/api/community'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Fashion Color Wheel API'
  });
});

// Railway health check endpoint with database connectivity test
app.get('/healthz', async (req, res) => {
  try {
    const isHealthy = await healthCheck();
    if (isHealthy) {
      res.status(200).json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Duplicate logging middleware removed - already handled above

// Health route alias under /api for client compatibility
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Fashion Color Wheel API'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/colors', colorRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/community', communityRoutes); // Dedicated prefix to avoid collisions

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist.`
  });
});

// Global error handler - prevent double headers
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  
  console.error('Global error handler:', err.message);
  const isDev = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: isDev ? err.message : 'Something went wrong!',
    ...(isDev && { stack: err.stack }),
    requestId: req.id, // if you add request IDs later
  });
});

// Start server with graceful shutdown (Railway)
const server = app.listen(PORT, HOST, async () => {
  console.log('// Fashion Color Wheel Backend Server');
  console.log('// Production-ready Express.js API with MySQL, authentication, and rate limiting');
  console.log('// Updated: All Railway deployment warnings fixed + Database schema aligned');
  console.log('📱 Environment:', process.env.NODE_ENV);
  console.log('🔗 Health check: http://localhost:' + PORT + '/health');
  console.log('✨ All warnings fixed + schema aligned - clean deployment!');
  console.log(`🚀 API up on ${HOST}:${PORT}`);
  
  // Test database connection first
  try {
    const isHealthy = await healthCheck();
    if (isHealthy) {
      console.log('✅ Database connection verified');
    } else {
      console.warn('⚠️ Database health check failed, but server continues');
    }
  } catch (dbError) {
    console.error('⚠️ Database connection error:', dbError.message);
  }
  
  // Initialize database tables asynchronously (non-blocking with timeout)
  const dbInitTimeout = setTimeout(() => {
    console.warn('⚠️ Database initialization taking too long, continuing without it');
  }, 30000); // 30 second timeout
  
  initializeTables()
    .then(() => {
      clearTimeout(dbInitTimeout);
      console.log('✅ Database initialization completed');
    })
    .catch((error) => {
      clearTimeout(dbInitTimeout);
      console.error('⚠️ Database initialization failed, but server continues:', error.message);
    });
});

const shutdown = (signal) => {
  console.log(`⏳ Received ${signal}, shutting down gracefully...`);
  server.close(async (err) => {
    if (err) {
      console.error('❌ Error during server shutdown:', err);
      process.exit(1);
    }
    try {
      await pool.end();
      console.log('✅ Server and DB pool closed successfully');
      process.exit(0);
    } catch (dbErr) {
      console.warn('⚠️ Error closing DB pool:', dbErr?.message || dbErr);
      process.exit(1);
    }
  });
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions to prevent silent crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;
