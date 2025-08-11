'use strict';

/**
 * config/database.js (MySQL2)
 * Pooled MySQL connection for Railway (or any MySQL host).
 * - Uses mysql2/promise
 * - Named placeholders (:id, :limit) for readability
 * - Returns { rows } to match prior Postgres-style callers
 * - Includes helpers for transactions and optional slow-query logging
 */

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // Pool tuning
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
  maxIdle: 10,
  idleTimeout: 60_000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,

  // Timeouts (ms)
  connectTimeout: 10_000,

  // Quality-of-life
  namedPlaceholders: true, // allows :id, :limit, etc.
  dateStrings: true,       // avoid TZ conversion surprises for DATETIME/TIMESTAMP
  decimalNumbers: true,    // parse DECIMAL as numbers

  // If your provider requires TLS, uncomment:
  // ssl: { rejectUnauthorized: true },
});

/**
 * Basic query helper.
 * Keeps the { rows } response to be compatible with prior callers.
 */
async function query(sql, params) {
  // Hybrid compatibility: handle both positional (?) and named (:param) placeholders
  let finalSql = sql;
  let finalParams = params;
  
  // If params is an array, it's positional placeholders (?)
  if (Array.isArray(params)) {
    // Keep as-is for positional placeholders
    finalParams = params;
  } 
  // If params is an object, it's named placeholders (:param)
  else if (params && typeof params === 'object') {
    // Convert named placeholders to positional for mysql2
    const paramNames = [];
    const paramValues = [];
    
    // Replace :param with ? and collect values in order
    finalSql = sql.replace(/:(\w+)/g, (match, paramName) => {
      paramNames.push(paramName);
      paramValues.push(params[paramName]);
      return '?';
    });
    
    finalParams = paramValues;
  }
  // If no params provided, use empty array
  else {
    finalParams = [];
  }
  
  const [rows] = await pool.execute(finalSql, finalParams);
  return { rows }; // keep .rows for caller compatibility
}

/**
 * Same as query, but logs queries that exceed SLOW_MS.
 * Enable by setting DB_LOG_SLOW_MS (defaults to 0 = disabled).
 */
const SLOW_MS = Number(process.env.DB_LOG_SLOW_MS || 0);
async function timedQuery(sql, params = {}) {
  const t0 = Date.now();
  const result = await query(sql, params);
  const ms = Date.now() - t0;
  if (SLOW_MS && ms >= SLOW_MS) {
    // Note: Be careful not to log sensitive values in production
    console.warn(`🐌 Slow query (${ms}ms)`, { sql, paramsPreview: Object.keys(params) });
  }
  return result;
}

/**
 * Transaction helper.
 * Usage:
 *   const result = await inTransaction(async (conn) => {
 *     const [r1] = await conn.execute('UPDATE ...', {...});
 *     const [r2] = await conn.execute('INSERT ...', {...});
 *     return { ok: true };
 *   });
 */
async function inTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch {}
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Optional: run an initialization step on each new connection
 * (e.g., enforce UTC at connection level).
 */
pool.on('connection', async (conn) => {
  try {
    // Uncomment if you want to force UTC at the session level:
    // await conn.query("SET time_zone = '+00:00'");
  } catch (e) {
    // Non-fatal; just log
    console.warn('DB connection init error:', e?.message || e);
  }
});

/**
 * Initialize database tables - creates missing tables automatically
 */
async function initializeTables() {
  try {
    console.log('🔧 Initializing database tables...');
    
    // Test database connection first
    await query('SELECT 1 as test');
    console.log('✅ Database connection verified');
    
    // Create follows table for community features
    await query(`
      CREATE TABLE IF NOT EXISTS follows (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        follower_id VARCHAR(36) NOT NULL,
        following_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_follow (follower_id, following_id)
      )
    `);

    // Create color_matches table for saving palettes
    await query(`
      CREATE TABLE IF NOT EXISTS color_matches (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id VARCHAR(36) NOT NULL,
        base_color VARCHAR(7) NOT NULL,
        scheme VARCHAR(50) NOT NULL,
        colors JSON NOT NULL,
        title VARCHAR(255),
        description TEXT,
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_created (user_id, created_at),
        INDEX idx_public_created (is_public, created_at)
      )
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Database table initialization error:', error.message);
    console.error('❌ Stack:', error.stack);
    
    // Check if it's a connection issue
    if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('❌ Database connection failed - check Railway MySQL service and environment variables');
    }
    
    // Don't throw - let the app continue even if table creation fails
    // The app should still serve API requests even without the follows table
  }
}

module.exports = {
  pool,
  query,
  timedQuery,
  inTransaction,
  initializeTables,
};
