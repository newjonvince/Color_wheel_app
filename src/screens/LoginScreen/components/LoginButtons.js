// LoginButtons.js
// In sign-up mode the main button creates the account and the last button switches back to log in.
import React from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { optimizedStyles as styles, optimizedColors } from '../styles';

const noop = () => {};

export default function LoginButtons({ loading = false, signingUp = false, onLogin, onDemo, onSignUp }) {
  const loginHandler = onLogin || noop;
  const demoHandler = onDemo || noop;
  const signupHandler = onSignUp || noop;

  const mainLabel = signingUp ? 'Create account' : 'Log in';
  const busyLabel = signingUp ? 'Creating account...' : 'Logging in...';
  const switchLabel = signingUp ? 'I already have an account' : 'Sign up';

  return (
    <>
      <TouchableOpacity
        onPress={loginHandler}
        disabled={loading}
        activeOpacity={0.9}
        style={styles.gradientWrapper}
        accessibilityRole="button"
        accessibilityLabel={loading ? `${busyLabel} please wait` : mainLabel}
        accessibilityState={{ disabled: loading, busy: loading }}
      >
        <LinearGradient
          colors={[optimizedColors.buttonStart, optimizedColors.buttonEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.primaryButton}
        >
          {loading ? (
            <View style={styles.activityIndicatorContainer}>
              <ActivityIndicator color={optimizedColors.textPrimary} accessibilityLabel="Loading" />
              <Text style={styles.activityIndicatorText}>{busyLabel}</Text>
            </View>
          ) : (
            <Text style={styles.primaryButtonText}>{mainLabel}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {!signingUp && (
        <TouchableOpacity
          style={[styles.secondaryButton, loading && styles.disabledButton]}
          onPress={loading ? undefined : demoHandler}
          disabled={loading}
          activeOpacity={loading ? 1 : 0.8}
          accessibilityRole="button"
          accessibilityLabel={loading ? 'Demo account disabled during login' : 'Try Demo Account'}
          accessibilityState={{ disabled: loading }}
        >
          <Text style={[styles.secondaryButtonText, loading && styles.disabledButtonText]}>
            Try Demo Account
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.secondaryButton, loading && styles.disabledButton]}
        onPress={loading ? undefined : signupHandler}
        disabled={loading}
        activeOpacity={loading ? 1 : 0.8}
        accessibilityRole="button"
        accessibilityLabel={switchLabel}
        accessibilityState={{ disabled: loading }}
      >
        <Text style={[styles.secondaryButtonText, loading && styles.disabledButtonText]}>
          {switchLabel}
        </Text>
      </TouchableOpacity>
    </>
  );
}

// Named export for backward compatibility
export { LoginButtons };
