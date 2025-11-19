// screens/LoginScreen/components/ErrorBanner.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { optimizedStyles as styles, optimizedColors } from '../styles';

// ✅ Optimized with custom comparison to prevent unnecessary re-renders
const ErrorBanner = React.memo(
  ({ message, onDismiss }) => {
    if (!message) return null;

    return (
      <View style={styles.errorBanner}>
        <MaterialIcons 
          name="error-outline" 
          size={20} 
          color={optimizedColors.textPrimary}
          style={{ marginRight: 8 }}
        />
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
            <MaterialIcons 
              name="close" 
              size={18} 
              color={optimizedColors.textPrimary}
            />
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
