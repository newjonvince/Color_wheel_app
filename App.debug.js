// App.debug.js - Ultra-safe debug version to isolate crash source
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';

// Minimal crash-proof App component
export default function DebugApp() {
  const [step, setStep] = useState('initializing');
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    console.log(`[DEBUG] ${message}`);
    setLogs(prev => [...prev.slice(-5), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    addLog('App component mounted');
    setStep('mounted');
  }, []);

  const testDependency = async (name, testFn) => {
    try {
      addLog(`Testing ${name}...`);
      await testFn();
      addLog(`✅ ${name} OK`);
      return true;
    } catch (error) {
      const errorMsg = `❌ ${name} FAILED: ${error.message}`;
      addLog(errorMsg);
      setError(errorMsg);
      return false;
    }
  };

  const runDependencyTests = async () => {
    setStep('testing');
    setError(null);
    
    // Test 1: Basic React Native components
    await testDependency('React Native Core', async () => {
      const { Platform } = require('react-native');
      if (!Platform.OS) throw new Error('Platform not available');
    });

    // Test 2: AsyncStorage
    await testDependency('AsyncStorage', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('test', 'value');
      const value = await AsyncStorage.getItem('test');
      if (value !== 'value') throw new Error('AsyncStorage test failed');
      await AsyncStorage.removeItem('test');
    });

    // Test 3: SecureStore (optional)
    await testDependency('SecureStore', async () => {
      const SecureStore = require('expo-secure-store');
      if (!SecureStore) throw new Error('SecureStore not available');
    });

    // Test 4: Navigation
    await testDependency('React Navigation', async () => {
      const { NavigationContainer } = require('@react-navigation/native');
      const { createBottomTabNavigator } = require('@react-navigation/bottom-tabs');
      if (!NavigationContainer || !createBottomTabNavigator) {
        throw new Error('Navigation components not available');
      }
    });

    // Test 5: Gesture Handler
    await testDependency('Gesture Handler', async () => {
      const { GestureHandlerRootView } = require('react-native-gesture-handler');
      if (!GestureHandlerRootView) throw new Error('GestureHandlerRootView not available');
    });

    // Test 6: Safe Area Context
    await testDependency('Safe Area Context', async () => {
      const { SafeAreaProvider } = require('react-native-safe-area-context');
      if (!SafeAreaProvider) throw new Error('SafeAreaProvider not available');
    });

    // Test 7: Expo Status Bar
    await testDependency('Expo Status Bar', async () => {
      const { StatusBar } = require('expo-status-bar');
      if (!StatusBar) throw new Error('StatusBar not available');
    });

    // Test 8: Our safe modules
    await testDependency('Safe Storage', async () => {
      const { safeStorage } = require('./src/utils/safeStorage');
      await safeStorage.setItem('test', 'value');
      const value = await safeStorage.getItem('test');
      if (value !== 'value') throw new Error('Safe storage test failed');
    });

    await testDependency('Safe API Service', async () => {
      const safeApiService = require('./src/services/safeApiService').default;
      await safeApiService.ready;
      if (!safeApiService.isReady) throw new Error('Safe API service not ready');
    });

    setStep('completed');
    addLog('🎉 All dependency tests completed!');
  };

  const loadRealApp = () => {
    try {
      addLog('Loading real App component...');
      // This would switch to the real app
      Alert.alert('Success', 'All tests passed! Ready to load real app.');
    } catch (error) {
      setError(`Failed to load real app: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔍 Fashion Color Wheel Debug</Text>
        <Text style={styles.subtitle}>Step: {step}</Text>
      </View>

      <View style={styles.content}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>❌ Error Detected:</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.logContainer}>
          <Text style={styles.logTitle}>📋 Debug Log:</Text>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>{log}</Text>
          ))}
        </View>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={runDependencyTests}
          disabled={step === 'testing'}
        >
          <Text style={styles.buttonText}>
            {step === 'testing' ? 'Testing...' : '🧪 Test Dependencies'}
          </Text>
        </TouchableOpacity>

        {step === 'completed' && !error && (
          <TouchableOpacity style={styles.successButton} onPress={loadRealApp}>
            <Text style={styles.buttonText}>🚀 Load Real App</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  content: {
    flex: 1,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 5,
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
  },
  logContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    flex: 1,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  logText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  buttons: {
    marginTop: 20,
  },
  button: {
    backgroundColor: '#2196f3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  successButton: {
    backgroundColor: '#4caf50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
