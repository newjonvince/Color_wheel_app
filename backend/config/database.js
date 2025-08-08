const mysql = require('mysql2/promise');
require('dotenv').config();

// MySQL connection configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionLimit: 20, // Maximum number of connections in the pool
  acquireTimeout: 60000, // Maximum time to get connection from pool
  timeout: 60000, // Maximum time for a query
  reconnect: true,
  charset: 'utf8mb4'
});

// Test database connection
pool.on('connection', (connection) => {
  console.log('✅ Connected to MySQL database as id ' + connection.threadId);
});

pool.on('error', (err) => {
  console.error('❌ MySQL connection error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('🔄 Reconnecting to MySQL database...');
  } else {
    throw err;
  }
});

// Helper function to execute queries
const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const [rows, fields] = await pool.execute(text, params);
    const duration = Date.now() - start;
    console.log('📊 Executed query', { text, duration, rowCount: Array.isArray(rows) ? rows.length : 1 });
    return { rows, fields };
  } catch (error) {
    console.error('❌ Database query error:', error);
    throw error;
  }
};

// Helper function to get a connection from the pool
const getConnection = async () => {
  return await pool.getConnection();
};

// Test connection on startup
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL database connection test successful');
    connection.release();
  } catch (error) {
    console.error('❌ MySQL database connection test failed:', error);
  }
};

// Test connection immediately
testConnection();

module.exports = {
  query,
  getConnection,
  pool
};
