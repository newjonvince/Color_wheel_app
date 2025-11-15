// components/AppErrorBoundary.js - Enhanced error boundary with better UX
import React from 'react';
import { 
  SafeAreaView, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  View,
  Alert,
  Linking 
} from 'react-native';
import { StyleSheet } from 'react-native';

class AppErrorBoundary extends React.Component {
  state = { 
    hasError: false, 
    error: null, 
    errorInfo: null,
    errorType: 'unknown',
    retryCount: 0
  };

  static getDerivedStateFromError(error) {
    const errorType = AppErrorBoundary.classifyError(error);
    return { 
      hasError: true, 
      error,
      errorType
    };
  }

  static classifyError(error) {
    const message = error?.message?.toLowerCase() || '';
    const stack = error?.stack?.toLowerCase() || '';
    
    // Network/API errors
    if (message.includes('network') || message.includes('fetch') || 
        message.includes('timeout') || message.includes('connection')) {
      return 'network';
    }
    
    // Storage errors
    if (message.includes('storage') || message.includes('asyncstorage') ||
        message.includes('securestore') || stack.includes('storage')) {
      return 'storage';
    }
    
    // Navigation errors
    if (message.includes('navigation') || stack.includes('navigation') ||
        message.includes('screen') || stack.includes('@react-navigation')) {
      return 'navigation';
    }
    
    // Memory/performance errors
    if (message.includes('memory') || message.includes('heap') ||
        message.includes('maximum call stack')) {
      return 'memory';
    }
    
    // Rendering errors
    if (message.includes('render') || message.includes('component') ||
        stack.includes('render') || message.includes('element type')) {
      return 'render';
    }
    
    // Permission errors
    if (message.includes('permission') || message.includes('denied') ||
        message.includes('unauthorized')) {
      return 'permission';
    }
    
    return 'unknown';
  }

  componentDidCatch(error, errorInfo) {
    console.error('🚨 App Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Error Type:', this.state.errorType);
    
    this.setState({ errorInfo });
    
    // Send to crash reporting with context
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
    const { errorType, error, retryCount } = this.state;
    
    switch (errorType) {
      case 'network':
        return {
          emoji: '📡',
          title: 'Connection Problem',
          message: 'Unable to connect to our servers. Please check your internet connection and try again.',
          actions: [
            { text: 'Retry', action: this.handleRetry, primary: true },
            { text: 'Go Offline', action: this.handleOfflineMode }
          ]
        };
        
      case 'storage':
        return {
          emoji: '💾',
          title: 'Storage Issue',
          message: 'There was a problem accessing your saved data. Your preferences and saved colors might be temporarily unavailable.',
          actions: [
            { text: 'Try Again', action: this.handleRetry, primary: true },
            { text: 'Clear Cache', action: this.handleClearCache }
          ]
        };
        
      case 'navigation':
        return {
          emoji: '🧭',
          title: 'Navigation Error',
          message: 'There was a problem loading the screen. Let\'s get you back on track.',
          actions: [
            { text: 'Go Home', action: this.handleGoHome, primary: true },
            { text: 'Restart App', action: this.handleRestart }
          ]
        };
        
      case 'memory':
        return {
          emoji: '⚡',
          title: 'Performance Issue',
          message: 'The app is using too much memory. Restarting will help improve performance.',
          actions: [
            { text: 'Restart App', action: this.handleRestart, primary: true },
            { text: 'Report Issue', action: this.handleReportIssue }
          ]
        };
        
      case 'render':
        return {
          emoji: '🎨',
          title: 'Display Problem',
          message: 'There was an issue displaying this content. The app should work normally after restarting.',
          actions: [
            { text: 'Try Again', action: this.handleRetry, primary: true },
            { text: 'Restart App', action: this.handleRestart }
          ]
        };
        
      case 'permission':
        return {
          emoji: '🔐',
          title: 'Permission Required',
          message: 'The app needs certain permissions to work properly. Please check your device settings.',
          actions: [
            { text: 'Open Settings', action: this.handleOpenSettings, primary: true },
            { text: 'Continue Anyway', action: this.handleRetry }
          ]
        };
        
      default:
        return {
          emoji: '😔',
          title: 'Something Went Wrong',
          message: retryCount > 0 
            ? 'The error persists. You may need to restart the app.'
            : 'We encountered an unexpected error, but we can try to recover.',
          actions: [
            { text: 'Try Again', action: this.handleRetry, primary: true },
            { text: 'Restart App', action: this.handleRestart },
            { text: 'Report Issue', action: this.handleReportIssue }
          ]
        };
    }
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
        <SafeAreaView style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <Text style={styles.errorEmoji}>{emoji}</Text>
            <Text style={styles.errorTitle}>{title}</Text>
            <Text style={styles.errorMessage}>{message}</Text>
            
            <View style={styles.actionsContainer}>
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.actionButton,
                    action.primary && styles.primaryButton
                  ]}
                  onPress={action.action}
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
            
            {__DEV__ && this.state.error && (
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

export default AppErrorBoundary;
