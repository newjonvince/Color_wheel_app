// components/ApiIntegrationStatus.js - Real-time API integration status display
// Shows API health and integration status in development mode

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import ApiService from '../services/safeApiService';
// Inline API test function (replaces removed apiIntegrationTest.js)
const quickApiTest = async () => {
  try {
    await ApiService.ready;
    const token = ApiService.getToken();
    const profile = await ApiService.getUserProfile();
    return {
      success: true,
      hasToken: !!token,
      hasProfile: !!profile,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

const ApiIntegrationStatus = () => {
  const [status, setStatus] = useState({
    apiReady: false,
    authenticated: false,
    token: null,
    lastCheck: null,
    error: null
  });
  const [testResults, setTestResults] = useState(null);
  const [isRunningTest, setIsRunningTest] = useState(false);

  // Check API status
  const checkApiStatus = useCallback(async () => {
    try {
      await ApiService.ready;
      const token = ApiService.getToken();
      
      // Try a simple API call
      const profile = await ApiService.getUserProfile();
      
      setStatus({
        apiReady: true,
        authenticated: !!token && !!profile,
        token: token ? `${token.substring(0, 10)}...` : null,
        lastCheck: new Date().toISOString(),
        error: null
      });
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        apiReady: false,
        authenticated: false,
        error: error.message,
        lastCheck: new Date().toISOString()
      }));
    }
  }, []);

  // Run comprehensive API test
  const runApiTest = useCallback(async () => {
    setIsRunningTest(true);
    try {
      const results = await quickApiTest();
      setTestResults(results);
    } catch (error) {
      setTestResults({
        error: true,
        message: error.message
      });
    } finally {
      setIsRunningTest(false);
    }
  }, []);

  // Auto-check status on mount and periodically
  useEffect(() => {
    checkApiStatus();
    const interval = setInterval(checkApiStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [checkApiStatus]);

  // Only show in development mode
  if (!__DEV__) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔌 API Integration Status</Text>
      
      {/* Current Status */}
      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <Text style={styles.label}>API Ready:</Text>
          <Text style={[styles.value, status.apiReady ? styles.success : styles.error]}>
            {status.apiReady ? '✅ Yes' : '❌ No'}
          </Text>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.label}>Authenticated:</Text>
          <Text style={[styles.value, status.authenticated ? styles.success : styles.error]}>
            {status.authenticated ? '✅ Yes' : '❌ No'}
          </Text>
        </View>
        
        {status.token && (
          <View style={styles.statusRow}>
            <Text style={styles.label}>Token:</Text>
            <Text style={[styles.value, styles.token]}>{status.token}</Text>
          </View>
        )}
        
        {status.error && (
          <View style={styles.statusRow}>
            <Text style={styles.label}>Error:</Text>
            <Text style={[styles.value, styles.error]}>{status.error}</Text>
          </View>
        )}
        
        <View style={styles.statusRow}>
          <Text style={styles.label}>Last Check:</Text>
          <Text style={styles.value}>
            {status.lastCheck ? new Date(status.lastCheck).toLocaleTimeString() : 'Never'}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={checkApiStatus}>
          <Text style={styles.buttonText}>🔄 Refresh Status</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, isRunningTest && styles.buttonDisabled]} 
          onPress={runApiTest}
          disabled={isRunningTest}
        >
          <Text style={styles.buttonText}>
            {isRunningTest ? '🧪 Running Test...' : '🧪 Run Full API Test'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Test Results */}
      {testResults && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>📊 Test Results</Text>
          
          {testResults.error ? (
            <Text style={[styles.value, styles.error]}>
              Error: {testResults.message}
            </Text>
          ) : (
            <ScrollView style={styles.resultsScroll} nestedScrollEnabled>
              <View style={styles.summaryContainer}>
                <Text style={styles.summaryText}>
                  Passed: {testResults.summary?.passed || 0} | 
                  Failed: {testResults.summary?.failed || 0} | 
                  Success Rate: {testResults.summary?.successRate || '0%'}
                </Text>
              </View>
              
              {testResults.tests && Object.entries(testResults.tests).map(([testName, result]) => (
                <View key={testName} style={styles.testResult}>
                  <Text style={[styles.testName, result.passed ? styles.success : styles.error]}>
                    {result.passed ? '✅' : '❌'} {testName}
                  </Text>
                  {!result.passed && result.details?.error && (
                    <Text style={styles.testError}>{result.details.error}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  statusContainer: {
    marginBottom: 15,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  label: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  success: {
    color: '#28a745',
    fontWeight: '600',
  },
  error: {
    color: '#dc3545',
    fontWeight: '600',
  },
  token: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#6f42c1',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  button: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  resultsContainer: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  resultsScroll: {
    maxHeight: 200,
  },
  summaryContainer: {
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  testResult: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  testName: {
    fontSize: 13,
    fontWeight: '500',
  },
  testError: {
    fontSize: 11,
    color: '#dc3545',
    marginTop: 2,
    fontStyle: 'italic',
  },
});

export default ApiIntegrationStatus;
