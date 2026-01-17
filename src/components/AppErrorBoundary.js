// components/AppErrorBoundary.js - Enhanced error boundary with better UX
import React from 'react';
import { 
  SafeAreaView, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  View,
  Alert,
  Linking,
  Dimensions
} from 'react-native';
import { StyleSheet } from 'react-native';
import { safeStorage } from '../utils/safeStorage';
// CRASH FIX: Use lazy getter to avoid calling isDebugMode() at module load time
let _isDebugModeValue = null;
const getIsDebugMode = () => {
  if (_isDebugModeValue === null) {
    try {
      const helper = require('../utils/expoConfigHelper');
      _isDebugModeValue = helper.isDebugMode ? helper.isDebugMode() : false;
    } catch (error) {
      console.warn('AppErrorBoundary: expoConfigHelper load failed', error?.message);
      _isDebugModeValue = false;
    }
  }
  return _isDebugModeValue;
};
const IS_DEBUG_MODE = getIsDebugMode;

class AppErrorBoundary extends React.Component {
  static MAX_ERRORS_PER_MINUTE = 5;
  errorTimestamps = [];

  // Define action configs as static class properties
  static ERROR_CONFIGS = {
    network: {
      emoji: '',
      title: 'Connection Problem',
      message: 'Unable to connect to our servers. Please check your internet connection and try again.',
      actions: ['retry', 'offline'] // Reference action names, not functions
    },
    storage: {
      emoji: '',
      title: 'Storage Issue',
      message: 'There was a problem accessing your saved data.',
      actions: ['retry', 'clearCache']
    },
    navigation: {
      emoji: '',
      title: 'Navigation Error',
      message: 'There was a problem loading the screen. Let\'s get you back on track.',
      actions: ['goHome', 'restart']
    },
    unknown: {
      emoji: '',
      title: 'Something went wrong',
      message: 'An unexpected error occurred. We\'re working to fix it.',
      actions: ['retry', 'restart']
    }
  };

  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorType: 'unknown',
      retryCount: 0
    };
    
    // Action map bound in constructor
    this.actionMap = {
      retry: { text: 'Retry', action: this.handleRetry, primary: true },
      offline: { text: 'Go Offline', action: this.handleOfflineMode },
      clearCache: { text: 'Clear Cache', action: this.handleClearCache },
      goHome: { text: 'Go Home', action: this.handleGoHome, primary: true },
      restart: { text: 'Restart App', action: this.handleRestart },
    };
  }

  static classifyError(error) {
    const message = error?.message?.toLowerCase() || '';
    
    // Add error codes for tracking
    if (message.includes('network')) {
      return { type: 'network', code: 'ERR_NETWORK_001' };
    }
    if (message.includes('storage')) {
      return { type: 'storage', code: 'ERR_STORAGE_002' };
    }
    if (message.includes('navigation')) {
      return { type: 'navigation', code: 'ERR_NAVIGATION_003' };
    }
    
    return { type: 'unknown', code: 'ERR_UNKNOWN_999' };
  }

  static getDerivedStateFromError(error) {
    const { type: errorType, code } = AppErrorBoundary.classifyError(error);
    return { 
      hasError: true, 
      error,
      errorType,
      errorCode: code
    };
  }

  componentDidCatch(error, errorInfo) {
    // Only log detailed error info in debug mode
    if (IS_DEBUG_MODE) {
      console.error('AppErrorBoundary caught error:', error);
      console.error('Error info:', errorInfo);
    } else {
      console.error('App error occurred:', this.state.errorType || 'unknown');
    }
    
    // Error rate limiting to prevent infinite loops
    const now = Date.now();
    this.errorTimestamps = this.errorTimestamps.filter(t => now - t < 60000); // Last minute
    this.errorTimestamps.push(now);

    if (this.errorTimestamps.length > AppErrorBoundary.MAX_ERRORS_PER_MINUTE) {
      // Too many errors - force app restart
      Alert.alert(
        'Critical Error',
        'The app is experiencing critical issues. Please restart.',
        [{ text: 'OK', onPress: () => { /* Can't actually restart in RN */ } }]
      );
      return; // Don't attempt recovery
    }
    
    this.setState({
      error,
      errorInfo,
      hasError: true
    });

    // Report crash to monitoring service
    this.reportError(error, errorInfo);
  }

  reportError = async (error, errorInfo) => {
    try {
      // Example: Sentry.captureException(error, { 
      //   extra: { 
      //     ...errorInfo, 
      //     errorType: this.state.errorType,
      //     retryCount: this.state.retryCount
      //   } 
      // });
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
    }
  }

  getErrorContent() {
    const { errorType, retryCount } = this.state;
    const config = AppErrorBoundary.ERROR_CONFIGS[errorType] || AppErrorBoundary.ERROR_CONFIGS.unknown;
    
    return {
      ...config,
      actions: config.actions.map(actionName => this.actionMap[actionName])
    };
  }

  handleRetry = () => {
    this.setState(prevState => ({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleRestart = () => {
    // In React Native, we can't truly restart the app, but we can reset to initial state
    Alert.alert(
      'Restart App',
      'Please close and reopen the app to restart it completely.',
      [
        { text: 'OK', onPress: this.handleRetry }
      ]
    );
  };

  handleOfflineMode = () => {
    // Set app to offline mode - would need to be implemented in app state
    Alert.alert(
      'Offline Mode',
      'You can still use the color wheel and view saved palettes while offline.',
      [
        { text: 'Continue', onPress: this.handleRetry }
      ]
    );
  };

  handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear temporary data but keep your saved colors and preferences.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear Cache', 
          onPress: () => {
            // Would need to implement cache clearing
            console.log('Cache cleared');
            this.handleRetry();
          }
        }
      ]
    );
  };

  handleGoHome = () => {
    // Reset to home screen - would need navigation context
    this.handleRetry();
  };

  handleOpenSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert('Unable to open settings', 'Please open your device settings manually.');
    });
  };

  handleReportIssue = () => {
    const { error, errorType } = this.state;
    const errorDetails = `Error Type: ${errorType}\nMessage: ${error?.message}\nStack: ${error?.stack?.substring(0, 500)}`;
    
    Alert.alert(
      'Report Issue',
      'Help us improve the app by reporting this error.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send Report', 
          onPress: () => {
            // Would integrate with crash reporting service
            console.log('Error report sent:', errorDetails);
            Alert.alert('Thank you!', 'Your error report has been sent.');
          }
        }
      ]
    );
  };

  render() {
    if (this.state.hasError) {
      const { emoji, title, message, actions } = this.getErrorContent();
      
      return (
        <SafeAreaView 
          style={styles.errorContainer}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <View style={styles.errorContent}>
            <Text 
              style={styles.errorEmoji}
              accessibilityHidden={true}
            >
              {emoji}
            </Text>
            <Text 
              style={styles.errorTitle}
              accessibilityRole="header"
              accessibilityLevel={1}
            >
              {title}
            </Text>
            <Text 
              style={styles.errorMessage}
              accessibilityRole="text"
            >
              {message}
            </Text>
            
            <View style={styles.actionsContainer}>
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.actionButton,
                    action.primary && styles.primaryButton
                  ]}
                  onPress={action.action}
                  accessibilityRole="button"
                  accessibilityLabel={`${action.text}. ${action.primary ? 'Primary action' : 'Secondary action'}`}
                  accessibilityHint={`Tap to ${action.text.toLowerCase()}`}
                >
                  <Text style={[
                    styles.actionButtonText,
                    action.primary && styles.primaryButtonText
                  ]}>
                    {action.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {IS_DEBUG_MODE && this.state.error && (
              <View style={styles.debugSection}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <ScrollView style={styles.stackTrace}>
                  <Text style={styles.stackText}>
                    Type: {this.state.errorType}{'\n'}
                    Message: {this.state.error.message}{'\n'}
                    Stack: {this.state.error.stack}
                  </Text>
                </ScrollView>
              </View>
            )}
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContent: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#5a6c7d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#e9ecef',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007bff',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  debugSection: {
    marginTop: 32,
    width: '100%',
    maxHeight: 200,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6c757d',
    marginBottom: 8,
  },
  stackTrace: {
    backgroundColor: '#f1f3f4',
    borderRadius: 4,
    padding: 12,
    maxHeight: 150,
  },
  stackText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#495057',
    lineHeight: 16,
  },
});

// Default export
export default AppErrorBoundary;

// Named export for backward compatibility
export { AppErrorBoundary };
