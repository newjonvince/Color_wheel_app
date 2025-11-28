// components/GlobalErrorBoundary.js - Catches ANY JavaScript error in the app
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { reportError, ERROR_EVENTS } from '../utils/errorTelemetry';

// Lazy logger proxy to avoid circular import crashes
let _loggerInstance = null;
const getLogger = () => {
  if (_loggerInstance) return _loggerInstance;
  try {
    const mod = require('../utils/AppLogger');
    _loggerInstance = mod?.logger || mod?.default || console;
  } catch (error) {
    console.warn('GlobalErrorBoundary: AppLogger load failed, using console', error?.message || error);
    _loggerInstance = console;
  }
  return _loggerInstance;
};

const logger = {
  debug: (...args) => getLogger()?.debug?.(...args),
  info: (...args) => getLogger()?.info?.(...args),
  warn: (...args) => getLogger()?.warn?.(...args),
  error: (...args) => getLogger()?.error?.(...args),
};

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `global_error_${Date.now()}`
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error
    logger.error('🚨 Global Error Boundary caught error:', error);
    logger.error('🚨 Error Info:', errorInfo);

    // Report to crash reporting service
    reportError(ERROR_EVENTS.COMPONENT_MOUNT_FAILED, error, {
      errorBoundary: 'GlobalErrorBoundary',
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      context: 'global_app_error'
    });

    // Update state with error info
    this.setState({
      error,
      errorInfo
    });
  }

  handleRestart = async () => {
    try {
      // Reset error state first
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null
      });

      // Reset app initializer
      if (this.props.appInitializer?.reset) {
        this.props.appInitializer.reset();
      }
      
      // Try Expo Updates reload (production)
      if (global.Updates?.reloadAsync) {
        logger.info('🔄 Restarting via Expo Updates...');
        await global.Updates.reloadAsync();
        return;
      }
      
      // Try DevSettings (dev only)
      if (__DEV__ && global.DevSettings?.reload) {
        logger.info('🔄 Restarting via DevSettings...');
        global.DevSettings.reload();
        return;
      }

      // Call restart function if provided
      if (this.props.onRestart) {
        this.props.onRestart();
      }
      
      logger.warn('⚠️ No reload method available, using fallback restart');
    } catch (error) {
      logger.error('🚨 Restart failed:', error);
      
      // Fallback to props restart function
      if (this.props.onRestart) {
        this.props.onRestart();
      }
    }
  };

  handleReload = () => {
    // For React Native, we can't reload like in web
    // But we can restart the app initialization
    if (this.props.onReload) {
      this.props.onReload();
    } else {
      this.handleRestart();
    }
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.errorContainer}>
              <Text style={styles.title}>🚨 Something went wrong</Text>
              
              <Text style={styles.subtitle}>
                The app encountered an unexpected error and needs to restart.
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[styles.button, styles.primaryButton]} 
                  onPress={this.handleRestart}
                >
                  <Text style={styles.primaryButtonText}>Restart App</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.button, styles.secondaryButton]} 
                  onPress={this.handleReload}
                >
                  <Text style={styles.secondaryButtonText}>Reload</Text>
                </TouchableOpacity>
              </View>

              {__DEV__ && this.state.error && (
                <View style={styles.debugContainer}>
                  <Text style={styles.debugTitle}>Debug Info:</Text>
                  <Text style={styles.debugText}>
                    {this.state.error.toString()}
                  </Text>
                  {this.state.errorInfo && (
                    <Text style={styles.debugText}>
                      {this.state.errorInfo.componentStack}
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.errorId}>
                Error ID: {this.state.errorId}
              </Text>
            </View>
          </ScrollView>
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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  errorContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    marginHorizontal: 6, // ✅ Replace gap with marginHorizontal for React Native compatibility
  },
  primaryButton: {
    backgroundColor: '#007bff',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6c757d',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '600',
  },
  debugContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    width: '100%',
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
  errorId: {
    fontSize: 12,
    color: '#adb5bd',
    fontFamily: 'monospace',
  },
});

export default GlobalErrorBoundary;
