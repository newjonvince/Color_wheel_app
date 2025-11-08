// screens/LoginScreen/components/LoginHeader.js
import React from 'react';
import { View, Text, Image } from 'react-native';
import { styles } from '../styles';

export const LoginHeader = React.memo(() => {
  return (
    <View style={styles.header}>
      <View style={styles.logoContainer}>
        <Image 
          source={require('../../../../assets/icon.png')} 
          style={styles.logoImage}
          resizeMode="contain"
          accessibilityLabel="Fashion Color Wheel logo"
        />
      </View>
      <Text style={styles.title}>Fashion Color Wheel</Text>
      <Text style={styles.subtitle}>Discover perfect color combinations</Text>
    </View>
  );
});
