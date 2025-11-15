// LoginHeader.js
import React from 'react';
import { View, Image, Text, Dimensions } from 'react-native';
import { optimizedStyles as styles } from '../styles';

// ✅ Optimized image loading based on screen size
const { width: screenWidth } = Dimensions.get('window');
const IS_SMALL_SCREEN = screenWidth < 400; // Phones vs tablets

// Use smaller image for smaller screens to improve performance
const LOGO = IS_SMALL_SCREEN 
  ? require('../../../../assets/icon.png') // For now, same image but we can add icon-small.png later
  : require('../../../../assets/icon.png');

const LoginHeader = React.memo(() => {
  return (
    <View style={styles.header}>
      <View style={styles.logoContainer}>
        <Image 
          source={LOGO} 
          style={styles.logoImage} 
          resizeMode="contain"
          // ✅ Performance optimizations
          fadeDuration={200}
          loadingIndicatorSource={null} // Disable loading indicator for better performance
        />
      </View>
      <Text style={styles.title}>Fashion Color Wheel</Text>
      <Text style={styles.subtitle}>Discover perfect color combinations</Text>
    </View>
  );
});

LoginHeader.displayName = 'LoginHeader';

export default LoginHeader;

// Named export for backward compatibility
export { LoginHeader };
