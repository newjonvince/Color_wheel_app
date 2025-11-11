// LoginHeader.js
import React from 'react';
import { View, Image, Text } from 'react-native';
import { optimizedStyles as styles } from '../styles';

const LOGO = require('../../../../assets/icon.png'); // Verified: correct path to root/assets/icon.png

export default function LoginHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.logoContainer}>
        <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
      </View>
      <Text style={styles.title}>Fashion Color Wheel</Text>
      <Text style={styles.subtitle}>Discover perfect color combinations</Text>
    </View>
  );
}

// Named export for backward compatibility
export { LoginHeader };
