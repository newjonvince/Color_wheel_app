// LoginHeader.js
import React, { useMemo } from 'react';
import { View, Image, Text, useWindowDimensions } from 'react-native';
import { optimizedStyles as styles } from '../styles';

const LoginHeader = React.memo(() => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 400; // phones vs tablets/split-view

  const logoSource = useMemo(
    () =>
      isSmallScreen
        ? require('../../../../assets/icon.png') // placeholder for small asset
        : require('../../../../assets/icon.png'),
    [isSmallScreen]
  );

  return (
    <View style={styles.header}>
      <View style={styles.logoContainer}>
        <Image
          source={logoSource}
          style={styles.logoImage}
          resizeMode="contain"
          fadeDuration={200}
          loadingIndicatorSource={null}
        />
      </View>
      <Text style={styles.title}>Fashion Color Wheel</Text>
      <Text style={styles.subtitle}>Discover perfect color combinations</Text>
    </View>
  );
});

LoginHeader.displayName = 'LoginHeader';

export default LoginHeader;
export { LoginHeader };
