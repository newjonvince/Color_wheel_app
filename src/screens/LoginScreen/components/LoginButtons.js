// screens/LoginScreen/components/LoginButtons.js
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { styles } from '../styles';

export const LoginButtons = React.memo(({ 
  loading,
  onLogin,
  onDemoLogin,
}) => {
  return (
    <>
      {/* Login Button */}
      <TouchableOpacity
        style={[styles.loginButton, loading && styles.loginButtonDisabled]}
        onPress={onLogin}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Log in"
        accessibilityState={{ disabled: loading }}
        testID="login-button"
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.loadingText}>Logging in...</Text>
          </View>
        ) : (
          <Text style={styles.loginButtonText}>Log in</Text>
        )}
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Demo Button */}
      <TouchableOpacity
        style={styles.demoButton}
        onPress={onDemoLogin}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Try Demo Account"
        accessibilityHint="Login with a demo account to explore the app"
        accessibilityState={{ disabled: loading }}
        testID="demo-button"
      >
        <Text style={styles.demoButtonText}>
          {loading ? 'Loading...' : 'Try Demo Account'}
        </Text>
      </TouchableOpacity>
    </>
  );
});
