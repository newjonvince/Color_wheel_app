// config/database.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  // recommended pool opts
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // connection timeout in ms
  connectTimeout: 10000,
  // Optional on pool (NOT on single connection):
  acquireTimeout: 10000,
});

async function query(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return { rows }; // keep .rows for caller compatibility
}

module.exports = { pool, query };
