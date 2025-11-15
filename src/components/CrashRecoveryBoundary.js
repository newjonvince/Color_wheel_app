import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { safeStorage } from '../utils/safeStorage';

/**
 * Enhanced Error Boundary specifically for handling production crashes
 * Provides recovery mechanisms and crash reporting
 */
class CrashRecoveryBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🚨 CrashRecoveryBoundary caught error:', error);
    console.error('Error info:', errorInfo);
    
    this.setState({
      error,
      errorInfo,
      hasError: true
    });

    // Report crash to monitoring service
    this.reportCrash(error, errorInfo);
  }

  reportCrash = async (error, errorInfo) => {
    try {
      const crashReport = {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        errorInfo: {
          componentStack: errorInfo.componentStack
        },
        timestamp: new Date().toISOString(),
        retryCount: this.state.retryCount,
        userAgent: 'React Native iOS'
      };

      // Store crash report locally for later upload
      await safeStorage.setItem('lastCrashReport', crashReport, { 
        ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
        batch: false 
      });

      console.log('📝 Crash report saved locally');
    } catch (reportError) {
      console.error('Failed to save crash report:', reportError);
    }
  };

  handleRetry = async () => {
    if (this.state.isRecovering) return;

    this.setState({ isRecovering: true });

    try {
      // Clear any corrupted storage data
      await this.clearCorruptedData();
      
      // Reset error state
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: this.state.retryCount + 1,
        isRecovering: false
      });

      console.log('✅ App recovery attempted');
    } catch (recoveryError) {
      console.error('❌ Recovery failed:', recoveryError);
      this.setState({ isRecovering: false });
      
      Alert.alert(
        'Recovery Failed',
        'Unable to recover automatically. Please restart the app.',
        [{ text: 'OK' }]
      );
    }
  };

  clearCorruptedData = async () => {
    try {
      // Clear potentially corrupted cache
      if (safeStorage.clearCache) {
        safeStorage.clearCache();
      }

      // Remove potentially problematic keys
      const problematicKeys = [
        'userData',
        'colorWheelState',
        'lastSavedPalette'
      ];

      await Promise.allSettled(
        problematicKeys.map(key => safeStorage.removeItem(key))
      );

      console.log('🧹 Cleared potentially corrupted data');
    } catch (error) {
      console.warn('Failed to clear corrupted data:', error);
    }
  };

  handleForceRestart = () => {
    Alert.alert(
      'Restart Required',
      'The app needs to restart to recover from this error. Please close and reopen the app.',
      [
        {
          text: 'OK',
          onPress: () => {
            // In a real app, you might use a library like react-native-restart
            console.log('User acknowledged restart requirement');
          }
        }
      ]
    );
  };

  render() {
    if (this.state.hasError) {
      const { error, retryCount, isRecovering } = this.state;
      const canRetry = retryCount < 3;

      return (
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>🚨 App Error</Text>
            <Text style={styles.errorMessage}>
              The app encountered an unexpected error and needs to recover.
            </Text>
            
            {error && (
              <View style={styles.debugInfo}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <Text style={styles.debugText}>{error?.message}</Text>
              </View>
            )}

            <View style={styles.buttonContainer}>
              {canRetry && (
                <TouchableOpacity
                  style={[styles.button, styles.retryButton]}
                  onPress={this.handleRetry}
                  disabled={isRecovering}
                >
                  <Text style={styles.buttonText}>
                    {isRecovering ? 'Recovering...' : 'Try Again'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.button, styles.restartButton]}
                onPress={this.handleForceRestart}
              >
                <Text style={styles.buttonText}>Restart App</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.retryInfo}>
              Retry attempts: {retryCount}/3
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    maxWidth: 350,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  debugInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
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
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#007bff',
  },
  restartButton: {
    backgroundColor: '#6c757d',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  retryInfo: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default CrashRecoveryBoundary;
