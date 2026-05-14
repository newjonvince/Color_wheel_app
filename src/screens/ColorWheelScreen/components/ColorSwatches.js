// screens/ColorWheelScreen/components/ColorSwatches.js
import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';

// CIRCULAR DEPENDENCY FIX: Lazy load expoConfigHelper to prevent crash on module initialization
let _isDebugModeValue = null;
const getIsDebugMode = () => {
  if (_isDebugModeValue === null) {
    try {
      const helper = require('../../../utils/expoConfigHelper');
      _isDebugModeValue = helper.isDebugMode ? helper.isDebugMode() : false;
    } catch (error) {
      console.warn('ColorSwatches: expoConfigHelper load failed', error?.message);
      _isDebugModeValue = false;
    }
  }
  return _isDebugModeValue;
};
const IS_DEBUG_MODE = () => getIsDebugMode();

import { styles } from '../styles';
import { getSchemeDisplayName } from '../constants';

export const ColorSwatches = React.memo(({ 
  selectedColor,
  schemeColors,
  selectedScheme,
  activeIdx,
  onSwatchPress, // New prop for handling swatch selection
}) => {
  const schemeTitle = getSchemeDisplayName(selectedScheme);

  // Handle swatch press with validation
  const handleSwatchPress = useCallback((color, index) => {
    if (onSwatchPress && typeof onSwatchPress === 'function') {
      try {
        onSwatchPress(color, index);
        if (IS_DEBUG_MODE()) {
          console.log(`Swatch selected: ${color} at index ${index}`);
        }
      } catch (error) {
        console.error('Error in swatch press handler:', error);
      }
    }
  }, [onSwatchPress]);

  return (
    <View style={styles.swatchesContainer}>
      <Text style={styles.swatchTitle}>Selected Color</Text>
      <TouchableOpacity
        style={[styles.selectedColorSwatch, { backgroundColor: selectedColor }]}
        onPress={() => handleSwatchPress(selectedColor, -1)} // -1 indicates selected color
        accessibilityLabel={`Selected color swatch: ${selectedColor}. Tap to select.`}
        accessibilityRole="button"
      />
      
      <Text style={[styles.swatchTitle, { marginTop: 16 }]}>
        {schemeTitle} swatches (tap to select)
      </Text>
      <View style={styles.schemeSwatchesContainer}>
        {schemeColors.map((color, index) => (
          <TouchableOpacity 
            key={index}
            style={[
              styles.schemeSwatch,
              { backgroundColor: color },
              index === activeIdx 
                ? styles.schemeSwatchActive 
                : styles.schemeSwatchInactive,
              index < schemeColors.length - 1 ? styles.schemeSwatchSpacing : null
            ]}
            onPress={() => handleSwatchPress(color, index)}
            accessibilityLabel={`Color swatch ${index + 1}: ${color}${index === activeIdx ? ' (active)' : ''}. Tap to select.`}
            accessibilityRole="button"
            activeOpacity={0.7}
          />
        ))}
      </View>
    </View>
  );
});

// PropTypes validation for development safety
ColorSwatches.propTypes = {
  selectedColor: PropTypes.string.isRequired,
  schemeColors: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedScheme: PropTypes.string.isRequired,
  activeIdx: PropTypes.number.isRequired,
  onSwatchPress: PropTypes.func, // Optional - for backward compatibility
};

ColorSwatches.displayName = 'ColorSwatches';
