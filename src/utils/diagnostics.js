// diagnostics.js - Diagnostic tools for troubleshooting initialization issues
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Network connectivity test
export const testNetworkConnectivity = async () => {
  console.log('🌐 Testing network connectivity...');
  
  // Try multiple endpoints for better reliability
  const testEndpoints = [
    'https://httpbin.org/json',
    'https://jsonplaceholder.typicode.com/posts/1',
    'https://api.github.com/zen'
  ];
  
  for (const endpoint of testEndpoints) {
    try {
      console.log(`🌐 Testing endpoint: ${endpoint}`);
      
      // Increase timeout to 10 seconds for slower networks
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Network test timeout for ${endpoint}`);
        controller.abort();
      }, 10000);
      
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FashionColorWheel/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`✅ Network connectivity: OK (${endpoint})`);
        return { success: true, message: `Network connectivity working via ${endpoint}` };
      } else {
        console.log(`❌ Network test failed for ${endpoint}: HTTP ${response.status}`);
        // Continue to next endpoint
      }
    } catch (error) {
      console.log(`❌ Network test failed for ${endpoint}:`, error.message);
      // Continue to next endpoint
    }
  }
  
  // If all endpoints failed
  console.log('❌ All network connectivity tests failed');
  return { success: false, message: 'All network endpoints unreachable' };
};

// Storage system test
export const testStorageSystem = async () => {
  console.log('💾 Testing storage system...');
  
  try {
    // Test AsyncStorage
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    
    const testKey = '__diagnostic_test__';
    const testValue = JSON.stringify({ timestamp: Date.now(), test: true });
    
    // Test write
    await AsyncStorage.setItem(testKey, testValue);
    console.log('✅ Storage write: OK');
    
    // Test read
    const retrieved = await AsyncStorage.getItem(testKey);
    if (retrieved === testValue) {
      console.log('✅ Storage read: OK');
    } else {
      console.log('❌ Storage read: Value mismatch');
      return { success: false, message: 'Storage read/write mismatch' };
    }
    
    // Test delete
    await AsyncStorage.removeItem(testKey);
    console.log('✅ Storage delete: OK');
    
    return { success: true, message: 'Storage system working' };
  } catch (error) {
    console.log('❌ Storage system: Failed', error.message);
    return { success: false, message: error.message };
  }
};

// Environment configuration test
export const testEnvironmentConfig = () => {
  console.log('⚙️ Testing environment configuration...');
  
  try {
    const extra = Constants.expoConfig?.extra || {};
    
    console.log('📋 Environment variables:', {
      API_BASE_URL: extra.EXPO_PUBLIC_API_BASE_URL,
      ENVIRONMENT: extra.EXPO_PUBLIC_ENVIRONMENT,
      DEBUG_MODE: extra.EXPO_PUBLIC_DEBUG_MODE,
      LOG_LEVEL: extra.EXPO_PUBLIC_LOG_LEVEL
    });
    
    if (!extra.EXPO_PUBLIC_API_BASE_URL) {
      console.log('⚠️ Missing API_BASE_URL');
      return { success: false, message: 'Missing API_BASE_URL configuration' };
    }
    
    console.log('✅ Environment config: OK');
    return { success: true, message: 'Environment configuration valid' };
  } catch (error) {
    console.log('❌ Environment config: Failed', error.message);
    return { success: false, message: error.message };
  }
};

// API service test
export const testApiService = async () => {
  console.log('🔌 Testing API service...');
  
  try {
    const extra = Constants.expoConfig?.extra || {};
    const apiBaseUrl = extra.EXPO_PUBLIC_API_BASE_URL;
    
    if (!apiBaseUrl) {
      return { success: false, message: 'No API base URL configured' };
    }
    
    console.log('🔍 Testing API endpoint:', apiBaseUrl);
    
    // Try multiple API endpoints for Railway app
    const testEndpoints = [
      `${apiBaseUrl}/health`,
      `${apiBaseUrl}/api/health`, 
      `${apiBaseUrl}/`,
      `${apiBaseUrl}/api/status`
    ];
    
    for (const endpoint of testEndpoints) {
      try {
        console.log(`🔌 Testing API endpoint: ${endpoint}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log(`⏰ API test timeout for ${endpoint}`);
          controller.abort();
        }, 15000); // Longer timeout for Railway cold starts
        
        const response = await fetch(endpoint, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'FashionColorWheel/1.0'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log(`✅ API service: OK (${endpoint})`);
          return { success: true, message: `API service responding via ${endpoint}` };
        } else {
          console.log(`❌ API test failed for ${endpoint}: HTTP ${response.status}`);
          // Continue to next endpoint
        }
      } catch (error) {
        console.log(`❌ API test failed for ${endpoint}:`, error.message);
        // Continue to next endpoint
      }
    }
    
    // If all API endpoints failed
    console.log('❌ All API connectivity tests failed');
    return { success: false, message: `API service unreachable at ${apiBaseUrl}` };
  } catch (error) {
    console.log('❌ API service test error:', error.message);
    return { success: false, message: error.message };
  }
};

// Comprehensive diagnostic
export const runDiagnostics = async () => {
  console.log('🔍 Running comprehensive diagnostics...');
  
  const results = {
    network: await testNetworkConnectivity(),
    storage: await testStorageSystem(),
    environment: testEnvironmentConfig(),
    api: await testApiService()
  };
  
  console.log('📊 Diagnostic Results:', results);
  
  const failedTests = Object.entries(results)
    .filter(([_, result]) => !result.success)
    .map(([test, result]) => `${test}: ${result.message}`);
  
  if (failedTests.length > 0) {
    console.log('❌ Failed tests:', failedTests);
    return { success: false, failures: failedTests };
  } else {
    console.log('✅ All diagnostics passed');
    return { success: true, message: 'All systems operational' };
  }
};

export default {
  testNetworkConnectivity,
  testStorageSystem,
  testEnvironmentConfig,
  testApiService,
  runDiagnostics
};
