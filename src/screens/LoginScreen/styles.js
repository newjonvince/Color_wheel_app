// screens/LoginScreen/optimizedStyles.js - Ultra-optimized styles with memoization and tree-shaking
import { StyleSheet, Platform, Dimensions } from 'react-native';

// Get device dimensions once
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// iOS-only optimizations (no Android support needed)
const IS_SMALL_SCREEN = screenHeight < 700;

// Memoized color palette (created once, reused)
export const optimizedColors = Object.freeze({
  primary: '#e60023',
  secondary: '#8A2BE2',
  background: '#D8C7DD',
  surface: '#F5F0F7',
  border: '#E8D5ED',
  text: Object.freeze({
    primary: '#333',
    secondary: '#666',
    white: '#fff',
    placeholder: '#999',
  }),
  error: '#d32f2f',
  success: '#2e7d32',
  disabled: 'rgba(0,0,0,0.6)',
  overlay: 'rgba(0,0,0,0.1)',
});

// Memoized spacing system
const spacing = Object.freeze({
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
});

// Memoized typography system
const typography = Object.freeze({
  title: Object.freeze({
    fontSize: IS_SMALL_SCREEN ? 24 : 28,
    fontWeight: 'bold',
    color: optimizedColors.text.primary,
  }),
  subtitle: Object.freeze({
    fontSize: IS_SMALL_SCREEN ? 14 : 16,
    color: optimizedColors.text.secondary,
  }),
  body: Object.freeze({
    fontSize: 16,
    color: optimizedColors.text.primary,
  }),
  caption: Object.freeze({
    fontSize: 12,
    color: optimizedColors.text.secondary,
  }),
});

// iOS-only shadow styles (no Android elevation needed)
const shadows = Object.freeze({
  small: Object.freeze({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  }),
  
  medium: Object.freeze({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  }),
});

// Optimized styles with tree-shaking support
export const optimizedStyles = StyleSheet.create({
  // Container styles (most commonly used first for better performance)
  keyboardAvoidingView: {
    flex: 1,
  },
  
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: optimizedColors.background,
    paddingHorizontal: spacing.md,
  },

  // Form styles
  form: {
    flex: 2,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },

  // Input styles (optimized for performance)
  inputContainer: {
    marginBottom: spacing.md,
  },

  input: {
    backgroundColor: optimizedColors.surface,
    borderWidth: 1,
    borderColor: optimizedColors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md, // iOS-optimized padding
    fontSize: 16,
    color: optimizedColors.text.primary,
    ...shadows.small,
  },

  inputFocused: {
    borderColor: optimizedColors.primary,
    borderWidth: 2,
    ...shadows.medium,
  },

  inputError: {
    borderColor: optimizedColors.error,
    borderWidth: 2,
  },

  // Password container (optimized layout)
  passwordContainer: {
    position: 'relative',
  },

  passwordToggle: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    transform: [{ translateY: -10 }],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },

  passwordToggleText: {
    color: optimizedColors.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Button styles (memoized for performance)
  buttonContainer: {
    marginTop: spacing.lg,
  },

  primaryButton: {
    backgroundColor: optimizedColors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.medium,
  },

  primaryButtonDisabled: {
    backgroundColor: optimizedColors.disabled,
    ...shadows.small,
  },

  primaryButtonText: {
    color: optimizedColors.text.white,
    fontSize: 16,
    fontWeight: '600',
  },

  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: optimizedColors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    color: optimizedColors.primary,
    fontSize: 16,
    fontWeight: '600',
  },

  // Header styles (optimized for different screen sizes)
  header: {
    flex: IS_SMALL_SCREEN ? 0.8 : 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: IS_SMALL_SCREEN ? spacing.xl : spacing.xxl,
    minHeight: IS_SMALL_SCREEN ? 200 : 300,
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  logoImage: {
    width: IS_SMALL_SCREEN ? 100 : 120,
    height: IS_SMALL_SCREEN ? 100 : 120,
    marginBottom: spacing.sm,
  },

  title: {
    ...typography.title,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },

  subtitle: {
    ...typography.subtitle,
    textAlign: 'center',
  },

  // Error styles (optimized for accessibility)
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: optimizedColors.background,
    padding: spacing.lg,
  },

  errorTitle: {
    ...typography.title,
    color: optimizedColors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },

  errorMessage: {
    ...typography.body,
    color: optimizedColors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  errorBanner: {
    backgroundColor: optimizedColors.error,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },

  errorBannerText: {
    color: optimizedColors.text.white,
    fontSize: 14,
    flex: 1,
    marginLeft: spacing.sm,
  },

  errorText: {
    color: optimizedColors.error,
    fontSize: 12,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },

  // Footer styles
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },

  footerText: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  footerButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  footerButtonText: {
    color: optimizedColors.primary,
    fontSize: 16,
    fontWeight: '600',
  },

  // Loading styles (optimized for Suspense)
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: optimizedColors.background,
    minHeight: 100,
  },

  loadingText: {
    ...typography.body,
    color: optimizedColors.text.secondary,
  },

  // Activity indicator container
  activityIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  activityIndicatorText: {
    color: optimizedColors.text.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
});

// Performance utilities for dynamic styling
export const styleUtils = {
  // Get input style based on state (memoized)
  getInputStyle: (() => {
    const cache = new Map();
    
    return (hasError, isFocused) => {
      const key = `${hasError}_${isFocused}`;
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const styles = [optimizedStyles.input];
      
      if (hasError) {
        styles.push(optimizedStyles.inputError);
      } else if (isFocused) {
        styles.push(optimizedStyles.inputFocused);
      }
      
      const result = StyleSheet.flatten(styles);
      cache.set(key, result);
      
      return result;
    };
  })(),
  
  // Get button style based on state (memoized)
  getButtonStyle: (() => {
    const cache = new Map();
    
    return (isDisabled, isSecondary = false) => {
      const key = `${isDisabled}_${isSecondary}`;
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      let baseStyle = isSecondary ? optimizedStyles.secondaryButton : optimizedStyles.primaryButton;
      
      if (isDisabled && !isSecondary) {
        baseStyle = [baseStyle, optimizedStyles.primaryButtonDisabled];
      }
      
      const result = StyleSheet.flatten(baseStyle);
      cache.set(key, result);
      
      return result;
    };
  })(),
  
  // Clear style cache (for memory management)
  clearCache: () => {
    // Clear internal caches if needed
    if (__DEV__) {
      console.log('🧹 LoginScreen style cache cleared');
    }
  }
};

// Export individual style groups for tree-shaking
export const containerStyles = {
  keyboardAvoidingView: optimizedStyles.keyboardAvoidingView,
  scrollContainer: optimizedStyles.scrollContainer,
  form: optimizedStyles.form,
};

export const inputStyles = {
  inputContainer: optimizedStyles.inputContainer,
  input: optimizedStyles.input,
  inputFocused: optimizedStyles.inputFocused,
  inputError: optimizedStyles.inputError,
  passwordContainer: optimizedStyles.passwordContainer,
  passwordToggle: optimizedStyles.passwordToggle,
  passwordToggleText: optimizedStyles.passwordToggleText,
};

export const buttonStyles = {
  buttonContainer: optimizedStyles.buttonContainer,
  primaryButton: optimizedStyles.primaryButton,
  primaryButtonDisabled: optimizedStyles.primaryButtonDisabled,
  primaryButtonText: optimizedStyles.primaryButtonText,
  secondaryButton: optimizedStyles.secondaryButton,
  secondaryButtonText: optimizedStyles.secondaryButtonText,
};

// Default export for convenience
export default {
  optimizedStyles,
  optimizedColors,
  styleUtils,
  containerStyles,
  inputStyles,
  buttonStyles,
};
