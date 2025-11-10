// screens/LoginScreen/components/LoginButtons.js
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { optimizedStyles as styles, optimizedColors } from '../styles';

export const LoginButtons = React.memo(({ 
  loading,
  onLogin,
  onDemoLogin,
}) => {
  return (
    <>
      {/* Login Button with Gradient */}
      <View style={styles.gradientWrapper}>
        <LinearGradient
          colors={[optimizedColors.buttonStart, optimizedColors.buttonEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.primaryButton}
        >
          <TouchableOpacity
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            onPress={onLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Log in"
            accessibilityState={{ disabled: loading }}
            testID="login-button"
          >
            {loading ? (
              <View style={styles.activityIndicatorContainer}>
                <ActivityIndicator color={optimizedColors.text.white} />
                <Text style={styles.activityIndicatorText}>Logging in...</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>Log in</Text>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Demo Button */}
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={onDemoLogin}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Try Demo Account"
        accessibilityHint="Login with a demo account to explore the app"
        accessibilityState={{ disabled: loading }}
        testID="demo-button"
      >
        <Text style={styles.secondaryButtonText}>
          {loading ? 'Loading...' : 'Try Demo Account'}
        </Text>
      </TouchableOpacity>
      
      {/* Sign up Button */}
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => {}}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Sign up"
        accessibilityState={{ disabled: loading }}
        testID="signup-button"
      >
        <Text style={styles.secondaryButtonText}>
          Sign up
        </Text>
      </TouchableOpacity>
    </>
  );
});
