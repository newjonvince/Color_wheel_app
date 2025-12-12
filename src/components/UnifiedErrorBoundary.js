// components/UnifiedErrorBoundary.js - Unified error boundary for the entire app
import React from 'react';
import { 
  SafeAreaView, 
  Text, 
  TouchableOpacity, 
  View,
  ScrollView,
  StyleSheet,
  Platform
} from 'react-native';
import PropTypes from 'prop-types';
// ✅ Use shared helper to avoid duplicate code
import { isDebugMode } from '../utils/expoConfigHelper';

const IS_DEBUG_MODE = isDebugMode();

/**
 * Categorize errors based on their type and message
 */
const categorizeError = (error) => {
  const message = error?.message?.toLowerCase() || '';
  const name = error?.name?.toLowerCase() || '';
  
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return 'network';
  }
  if (message.includes('storage') || message.includes('asyncstorage') || message.includes('securestore')) {
    return 'storage';
  }
  if (message.includes('auth') || message.includes('token') || message.includes('login')) {
    return 'auth';
  }
  if (message.includes('navigation') || message.includes('route') || message.includes('screen')) {
    return 'navigation';
  }
  if (name.includes('typeerror') || name.includes('referenceerror')) {
    return 'runtime';
  }
  return 'unknown';
};

/**
 * UnifiedErrorBoundary - Catches and handles all React errors in the app
 */
class UnifiedErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      category: 'unknown',
    };
  }

  static getDerivedStateFromError(error) {
    return { 
      hasError: true, 
      error,
      category: categorizeError(error),
    };
  }

  componentDidCatch(error, errorInfo) {
    const category = categorizeError(error);
    
    this.setState({ 
      errorInfo, 
      category 
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo, category);
      } catch (callbackError) {
        console.error('UnifiedErrorBoundary: onError callback failed:', callbackError);
      }
    }

    // Log error in development
    // ✅ CRASH FIX: Use typeof check to prevent ReferenceError in production
    if (IS_DEBUG_MODE || (typeof __DEV__ !== 'undefined' && __DEV__)) {
      console.error('UnifiedErrorBoundary caught error:', error);
      console.error('Component stack:', errorInfo?.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      category: 'unknown',
    });
  };

  handleRestart = () => {
    // Try different restart methods
    if (global.Updates?.reloadAsync) {
      global.Updates.reloadAsync().catch(console.error);
    } else if (global.DevSettings?.reload) {
      global.DevSettings.reload();
    } else if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    } else {
      // Fallback: reset state
      this.handleRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, category } = this.state;
      
      // Get category-specific messaging
      const categoryConfig = {
        network: { emoji: '📡', title: 'Connection Problem' },
        storage: { emoji: '💾', title: 'Storage Issue' },
        auth: { emoji: '🔐', title: 'Authentication Error' },
        navigation: { emoji: '🧭', title: 'Navigation Error' },
        runtime: { emoji: '⚠️', title: 'Runtime Error' },
        unknown: { emoji: '❌', title: 'Something Went Wrong' },
      };

      const config = categoryConfig[category] || categoryConfig.unknown;

      return (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.emoji}>{config.emoji}</Text>
            <Text style={styles.title}>{config.title}</Text>
            
            <Text style={styles.message}>
              We encountered an unexpected error. Please try again or restart the app.
            </Text>

            {(IS_DEBUG_MODE || (typeof __DEV__ !== 'undefined' && __DEV__)) && error && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <Text style={styles.debugText}>
                  {error.name}: {error.message}
                </Text>
                {this.state.errorInfo?.componentStack && (
                  <Text style={styles.debugStack} numberOfLines={10}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={this.handleRetry}
                accessibilityLabel="Try again"
                accessibilityRole="button"
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.restartButton}
                onPress={this.handleRestart}
                accessibilityLabel="Restart app"
                accessibilityRole="button"
              >
                <Text style={styles.restartButtonText}>Restart App</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  debugContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    maxWidth: 400,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e74c3c',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#c0392b',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  debugStack: {
    fontSize: 10,
    color: '#95a5a6',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 8,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
  retryButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  restartButton: {
    backgroundColor: '#3498db',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  restartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

UnifiedErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  onError: PropTypes.func,
};

UnifiedErrorBoundary.defaultProps = {
  onError: null,
};

export default UnifiedErrorBoundary;
