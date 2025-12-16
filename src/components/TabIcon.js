// components/TabIcon.js - Custom tab icons with emoji fallbacks
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { MaterialIcons, Feather, Ionicons } from '@expo/vector-icons';
// Safe import with fallback
let COLOR_WHEEL_CONFIG;
try {
  COLOR_WHEEL_CONFIG = require('../config/colorWheelConfig').COLOR_WHEEL_CONFIG;
} catch (error) {
  console.warn('COLOR_WHEEL_CONFIG not found, using defaults');
  COLOR_WHEEL_CONFIG = {
    ICON_COLORS: {
      focused: '#e74c3c',
      unfocused: '#7f8c8d',
    }
  };
}

// Custom icon components using vector icons instead of emojis
const TAB_ICONS = {
  Community: {
    focused: { name: 'people', library: 'MaterialIcons' },
    unfocused: { name: 'people-outline', library: 'MaterialIcons' }
  },
  ColorWheel: {
    focused: { name: 'color-palette', library: 'Ionicons' },
    unfocused: { name: 'color-palette-outline', library: 'Ionicons' }
  },
  Boards: {
    focused: { name: 'grid', library: 'Ionicons' },
    unfocused: { name: 'grid-outline', library: 'Ionicons' }
  },
  Profile: {
    focused: { name: 'person', library: 'MaterialIcons' },
    unfocused: { name: 'person-outline', library: 'MaterialIcons' }
  },
  Settings: {
    focused: { name: 'settings', library: 'MaterialIcons' },
    unfocused: { name: 'settings-outline', library: 'MaterialIcons' }
  },
};

// Emoji fallbacks (kept for compatibility)
const EMOJI_FALLBACKS = {
  Community: { focused: '', unfocused: '' },
  ColorWheel: { focused: '', unfocused: '' },
  Boards: { focused: '', unfocused: '' },
  Profile: { focused: '', unfocused: '' },
  Settings: { focused: '', unfocused: '' },
};

const TabIcon = React.memo(({ name, focused, size = 24, color = '#666' }) => {
  const iconData = TAB_ICONS[name];
  if (!iconData) {
    // Unknown tab name — fallback to emoji dot
    const emoji = focused ? '●' : '○';
    return (
      <View style={styles.iconContainer}>
        <Text style={[styles.icon, { fontSize: size, color }]}>{emoji}</Text>
      </View>
    );
  }
  
  const iconConfig = focused ? iconData.focused : iconData.unfocused;
  
  // Render vector icon if available
  if (iconConfig) {
    const IconComponent = {
      MaterialIcons,
      Feather,
      Ionicons
    }[iconConfig.library];
    
    if (IconComponent) {
      // Use configured colors safely with fallbacks
      const iconColor = focused 
        ? (COLOR_WHEEL_CONFIG?.ICON_COLORS?.focused ?? color) 
        : (COLOR_WHEEL_CONFIG?.ICON_COLORS?.unfocused ?? color);
        
      return (
        <View style={styles.iconContainer}>
          <IconComponent
            name={iconConfig.name}
            size={size}
            color={iconColor}
            accessibilityRole="image"
            accessibilityLabel={`${name} tab ${focused ? 'selected' : 'unselected'}`}
          />
        </View>
      );
    }
  }
  
  // Fallback to emoji if vector icon fails
  const emojiData = EMOJI_FALLBACKS[name];
  const emoji = focused ? emojiData?.focused : emojiData?.unfocused;
  
  return (
    <View style={styles.iconContainer}>
      <Text 
        style={[
          styles.icon, 
          { 
            fontSize: size,
            color: color
          }
        ]}
        accessibilityRole="image"
        accessibilityLabel={`${name} tab ${focused ? 'selected' : 'unselected'}`}
      >
        {emoji || (focused ? '●' : '○')}
      </Text>
    </View>
  );
});

// Production Note: Currently using emoji icons for cross-platform compatibility
// Custom PNG icons can be added by:
// 1. Adding PNG files to assets/icons/ folder
// 2. Updating iconConfig in APP_CONFIG to use 'image' library
// 3. The TabIcon component will automatically use PNG files

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
