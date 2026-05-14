// LoginButtons.js
// FIX: Comprehensive child sanitization to prevent "Text strings must be rendered within a <Text> component" error
import React, { useMemo } from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator } from 'react-native';
import { optimizedStyles as styles, optimizedColors } from '../styles';

let _LinearGradientModule = undefined;
const getLinearGradient = () => {
  if (_LinearGradientModule !== undefined) return _LinearGradientModule;
  try {
    const mod = require('expo-linear-gradient');
    _LinearGradientModule = mod?.LinearGradient || mod;
  } catch (error) {
    console.warn('LoginButtons: expo-linear-gradient load failed', error?.message || error);
    _LinearGradientModule = null;
  }
  return _LinearGradientModule;
};

// FIX: Recursive child sanitizer that handles ALL edge cases
const sanitizeChildren = (children) => {
  // Handle null, undefined, or boolean (React ignores these)
  if (children === null || children === undefined || typeof children === 'boolean') {
    return null;
  }
  
  // Handle strings and numbers - wrap in Text
  if (typeof children === 'string') {
    // Empty strings can cause issues too
    if (children.trim() === '') return null;
    return <Text>{children}</Text>;
  }
  
  if (typeof children === 'number') {
    return <Text>{String(children)}</Text>;
  }
  
  // Handle arrays - recursively sanitize each element
  if (Array.isArray(children)) {
    return children.map((child, index) => {
      const sanitized = sanitizeChildren(child);
      // Add key if it's a valid element without one
      if (React.isValidElement(sanitized) && sanitized.key === null) {
        return React.cloneElement(sanitized, { key: index });
      }
      return sanitized;
    }).filter(Boolean); // Remove nulls
  }
  
  // Handle React elements
  if (React.isValidElement(children)) {
    // Preserve fragments by sanitizing their children
    if (children.type === React.Fragment) {
      return sanitizeChildren(children.props.children);
    }

    // IMPORTANT: Do not recurse into <Text>.
    // Text can safely contain raw strings, spaces, and newlines.
    if (children.type === Text) {
      return children;
    }

    const elementChildren = children.props?.children;
    if (elementChildren !== undefined) {
      const sanitizedElementChildren = sanitizeChildren(elementChildren);
      return React.cloneElement(children, {}, sanitizedElementChildren);
    }
    return children;
  }
  
  // Fallback: if it's some other type, wrap in View for safety
  console.warn('LoginButtons: Unknown child type', typeof children);
  return null;
};

const LinearGradient = ({ children, style, colors, ...rest }) => {
  const Comp = getLinearGradient();
  
  // FIX: Validate colors array
  const safeColors = useMemo(() => {
    if (!Array.isArray(colors) || colors.length < 2) {
      console.warn('LoginButtons: Invalid colors prop, using fallback');
      return ['#FF2D87', '#FF4757']; // Fallback colors
    }
    // Ensure all colors are strings
    return colors.map(c => (typeof c === 'string' ? c : '#FF2D87'));
  }, [colors]);
  
  // FIX: Sanitize all children recursively
  const safeChildren = useMemo(() => sanitizeChildren(children), [children]);
  
  if (!Comp) {
    // Fallback to View with first color as background
    return (
      <View style={[style, { backgroundColor: safeColors[0] }]}>
        {safeChildren}
      </View>
    );
  }
  
  return (
    <Comp style={style} colors={safeColors} {...rest}>
      {safeChildren}
    </Comp>
  );
};

export default function LoginButtons({ loading = false, onLogin, onDemo, onSignUp }) {
  // FIX: Ensure loading is always a boolean
  const isLoading = Boolean(loading);
  
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

  // FIX: Pre-compute button content to avoid any inline expressions
  const loginButtonContent = isLoading ? (
    <View style={styles.activityIndicatorContainer}>
      <ActivityIndicator 
        color={optimizedColors.textPrimary}
        accessibilityLabel="Loading"
      />
      <Text style={styles.activityIndicatorText}>Logging in...</Text>
    </View>
  ) : (
    <Text style={styles.primaryButtonText}>Log in</Text>
  );

  return (
    <>
      <TouchableOpacity 
        onPress={loginHandler} 
        disabled={isLoading} 
        activeOpacity={0.9} 
        style={styles.gradientWrapper}
        accessibilityRole="button"
        accessibilityLabel={isLoading ? "Logging in, please wait" : "Log in"}
        accessibilityState={{ disabled: isLoading, busy: isLoading }}
      >
        <LinearGradient
          colors={[optimizedColors.buttonStart, optimizedColors.buttonEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.primaryButton}
        >
          {loginButtonContent}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.secondaryButton, isLoading && styles.disabledButton]} 
        onPress={isLoading ? undefined : demoHandler} 
        disabled={isLoading}
        activeOpacity={isLoading ? 1 : 0.8}
        accessibilityRole="button"
        accessibilityLabel={isLoading ? "Demo account disabled during login" : "Try Demo Account"}
        accessibilityState={{ disabled: isLoading }}
      >
        <Text style={[styles.secondaryButtonText, isLoading && styles.disabledButtonText]}>
          Try Demo Account
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.secondaryButton, isLoading && styles.disabledButton]} 
        onPress={isLoading ? undefined : signupHandler} 
        disabled={isLoading}
        activeOpacity={isLoading ? 1 : 0.8}
        accessibilityRole="button"
        accessibilityLabel="Sign up"
        accessibilityState={{ disabled: isLoading }}
      >
        <Text style={[styles.secondaryButtonText, isLoading && styles.disabledButtonText]}>
          Sign up
        </Text>
      </TouchableOpacity>
    </>
  );
}

// Named export for backward compatibility
export { LoginButtons };
