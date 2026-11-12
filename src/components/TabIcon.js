// components/TabIcon.js - Tab bar icons (vector icons with emoji fallback for unknown tabs)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

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

const ICON_LIBRARIES = { MaterialIcons, Ionicons };

const TAB_ICONS = {
  Community: {
    focused: { name: 'compass', library: 'Ionicons' },
    unfocused: { name: 'compass-outline', library: 'Ionicons' }
  },
  ColorWheel: {
    focused: { name: 'color-filter', library: 'Ionicons' },
    unfocused: { name: 'color-filter-outline', library: 'Ionicons' }
  },
  Boards: {
    focused: { name: 'albums', library: 'Ionicons' },
    unfocused: { name: 'albums-outline', library: 'Ionicons' }
  },
  Guide: {
    focused: { name: 'book', library: 'Ionicons' },
    unfocused: { name: 'book-outline', library: 'Ionicons' }
  },
  Profile: {
    focused: { name: 'person', library: 'MaterialIcons' },
    unfocused: { name: 'person-outline', library: 'MaterialIcons' }
  },
  Settings: {
    // 'settings-outline' only exists in Ionicons, not MaterialIcons
    focused: { name: 'settings', library: 'Ionicons' },
    unfocused: { name: 'settings-outline', library: 'Ionicons' }
  },
};

const TabIcon = React.memo(({ name, focused, size = 24, color = '#666' }) => {
  const iconData = TAB_ICONS[name];
  const iconConfig = iconData ? (focused ? iconData.focused : iconData.unfocused) : null;
  const IconComponent = iconConfig ? ICON_LIBRARIES[iconConfig.library] : null;

  if (IconComponent) {
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

  // Unknown tab name — fallback to simple dot
  return (
    <View style={styles.iconContainer}>
      <Text
        style={[styles.icon, { fontSize: size, color }]}
        accessibilityRole="image"
        accessibilityLabel={`${name} tab ${focused ? 'selected' : 'unselected'}`}
      >
        {focused ? '●' : '○'}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    textAlign: 'center',
  },
});

export default TabIcon;
