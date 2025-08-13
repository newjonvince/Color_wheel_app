'use strict';

/**
 * config/database.optimized.js (MySQL2, Railway-friendly)
 *
 * Key improvements versus your current version:
 * - Auto-detects Railway env vars (MYSQLHOST/MYSQLUSER/...) and DATABASE_URL.
 * - Optional TLS via DB_SSL=true or DATABASE_URL?ssl=true (uses secure defaults).
 * - Uses mysql2's native named placeholders (no manual :param replacement).
 * - Adds acquireTimeout, multipleStatements=false, big number safety.
 * - Graceful shutdown hook to close the pool on SIGTERM/HMR.
 * - Small helpers: healthCheck(), withConnection().
 * - Keeps the same { rows } return shape for compatibility.
 */

const mysql = require('mysql2/promise');
const { URL } = require('url');

/** Helpers **/
const bool = (v, def = false) => {
  if (v === undefined || v === null || v === '') return def;
  const s = String(v).toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(s);
};

/**
 * Parse a MySQL connection string like:
 *   mysql://user:pass@host:3306/dbname?ssl=true
 */
function parseMysqlUrl(urlString) {
  const u = new URL(urlString);
  const sslParam = u.searchParams.get('ssl') || u.searchParams.get('sslmode');
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    database: (u.pathname || '').replace(/^\//, ''),
    ssl: sslParam && ['true', 'require', 'on'].includes(sslParam.toLowerCase()),
  };
}

/**
 * Resolve config from common envs:
 * - Railway default MYSQL* envs
 * - Fallback DB_* envs (your current usage)
 * - DATABASE_URL (mysql://...)
 */
function resolveConfigFromEnv(env) {
  let cfg = null;

  // 1) DATABASE_URL takes precedence if provided
  if (env.DATABASE_URL && env.DATABASE_URL.startsWith('mysql://')) {
    const u = parseMysqlUrl(env.DATABASE_URL);
    cfg = {
      host: u.host,
      port: u.port,
      user: u.user,
      password: u.password,
      database: u.database,
      ssl: u.ssl,
    };
  }

  // 2) Railway defaults
  if (!cfg && env.MYSQLHOST) {
    cfg = {
      host: env.MYSQLHOST,
      port: Number(env.MYSQLPORT || 3306),
      user: env.MYSQLUSER,
      password: env.MYSQLPASSWORD,
      database: env.MYSQLDATABASE,
      // Let DB_SSL override (Railway typically allows non-SSL inside its network,
      // but enable if you egress from elsewhere or want TLS in transit).
      ssl: bool(env.DB_SSL, false),
    };
  }

  // 3) Your original DB_* names
  if (!cfg && env.DB_HOST) {
    cfg = {
      host: env.DB_HOST,
      port: Number(env.DB_PORT || 3306),
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      ssl: bool(env.DB_SSL, false),
    };
  }

  // 4) Last-resort defaults
  if (!cfg) {
    cfg = {
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'app',
      ssl: false,
    };
  }

  // Normalize SSL config for mysql2
  const ssl =
    cfg.ssl
      ? { rejectUnauthorized: bool(env.DB_SSL_REJECT_UNAUTHORIZED, true), minVersion: 'TLSv1.2' }
      : undefined;

  return {
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,

    // Pool tuning
    waitForConnections: true,
    connectionLimit: Number(env.DB_CONN_LIMIT || env.MYSQL_CONNECTION_LIMIT || 10),
    maxIdle: 10,
    idleTimeout: 60_000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,

    // Timeouts
    connectTimeout: 10_000,
    acquireTimeout: 10_000,

    // Safety / QoL
    namedPlaceholders: true,  // native named placeholders
    multipleStatements: false, // explicit hardening
    dateStrings: true,         // avoid TZ conversion surprises
    decimalNumbers: true,      // parse DECIMAL as numbers
    supportBigNumbers: true,   // handle BIGINT/DECIMAL safely
    bigNumberStrings: true,    // avoid precision loss for > JS safe int

    // TLS (optional)
    ssl,
  };
}

const poolConfig = resolveConfigFromEnv(process.env);
const pool = mysql.createPool(poolConfig);

/** Basic query helper. Accepts either positional array or named object. */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return { rows };
}

/** Timed query helper for slow-query logging. */
const SLOW_MS = Number(process.env.DB_LOG_SLOW_MS || 0);
async function timedQuery(sql, params = []) {
  const t0 = Date.now();
  const result = await query(sql, params);
  const ms = Date.now() - t0;
  if (SLOW_MS && ms >= SLOW_MS) {
    const preview = Array.isArray(params) ? { positionalCount: params.length } : { keys: Object.keys(params || {}) };
    console.warn(`🐌 Slow query (${ms}ms)`, { sql, paramsPreview: preview });
  }
  return result;
}

/** Get a dedicated connection without a transaction (handy for batches). */
async function withConnection(fn) {
  const conn = await pool.getConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
}

/** Transaction helper. */
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

/** Optional per-connection init (uncomment to enforce UTC). */
pool.on('connection', async (conn) => {
  try {
    // await conn.query("SET time_zone = '+00:00'");
  } catch (e) {
    console.warn('DB connection init error:', e?.message || e);
  }
});

/** Basic health check for readiness probes. */
async function healthCheck() {
  try {
    await query('SELECT 1 as ok');
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize database tables (id columns use CHAR(36) UUID).
 * Note: MySQL 8.0+ supports DEFAULT (UUID()); if your instance is older,
 * you can set the UUID in application code instead.
 */
async function initializeTables() {
  try {
    console.log('🔧 Initializing database tables...');
    await query('SELECT 1 as test');
    console.log('✅ Database connection verified');

    // Complete users table schema with all required columns
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        location VARCHAR(100),
        birthday_month INT,
        birthday_day INT,
        birthday_year INT,
        gender VARCHAR(20),
        email_verified BOOLEAN DEFAULT FALSE,
        notifications BOOLEAN DEFAULT TRUE,
        share_usage BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_username (username),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS follows (
        id CHAR(36) PRIMARY KEY,
        follower_id CHAR(36) NOT NULL,
        following_id CHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_follow (follower_id, following_id)
      ) ENGINE=InnoDB
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS color_matches (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
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
      ) ENGINE=InnoDB
    `);

    // Boards table for organizing color collections
    await query(`
      CREATE TABLE IF NOT EXISTS boards (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        name VARCHAR(100) NOT NULL,
        type ENUM('private', 'public') DEFAULT 'private',
        scheme VARCHAR(50),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_type (user_id, type),
        INDEX idx_scheme (scheme)
      ) ENGINE=InnoDB
    `);

    // Board items linking color matches to boards
    await query(`
      CREATE TABLE IF NOT EXISTS board_items (
        id CHAR(36) PRIMARY KEY,
        board_id CHAR(36) NOT NULL,
        color_match_id CHAR(36) NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
        FOREIGN KEY (color_match_id) REFERENCES color_matches(id) ON DELETE CASCADE,
        UNIQUE KEY unique_board_item (board_id, color_match_id),
        INDEX idx_board_added (board_id, added_at)
      ) ENGINE=InnoDB
    `);

    // User sessions for JWT token management
    await query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        jti CHAR(36) UNIQUE NOT NULL,
        session_token VARCHAR(255),
        expires_at TIMESTAMP NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        revoked_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_expires (user_id, expires_at),
        INDEX idx_jti (jti),
        INDEX idx_expires (expires_at)
      ) ENGINE=InnoDB
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Database table initialization error:', error.message);
    console.error('❌ Stack:', error.stack);
    if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('❌ Database connection failed - check Railway MySQL service and environment variables');
    }
    // Non-fatal: allow the app to continue serving if initialization fails
  }
}

/** Graceful shutdown (Railway will send SIGTERM on redeploy/scale-down). */
let _exitHookInstalled = false;
function installExitHookOnce() {
  if (_exitHookInstalled) return;
  _exitHookInstalled = true;
  const shutdown = async (signal) => {
    try {
      await pool.end();
      // eslint-disable-next-line no-console
      console.log(`[db] pool closed on ${signal}`);
    } catch (e) {
      console.warn('[db] error closing pool:', e?.message || e);
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
installExitHookOnce();

module.exports = {
  pool,
  query,
  timedQuery,
  withConnection,
  inTransaction,
  initializeTables,
  healthCheck,
};