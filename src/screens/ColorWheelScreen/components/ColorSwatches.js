// screens/ColorWheelScreen/components/ColorSwatches.js
// The palette as one contiguous bar (Canva-style). Tap a segment to make that handle active.
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import PropTypes from 'prop-types';
import { styles } from '../styles';

export const ColorSwatches = React.memo(({ schemeColors, activeIdx, onSwatchPress }) => (
  <View>
    <View style={styles.paletteBar}>
      {schemeColors.map((color, index) => (
        <Pressable
          key={`${index}-${color}`}
          style={[styles.paletteSegment, { backgroundColor: color }]}
          onPress={() => onSwatchPress?.(color, index)}
          accessibilityRole="button"
          accessibilityLabel={`Color ${index + 1}: ${color}${index === activeIdx ? ', active' : ''}`}
          accessibilityHint="Tap to edit this color on the wheel"
        >
          {index === activeIdx && <View style={styles.paletteActiveRing} />}
        </Pressable>
      ))}
    </View>
    <View style={styles.paletteHexRow}>
      {schemeColors.map((color, index) => (
        <Text key={`${index}-${color}-hex`} style={styles.paletteHex} numberOfLines={1}>
          {String(color).toUpperCase()}
        </Text>
      ))}
    </View>
  </View>
));

ColorSwatches.propTypes = {
  schemeColors: PropTypes.arrayOf(PropTypes.string).isRequired,
  activeIdx: PropTypes.number.isRequired,
  onSwatchPress: PropTypes.func,
};

ColorSwatches.displayName = 'ColorSwatches';
