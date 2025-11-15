// components/StorageErrorBoundary.js - Error boundary for storage-related crashes
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Constants from 'expo-constants';
import { safeAsyncStorage } from '../utils/safeAsyncStorage';

// Production-ready configuration
const extra = Constants.expoConfig?.extra || {};
const IS_DEBUG_MODE = !!extra.EXPO_PUBLIC_DEBUG_MODE;

class StorageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error for debugging
    console.error('StorageErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Always report to error monitoring service for production debugging
    try {
      // Example: Sentry.captureException(error, { extra: errorInfo });
      console.error('Storage error in production:', error.message);
    } catch (reportError) {
      console.error('Failed to report storage error:', reportError);
    }
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  };

  handleContinueWithoutStorage = () => {
    // Continue with app functionality but warn about no storage
    console.warn('⚠️ Continuing without storage - data will not be saved');
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  };

  render() {
    if (this.state.hasError) {
      // Enhanced fallback UI for storage errors
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>💾</Text>
          <Text style={styles.errorTitle}>Storage Issue</Text>
          <Text style={styles.errorMessage}>
            Your saved colors and preferences are temporarily unavailable. This usually resolves itself quickly.
          </Text>
          
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={this.handleRetry}>
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.secondaryButton} onPress={this.handleContinueWithoutStorage}>
              <Text style={styles.secondaryButtonText}>Continue Without Saving</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.helpText}>
            💡 You can still use the color wheel, but your changes won't be saved until storage is restored.
          </Text>
          
          {IS_DEBUG_MODE && this.state.error && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugTitle}>Debug Info:</Text>
              <Text style={styles.debugText}>{this.state.error.toString()}</Text>
              {this.state.errorInfo && (
                <Text style={styles.debugText}>{this.state.errorInfo.componentStack}</Text>
              )}
            </View>
          )}
          
          <Text style={styles.helpText}>
            If this problem persists, try restarting the app or freeing up device storage.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#5a6c7d',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  actionsContainer: {
    width: '100%',
    maxWidth: 300,
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#007bff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#e9ecef',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#495057',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  debugInfo: {
    backgroundColor: '#f1f3f4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
    maxWidth: 400,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#6c757d',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});

export default StorageErrorBoundary;
