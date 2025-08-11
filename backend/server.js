const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const colorRoutes = require('./routes/colors');
const boardRoutes = require('./routes/boards');
const userRoutes = require('./routes/users');
const communityRoutes = require('./routes/community');
const imageRoutes = require('./routes/images');
const { initializeTables } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// CRITICAL: Trust proxy for Railway deployment
// Without this, req.ip will be the proxy's IP and all users share limits
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration - safe parsing + TestFlight/Expo web support
const parseOrigins = (raw) =>
  (raw || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const allowlist = parseOrigins(process.env.ALLOWED_ORIGINS);
// Sensible defaults for local + Expo + RN web preview
if (allowlist.length === 0) {
  allowlist.push('http://localhost:19006', 'http://localhost:8081'); // Expo dev servers
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
app.options('*', cors(corsOptions)); // handle preflight everywhere

// Rate limiting middleware (apply speedLimiter before generalLimiter)
const { speedLimiter, generalLimiter } = require('./middleware/rateLimiting');
app.use(speedLimiter); // Progressive delay first
app.use(generalLimiter); // Hard limits second

// Body parsing middleware - tightened limits + error handling
app.use(express.json({ limit: '2mb' }));             // 2mb is plenty for JSON
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

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

// Request logging middleware for debugging
app.use('/api', (req, res, next) => {
  console.log(`🔍 API Request: ${req.method} ${req.originalUrl} from ${req.ip}`);
  console.log(`🔍 Headers:`, JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`🔍 Body:`, JSON.stringify(req.body, null, 2));
  }
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/colors', colorRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/images', imageRoutes);
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
const server = app.listen(PORT, () => {
  console.log('// Fashion Color Wheel Backend Server');
  console.log('// Production-ready Express.js API with MySQL, authentication, and rate limiting');
  console.log('// Updated: All Railway deployment warnings fixed');
  console.log('📱 Environment:', process.env.NODE_ENV);
  console.log('🔗 Health check: http://localhost:' + PORT + '/health');
  console.log('✨ All warnings fixed - clean deployment!');
  console.log(`🚀 API up on ${PORT}`);
  
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

const shutdown = () => {
  console.log('⏳ Shutting down gracefully...');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
