// components/UnifiedErrorBoundary.js - Single comprehensive error boundary
// Replaces multiple nested error boundaries with unified error handling

import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { reportError, ERROR_EVENTS } from '../utils/errorTelemetry';

// Lazy logger proxy to avoid circular import crashes
let _loggerInstance = null;
const getLogger = () => {
  if (_loggerInstance) return _loggerInstance;
  try {
    const mod = require('../utils/AppLogger');
    _loggerInstance = mod?.logger || mod?.default || console;
  } catch (error) {
    console.warn('UnifiedErrorBoundary: AppLogger load failed, using console', error?.message || error);
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

// Error categorization for better handling
const ERROR_CATEGORIES = {
  STORAGE: 'StorageError',
  NAVIGATION: 'NavigationError', 
  NETWORK: 'NetworkError',
  AUTH: 'AuthError',
  RENDER: 'RenderError',
  HOOK: 'HookError',
  GENERIC: 'GenericError'
};

// Categorize errors based on error properties
const categorizeError = (error, errorInfo) => {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorStack = error?.stack?.toLowerCase() || '';
  const componentStack = errorInfo?.componentStack?.toLowerCase() || '';
  
  // Storage errors
  if (errorMessage.includes('storage') || 
      errorMessage.includes('asyncstorage') ||
      errorMessage.includes('securestore') ||
      errorStack.includes('safestorage')) {
    return ERROR_CATEGORIES.STORAGE;
  }
  
  // Navigation errors
  if (errorMessage.includes('navigation') ||
      errorMessage.includes('navigator') ||
      componentStack.includes('navigationcontainer') ||
      componentStack.includes('stack.navigator')) {
    return ERROR_CATEGORIES.NAVIGATION;
  }
  
  // Network errors
  if (errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection')) {
    return ERROR_CATEGORIES.NETWORK;
  }
  
  // Auth errors
  if (errorMessage.includes('auth') ||
      errorMessage.includes('login') ||
      errorMessage.includes('token') ||
      componentStack.includes('useauth')) {
    return ERROR_CATEGORIES.AUTH;
  }
  
  // Hook errors
  if (errorMessage.includes('hook') ||
      errorStack.includes('usehook') ||
      componentStack.includes('use')) {
    return ERROR_CATEGORIES.HOOK;
  }
  
  // Render errors
  if (errorMessage.includes('render') ||
      errorMessage.includes('element') ||
      errorMessage.includes('component')) {
    return ERROR_CATEGORIES.RENDER;
  }
  
  return ERROR_CATEGORIES.GENERIC;
};

// Get user-friendly error messages based on category
const getErrorMessage = (category, error) => {
  switch (category) {
    case ERROR_CATEGORIES.STORAGE:
      return {
        title: 'Storage Error',
        message: 'Unable to access device storage. Your data may not be saved.',
        action: 'Restart App',
        canRetry: true
      };
      
    case ERROR_CATEGORIES.NAVIGATION:
      return {
        title: 'Navigation Error', 
        message: 'Problem with app navigation. Some screens may not work.',
        action: 'Go to Home',
        canRetry: true
      };
      
    case ERROR_CATEGORIES.NETWORK:
      return {
        title: 'Connection Error',
        message: 'Network connection problem. Some features may be limited.',
        action: 'Retry',
        canRetry: true
      };
      
    case ERROR_CATEGORIES.AUTH:
      return {
        title: 'Authentication Error',
        message: 'Problem with login system. You may need to sign in again.',
        action: 'Sign In',
        canRetry: true
      };
      
    case ERROR_CATEGORIES.HOOK:
      return {
        title: 'App State Error',
        message: 'Problem with app state management.',
        action: 'Restart App',
        canRetry: false
      };
      
    case ERROR_CATEGORIES.RENDER:
      return {
        title: 'Display Error',
        message: 'Problem displaying this screen.',
        action: 'Go Back',
        canRetry: true
      };
      
    default:
      return {
        title: 'Unexpected Error',
        message: 'Something went wrong. Please try restarting the app.',
        action: 'Restart App',
        canRetry: false
      };
  }
};

// Error screen component
const ErrorScreen = ({ error, errorInfo, onRetry, onRestart, category }) => {
  const errorDetails = getErrorMessage(category, error);
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons 
            name="error-outline" 
            size={64} 
            color="#e74c3c" 
          />
        </View>
        
        <Text style={styles.title}>{errorDetails.title}</Text>
        <Text style={styles.message}>{errorDetails.message}</Text>
        
        {__DEV__ && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>Debug Info:</Text>
            <Text style={styles.debugText}>
              Category: {category}
            </Text>
            <Text style={styles.debugText}>
              Error: {error?.message || 'Unknown error'}
            </Text>
            {error?.stack && (
              <Text style={styles.debugText} numberOfLines={5}>
                Stack: {error.stack}
              </Text>
            )}
          </View>
        )}
        
        <View style={styles.buttonContainer}>
          {errorDetails.canRetry && onRetry && (
            <TouchableOpacity 
              style={[styles.button, styles.retryButton]} 
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel={`${errorDetails.action} button`}
            >
              <MaterialIcons name="refresh" size={20} color="#fff" />
              <Text style={styles.buttonText}>{errorDetails.action}</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[styles.button, styles.restartButton]} 
            onPress={onRestart}
            accessibilityRole="button"
            accessibilityLabel="Restart app button"
          >
            <MaterialIcons name="restart-alt" size={20} color="#fff" />
            <Text style={styles.buttonText}>Restart App</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Unified Error Boundary Class
class UnifiedErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      category: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const category = categorizeError(error, errorInfo);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo,
      category
    });

    // Log error for debugging
    logger.error('🚨 UnifiedErrorBoundary caught error:', {
      category,
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack
    });

    // Report to analytics/crash reporting
    const errorEventName = this.getErrorEventName(category);
    reportError(errorEventName, error, {
      category,
      componentStack: errorInfo?.componentStack,
      retryCount: this.state.retryCount
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo, category);
      } catch (handlerError) {
        logger.error('Error in custom error handler:', handlerError);
      }
    }
  }

  getErrorEventName = (category) => {
    switch (category) {
      case ERROR_CATEGORIES.STORAGE:
        return ERROR_EVENTS.STORAGE_READ_FAILED;
      case ERROR_CATEGORIES.NAVIGATION:
        return 'navigation_error';
      case ERROR_CATEGORIES.NETWORK:
        return ERROR_EVENTS.API_REQUEST_FAILED;
      case ERROR_CATEGORIES.AUTH:
        return ERROR_EVENTS.API_AUTH_FAILED;
      case ERROR_CATEGORIES.HOOK:
        return ERROR_EVENTS.HOOK_INITIALIZATION_FAILED;
      case ERROR_CATEGORIES.RENDER:
        return ERROR_EVENTS.COMPONENT_RENDER_FAILED;
      default:
        return 'generic_error';
    }
  };

  handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1;
    
    // Limit retry attempts
    if (newRetryCount > 3) {
      logger.warn('Max retry attempts reached, forcing restart');
      this.handleRestart();
      return;
    }

    logger.info(`Retrying after error (attempt ${newRetryCount})`);
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      category: null,
      retryCount: newRetryCount
    });
  };

  handleRestart = () => {
    logger.info('Restarting app after error');
    
    // Reset error boundary state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      category: null,
      retryCount: 0
    });

    // Call custom restart handler if provided
    if (this.props.onRestart) {
      this.props.onRestart();
    } else {
      // Default restart behavior - could use Updates.reloadAsync() here
      if (global.Updates?.reloadAsync) {
        global.Updates.reloadAsync();
      } else {
        // Fallback - just reset state and hope for the best
        setTimeout(() => {
          this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            category: null,
            retryCount: 0
          });
        }, 100);
      }
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback component if provided
      if (this.props.fallbackComponent) {
        const FallbackComponent = this.props.fallbackComponent;
        return (
          <FallbackComponent
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            category={this.state.category}
            onRetry={this.handleRetry}
            onRestart={this.handleRestart}
          />
        );
      }

      // Default error screen
      return (
        <ErrorScreen
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          category={this.state.category}
          onRetry={this.handleRetry}
          onRestart={this.handleRestart}
        />
      );
    }

    return this.props.children;
  }
}

// Styles for error screen
const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  debugContainer: {
    backgroundColor: '#ecf0f1',
    padding: 15,
    borderRadius: 8,
    marginBottom: 30,
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  debugText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  retryButton: {
    backgroundColor: '#3498db',
  },
  restartButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
};

export default UnifiedErrorBoundary;
export { ERROR_CATEGORIES, categorizeError, getErrorMessage };
