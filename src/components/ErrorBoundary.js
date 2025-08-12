// ErrorBoundary.js — patched with reporting & better reset
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';

// Small fetch with timeout
async function postJson(url, payload, timeoutMs = 4000) {
  if (!url) return { ok: false, skipped: true };
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    clearTimeout(id);
    return { ok: res.ok, status: res.status };
  } catch (e) {
    clearTimeout(id);
    return { ok: false, error: e?.message || String(e) };
  }
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retrySeq: 0, sent: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  async componentDidCatch(error, errorInfo) {
    // Console for local debugging / device logs
    console.error('🚨 ErrorBoundary caught:', error, errorInfo);

    const errorDetails = {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'React Native',
      platform: Platform.OS,
      version: this.props.appVersion || undefined,
      screen: this.props.screen || undefined,
      extra: this.props.extraInfo || undefined,
    };

    this.setState({ error, errorInfo });

    // Optional external hook
    if (typeof this.props.onError === 'function') {
      try { this.props.onError(error, errorInfo, errorDetails); } catch (loggerError) {
        console.error('Error logger failed:', loggerError);
      }
    }

    // Optional auto-report to backend
    if (this.props.autoReport && this.props.reportUrl && !__DEV__) {
      const res = await postJson(this.props.reportUrl, { type: 'client_error', ...errorDetails });
      this.setState({ sent: !!res?.ok });
    }
  }

  componentDidUpdate(prevProps) {
    const { resetKeys } = this.props;
    if (!this.state.hasError || !Array.isArray(resetKeys)) return;

    const changed = Array.isArray(prevProps.resetKeys) &&
      (resetKeys.length !== prevProps.resetKeys.length ||
       resetKeys.some((v, i) => v !== prevProps.resetKeys[i]));

    if (changed) this.resetBoundary();
  }

  resetBoundary = () => {
    this.setState((s) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retrySeq: s.retrySeq + 1,
      sent: false,
    }));
    if (typeof this.props.onReset === 'function') {
      try { this.props.onReset(); } catch {}
    }
  };

  sendReportManually = async () => {
    const { reportUrl } = this.props;
    if (!reportUrl) return;
    const { error, errorInfo } = this.state;
    const payload = {
      type: 'client_error',
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      screen: this.props.screen || undefined,
      extra: this.props.extraInfo || undefined,
    };
    const res = await postJson(reportUrl, payload);
    this.setState({ sent: !!res?.ok });
  };

  render() {
    if (this.state.hasError) {
      const showDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
      const { sent } = this.state;

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
                <Text style={styles.debugText}>{String(this.state.error)}</Text>
                {this.state.errorInfo?.componentStack ? (
                  <Text style={styles.debugText}>{this.state.errorInfo.componentStack}</Text>
                ) : null}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.button, styles.retryButton]}
                onPress={this.resetBoundary}
                accessibilityRole="button"
                accessibilityLabel="Try again"
              >
                <Text style={styles.buttonText}>Try Again</Text>
              </TouchableOpacity>

              {this.props.reportUrl ? (
                <TouchableOpacity
                  style={[styles.button, sent ? styles.sentButton : styles.reportButton]}
                  onPress={this.sendReportManually}
                  disabled={sent}
                  accessibilityRole="button"
                  accessibilityLabel="Report issue"
                >
                  <Text style={styles.buttonText}>{sent ? 'Reported' : 'Report'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      );
    }

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
  errorEmoji: { fontSize: 64, marginBottom: 20 },
  errorTitle: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50', marginBottom: 15, textAlign: 'center' },
  errorMessage: { fontSize: 16, color: '#7f8c8d', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  debugContainer: { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 15, marginBottom: 20, width: '100%' },
  debugTitle: { fontSize: 14, fontWeight: 'bold', color: '#e74c3c', marginBottom: 10 },
  debugText: { fontSize: 12, color: '#7f8c8d', fontFamily: 'monospace', lineHeight: 16 },
  button: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25, elevation: 2, minWidth: 120, alignItems: 'center' },
  retryButton: { backgroundColor: '#3498db' },
  reportButton: { backgroundColor: '#6c5ce7' },
  sentButton: { backgroundColor: '#2ecc71' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});

export default ErrorBoundary;
