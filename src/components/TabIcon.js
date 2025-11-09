// components/TabIcon.js - Optimized tab icons with emoji fallbacks and custom image support
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Tab icons - currently using emoji, easily replaceable with custom images
const TAB_ICONS = {
  Community: { focused: '🌍', unfocused: '🌎' },
  ColorWheel: { focused: '🌈', unfocused: '⭕' },
  Profile: { focused: '👤', unfocused: '👥' },
  Settings: { focused: '⚙️', unfocused: '🔧' },
};

const TabIcon = React.memo(({ name, focused, size = 24, color }) => {
  const iconData = TAB_ICONS[name];
  const emoji = focused ? iconData?.focused : iconData?.unfocused;
  
  return (
    <View style={styles.iconContainer}>
      <Text 
        style={[
          styles.icon, 
          { 
            fontSize: size,
            color: color // This allows the tab bar to control the color for custom images
          }
        ]}
        accessibilityRole="image"
        accessibilityLabel={`${name} tab ${focused ? 'selected' : 'unselected'}`}
      >
        {emoji || '●'}
      </Text>
    </View>
  );
});

// TODO: To use custom PNG icons instead of emojis:
// 1. Add your PNG files to assets/icons/ folder with names:
//    - community-focused.png, community-unfocused.png
//    - colorwheel-focused.png, colorwheel-unfocused.png  
//    - profile-focused.png, profile-unfocused.png
//    - settings-focused.png, settings-unfocused.png
// 2. Replace the emoji TAB_ICONS with require() statements
// 3. Use Image component instead of Text component

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    // iOS-only optimizations
    shadowColor: 'transparent', // Disable shadow for better iOS performance
  },
  icon: {
    textAlign: 'center',
    // iOS automatically handles retina displays - no additional config needed
  },
});

export default TabIcon;
