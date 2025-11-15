// screens/LoginScreen/components/ErrorBanner.js
import React from 'react';
import { View, Text } from 'react-native';
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
          style={styles.errorBannerText}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          {message}
        </Text>
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
