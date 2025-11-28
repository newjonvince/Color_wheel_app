// screens/LoginScreen/components/ErrorBanner.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { optimizedStyles as styles, optimizedColors } from '../styles';

// ✅ PROPER FIX: Check MaterialIcons availability once at module level
const ICONS_AVAILABLE = (() => {
  try {
    return MaterialIcons && typeof MaterialIcons === 'object';
  } catch (error) {
    console.warn('MaterialIcons not available in ErrorBanner:', error);
    return false;
  }
})();

// Lazy logger proxy to avoid circular import crashes
let _loggerInstance = null;
const getLogger = () => {
  if (_loggerInstance) return _loggerInstance;
  try {
    const mod = require('../../../utils/AppLogger');
    _loggerInstance = mod?.logger || mod?.default || console;
  } catch (error) {
    console.warn('ErrorBanner: AppLogger load failed, using console', error?.message || error);
    _loggerInstance = console;
  }
  return _loggerInstance;
};

// ✅ Optimized with custom comparison to prevent unnecessary re-renders
const ErrorBanner = React.memo(
  ({ message, onDismiss }) => {
    if (!message) return null;

    return (
      <View style={styles.errorBanner}>
        {ICONS_AVAILABLE ? (
          <MaterialIcons
            name="error-outline"
            size={20}
            color={optimizedColors.textPrimary}
            style={{ marginRight: 8 }}
          />
        ) : (
          <View style={{ width: 20, height: 20, marginRight: 8 }} />
        )}
        <Text 
          style={[styles.errorBannerText, { flex: 1 }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          {message}
        </Text>
        {onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            style={{ marginLeft: 8, padding: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss error message"
            accessibilityHint="Tap to close this error message"
          >
            {ICONS_AVAILABLE ? (
              <MaterialIcons
                name="close"
                size={18}
                color={optimizedColors.textPrimary}
              />
            ) : (
              <Text style={{ fontSize: 18, color: optimizedColors.textPrimary }}>×</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if message changes (ignore onDismiss function changes)
    return prevProps.message === nextProps.message;
  }
);

// Default export
export default ErrorBanner;

// Named export for backward compatibility
export { ErrorBanner };
