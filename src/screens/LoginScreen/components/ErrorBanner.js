// screens/LoginScreen/components/ErrorBanner.js
import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { optimizedStyles as styles } from '../styles';

export const ErrorBanner = React.memo(({ message, onDismiss }) => {
  if (!message) return null;

  return (
    <View style={styles.errorBanner}>
      <MaterialIcons 
        name="error-outline" 
        size={20} 
        style={styles.errorBannerIcon}
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
});
