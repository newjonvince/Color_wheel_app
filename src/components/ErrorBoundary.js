import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retrySeq: 0 };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Local log
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });

    // Optional external logger
    if (typeof this.props.onError === 'function') {
      try { this.props.onError(error, errorInfo); } catch {}
    }
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  componentDidUpdate(prevProps) {
    // Auto-reset when resetKeys change (shallow compare)
    const { resetKeys } = this.props;
    if (!this.state.hasError || !Array.isArray(resetKeys)) return;

    const changed = Array.isArray(prevProps.resetKeys) &&
      (resetKeys.length !== prevProps.resetKeys.length ||
       resetKeys.some((v, i) => v !== prevProps.resetKeys[i]));

    if (changed) {
      this.resetBoundary();
    }
  }

  resetBoundary = () => {
    this.setState((s) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retrySeq: s.retrySeq + 1, // bumps key to remount children
    }));
    if (typeof this.props.onReset === 'function') {
      try { this.props.onReset(); } catch {}
    }
  };

  render() {
    if (this.state.hasError) {
      const showDev =
        typeof __DEV__ !== 'undefined' ? __DEV__ : false;

      return (
        <View style={styles.container} testID="error-boundary-fallback">
          <View style={styles.errorContainer}>
            <Text style={styles.errorEmoji} accessibilityRole="image">😔</Text>
            <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
            <Text style={styles.errorMessage}>
              We encountered an unexpected error. Don&apos;t worry, your data is safe.
            </Text>

            {showDev && this.state.error && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug Information:</Text>
                <Text style={styles.debugText}>
                  {String(this.state.error)}
                </Text>
                {this.state.errorInfo?.componentStack ? (
                  <Text style={styles.debugText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                ) : null}
              </View>
            )}

            <TouchableOpacity
              style={styles.retryButton}
              onPress={this.resetBoundary}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Force subtree remount after retry via key
    return <React.Fragment key={this.state.retrySeq}>{this.props.children}</React.Fragment>;
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
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxWidth: 350,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  debugContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 10,
  },
  debugText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    elevation: 2,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
