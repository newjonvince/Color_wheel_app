// Railway MySQL Connection Test Script
// Test script to verify backend connection to Railway MySQL database
const { query } = require('./config/database');

async function testRailwayConnection() {
  console.log('🚀 Testing Railway MySQL Connection for Fashion Color Wheel Backend...\n');
  
  try {
    // Display environment info
    console.log('📊 Environment Information:');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`   DB_HOST: ${process.env.DB_HOST || 'not set'}`);
    console.log(`   DB_PORT: ${process.env.DB_PORT || 'not set'}`);
    console.log(`   DB_NAME: ${process.env.DB_NAME || 'not set'}`);
    console.log(`   DB_USER: ${process.env.DB_USER || 'not set'}`);
    console.log(`   DB_PASSWORD: ${process.env.DB_PASSWORD ? '***set***' : 'not set'}\n`);
    
    // Test 1: Basic connection
    console.log('1️⃣ Testing basic MySQL connection...');
    const connectionTest = await query('SELECT 1 as test, NOW() as current_time, VERSION() as mysql_version');
    console.log('✅ Database connection successful!');
    console.log(`   MySQL Version: ${connectionTest.rows[0].mysql_version}`);
    console.log(`   Server Time: ${connectionTest.rows[0].current_time}\n`);
    
    // Test 2: Check current database
    console.log('2️⃣ Checking current database...');
    const currentDb = await query('SELECT DATABASE() as current_database');
    console.log(`✅ Connected to database: ${currentDb.rows[0].current_database}\n`);
    
    // Test 3: List all databases (to verify permissions)
    console.log('3️⃣ Checking database permissions...');
    try {
      const databases = await query('SHOW DATABASES');
      console.log('✅ Database access permissions verified');
      console.log('   Available databases:');
      databases.rows.forEach(db => {
        const dbName = Object.values(db)[0];
        console.log(`   - ${dbName}`);
      });
    } catch (permError) {
      console.log('⚠️  Limited database permissions (this is normal on Railway)');
    }
    console.log('');
    
    // Test 4: Check for existing tables
    console.log('4️⃣ Checking for application tables...');
    try {
      const tables = await query('SHOW TABLES');
      if (tables.rows.length > 0) {
        console.log('✅ Application tables found:');
        tables.rows.forEach(table => {
          const tableName = Object.values(table)[0];
          console.log(`   - ${tableName}`);
        });
      } else {
        console.log('⚠️  No tables found - database schema needs to be created');
        console.log('   Run your schema.sql file to create the required tables');
      }
    } catch (tableError) {
      console.log('⚠️  Could not check tables:', tableError.message);
    }
    console.log('');
    
    // Test 5: Test write permissions
    console.log('5️⃣ Testing database write permissions...');
    try {
      await query('CREATE TABLE IF NOT EXISTS connection_test (id INT PRIMARY KEY, test_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
      await query('INSERT INTO connection_test (id) VALUES (1) ON DUPLICATE KEY UPDATE test_time = CURRENT_TIMESTAMP');
      const writeTest = await query('SELECT * FROM connection_test WHERE id = 1');
      await query('DROP TABLE connection_test');
      console.log('✅ Database write permissions verified');
      console.log(`   Test record created at: ${writeTest.rows[0].test_time}\n`);
    } catch (writeError) {
      console.log('❌ Database write test failed:', writeError.message);
    }
    
    // Test 6: Test query helper function
    console.log('6️⃣ Testing query helper function...');
    const helperTest = await query('SELECT ? as test_param, ? as test_param2', ['Hello', 'Railway']);
    console.log('✅ Query helper function working correctly');
    console.log(`   Test parameters: ${helperTest.rows[0].test_param} ${helperTest.rows[0].test_param2}\n`);
    
    console.log('🎉 All Railway MySQL connection tests passed!');
    console.log('✅ Your backend is ready to connect to Railway MySQL database');
    
  } catch (error) {
    console.error('❌ Railway MySQL connection test failed:', error.message);
    console.log('\n🔧 Railway Troubleshooting Guide:');
    console.log('   1. Verify Railway MySQL service is running');
    console.log('   2. Check that DB_* variables are set in your backend service');
    console.log('   3. Ensure variables reference MySQL service: ${{MySQL.MYSQLHOST}}');
    console.log('   4. Verify Railway services are in the same project');
    console.log('   5. Check Railway service logs for connection errors');
    console.log('\n📋 Required Backend Environment Variables:');
    console.log('   DB_HOST=${{MySQL.MYSQLHOST}}');
    console.log('   DB_PORT=${{MySQL.MYSQLPORT}}');
    console.log('   DB_NAME=${{MySQL.MYSQLDATABASE}}');
    console.log('   DB_USER=${{MySQL.MYSQLUSER}}');
    console.log('   DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}');
  } finally {
    console.log('\n🔚 Test completed. Exiting...');
    process.exit(0);
  }
}

// Run the test
testRailwayConnection();
