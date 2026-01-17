// LoginButtons.js
import React, { useMemo } from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator } from 'react-native';
// CRASH FIX: Lazy-load expo-linear-gradient to prevent native bridge access at module load time
import { optimizedStyles as styles, optimizedColors } from '../styles';

// Lazy LinearGradient getter
let _LinearGradient = null;
const getLinearGradient = () => {
  if (_LinearGradient) return _LinearGradient;
  try {
    const mod = require('expo-linear-gradient');
    _LinearGradient = mod.LinearGradient || mod.default;
  } catch (error) {
    console.warn('LoginButtons: expo-linear-gradient load failed', error?.message);
    _LinearGradient = View;
  }
  return _LinearGradient;
};

export default function LoginButtons({ loading = false, onLogin, onDemo, onSignUp }) {
  const noopHandlers = useMemo(
    () => ({
      login: () => {},
      demo: () => {},
      signup: () => {},
    }),
    []
  );

  const loginHandler = onLogin || noopHandlers.login;
  const demoHandler = onDemo || noopHandlers.demo;
  const signupHandler = onSignUp || noopHandlers.signup;

  return (
    <>
      <TouchableOpacity 
        onPress={loginHandler} 
        disabled={loading} 
        activeOpacity={0.9} 
        style={styles.gradientWrapper}
        accessibilityRole="button"
        accessibilityLabel={loading ? "Logging in, please wait" : "Log in"}
        accessibilityState={{ disabled: loading, busy: loading }} // Add busy state
      >
        {(() => {
          const LG = getLinearGradient();
          const props = LG !== View ? {
            colors: [optimizedColors.buttonStart, optimizedColors.buttonEnd],
            start: { x: 0, y: 0 },
            end: { x: 1, y: 0 },
          } : {};
          return (
            <LG {...props} style={styles.primaryButton}>
          {loading ? (
            <View style={styles.activityIndicatorContainer}>
              <ActivityIndicator 
                color={optimizedColors.textPrimary}
                accessibilityLabel="Loading" // Label the spinner
              />
              <Text style={styles.activityIndicatorText}>Logging in...</Text> {/* Visual text too */}
            </View>
          ) : (
            <Text style={styles.primaryButtonText}>Log in</Text>
          )}
            </LG>
          );
        })()}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.secondaryButton, loading && styles.disabledButton]} 
        onPress={loading ? undefined : demoHandler} 
        disabled={loading}
        activeOpacity={loading ? 1 : 0.8}
        accessibilityRole="button"
        accessibilityLabel={loading ? "Demo account disabled during login" : "Try Demo Account"}
        accessibilityState={{ disabled: loading }}
      >
        <Text style={[styles.secondaryButtonText, loading && styles.disabledButtonText]}>
          Try Demo Account
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.secondaryButton, loading && styles.disabledButton]} 
        onPress={loading ? undefined : signupHandler} 
        disabled={loading}
        activeOpacity={loading ? 1 : 0.8}
        accessibilityRole="button"
        accessibilityLabel="Sign up"
        accessibilityState={{ disabled: loading }}
      >
        <Text style={[styles.secondaryButtonText, loading && styles.disabledButtonText]}>
          Sign up
        </Text>
      </TouchableOpacity>
    </>
  );
}

// Named export for backward compatibility
export { LoginButtons };
