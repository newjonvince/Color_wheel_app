// screens/LoginScreen/components/ErrorBanner.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
// CRASH FIX: Lazy-load @expo/vector-icons to prevent potential startup issues
import { optimizedStyles as styles, optimizedColors } from '../styles';

// Lazy MaterialIcons getter
let _MaterialIcons = null;
let _iconsChecked = false;
const getMaterialIcons = () => {
  if (_iconsChecked) return _MaterialIcons;
  _iconsChecked = true;
  try {
    const mod = require('@expo/vector-icons');
    _MaterialIcons = mod.MaterialIcons || null;
  } catch (error) {
    console.warn('ErrorBanner: @expo/vector-icons load failed', error?.message);
    _MaterialIcons = null;
  }
  return _MaterialIcons;
};

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

// Optimized with custom comparison to prevent unnecessary re-renders
const ErrorBanner = React.memo(
  ({ message, onDismiss }) => {
    if (!message) return null;

    return (
      <View style={styles.errorBanner}>
        {(() => {
          const Icons = getMaterialIcons();
          return Icons ? (
            <Icons
              name="error-outline"
              size={20}
              color={optimizedColors.textPrimary}
              style={{ marginRight: 8 }}
            />
          ) : (
            <View style={{ width: 20, height: 20, marginRight: 8 }} />
          );
        })()}
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
            {(() => {
              const Icons = getMaterialIcons();
              return Icons ? (
                <Icons
                  name="close"
                  size={18}
                  color={optimizedColors.textPrimary}
                />
              ) : (
                <Text style={{ fontSize: 18, color: optimizedColors.textPrimary }}>×</Text>
              );
            })()}
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
