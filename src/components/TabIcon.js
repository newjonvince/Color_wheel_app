// components/TabIcon.js - Optimized tab icons with custom images
import React, { useState } from 'react';
import { Image, View, Text, StyleSheet, Platform } from 'react-native';

// Icon mappings for your custom icons
const ICON_SOURCES = {
  Community: {
    focused: require('../../assets/icons/community-focused.png'),
    unfocused: require('../../assets/icons/community-unfocused.png'),
  },
  ColorWheel: {
    focused: require('../../assets/icons/colorwheel-focused.png'),
    unfocused: require('../../assets/icons/colorwheel-unfocused.png'),
  },
  Profile: {
    focused: require('../../assets/icons/profile-focused.png'),
    unfocused: require('../../assets/icons/profile-unfocused.png'),
  },
  Settings: {
    focused: require('../../assets/icons/settings-focused.png'),
    unfocused: require('../../assets/icons/settings-unfocused.png'),
  },
};

// Fallback emoji icons (in case image loading fails)
const FALLBACK_ICONS = {
  Community: { focused: '🌍', unfocused: '🌎' },
  ColorWheel: { focused: '🌈', unfocused: '⭕' },
  Profile: { focused: '👤', unfocused: '👥' },
  Settings: { focused: '⚙️', unfocused: '🔧' },
};

const TabIcon = React.memo(({ name, focused, size = 24, color }) => {
  const iconSource = ICON_SOURCES[name];
  const [imageError, setImageError] = useState(false);
  
  if (!iconSource || imageError) {
    // Use fallback emoji if no icon source or image failed to load
    return <TabIconFallback name={name} focused={focused} />;
  }

  const imageSource = focused ? iconSource.focused : iconSource.unfocused;

  return (
    <View style={styles.iconContainer}>
      <Image
        source={imageSource}
        style={[
          styles.icon,
          {
            width: size,
            height: size,
            tintColor: color, // This allows the tab bar to control the color
          }
        ]}
        resizeMode="contain"
        // iOS optimization
        fadeDuration={0}
        // Error handling
        onError={() => {
          console.warn(`TabIcon: Failed to load image for ${name}, using fallback`);
          setImageError(true);
        }}
        // Accessibility
        accessibilityRole="image"
        accessibilityLabel={`${name} tab ${focused ? 'selected' : 'unselected'}`}
      />
    </View>
  );
});

// Error boundary fallback component
const TabIconFallback = React.memo(({ name, focused }) => {
  const fallbackIcon = FALLBACK_ICONS[name];
  const emoji = focused ? fallbackIcon?.focused : fallbackIcon?.unfocused;
  
  return (
    <View style={styles.iconContainer}>
      <Text style={styles.fallbackIcon}>{emoji || '●'}</Text>
    </View>
  );
});

// Main component with error boundary
const SafeTabIcon = (props) => {
  try {
    return <TabIcon {...props} />;
  } catch (error) {
    console.warn('TabIcon error, using fallback:', error);
    return <TabIconFallback {...props} />;
  }
};

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    // iOS-only optimizations
    shadowColor: 'transparent', // Disable shadow for better iOS performance
  },
  icon: {
    // iOS automatically handles retina displays - no additional config needed
  },
  fallbackIcon: {
    fontSize: 20,
    textAlign: 'center',
  },
});

export default SafeTabIcon;
