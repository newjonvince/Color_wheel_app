// Test script to verify backend connection
const db = require('./config/database');

async function testConnection() {
  console.log('🔍 Testing Fashion Color Wheel Backend Connection...\n');
  
  try {
    // Test database connection
    console.log('1. Testing MySQL database connection...');
    const result = await db.query('SELECT 1 as test');
    console.log('✅ Database connection successful!');
    
    // Test if database exists
    console.log('\n2. Checking if fashion_color_wheel database exists...');
    const dbCheck = await db.query('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?', ['fashion_color_wheel']);
    
    if (dbCheck.length > 0) {
      console.log('✅ fashion_color_wheel database found!');
      
      // Test if tables exist
      console.log('\n3. Checking database tables...');
      const tables = await db.query('SHOW TABLES FROM fashion_color_wheel');
      
      if (tables.length > 0) {
        console.log('✅ Database tables found:');
        tables.forEach(table => {
          const tableName = Object.values(table)[0];
          console.log(`   - ${tableName}`);
        });
      } else {
        console.log('⚠️  No tables found. You need to run the schema.sql file.');
      }
    } else {
      console.log('❌ fashion_color_wheel database not found!');
      console.log('   Please create the database in phpMyAdmin first.');
    }
    
    console.log('\n🎉 Backend connection test completed!');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('   1. Make sure MySQL server is running');
    console.log('   2. Check your .env file credentials');
    console.log('   3. Verify database name and permissions');
  } finally {
    process.exit(0);
  }
}

testConnection();
