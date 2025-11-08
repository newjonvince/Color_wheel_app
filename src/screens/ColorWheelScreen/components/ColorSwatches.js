// screens/ColorWheelScreen/components/ColorSwatches.js
import React from 'react';
import { View, Text } from 'react-native';
import { styles } from '../styles';
import { getSchemeDisplayName } from '../constants';

export const ColorSwatches = React.memo(({ 
  selectedColor,
  schemeColors,
  selectedScheme,
  activeIdx,
}) => {
  const schemeTitle = getSchemeDisplayName(selectedScheme);

  return (
    <View style={styles.swatchesContainer}>
      <Text style={styles.swatchTitle}>Selected Color</Text>
      <View 
        style={[styles.selectedColorSwatch, { backgroundColor: selectedColor }]}
        accessibilityLabel={`Selected color swatch: ${selectedColor}`}
      />
      
      <Text style={[styles.swatchTitle, { marginTop: 16 }]}>
        {schemeTitle} swatches
      </Text>
      <View style={styles.schemeSwatchesContainer}>
        {schemeColors.map((color, index) => (
          <View 
            key={index}
            style={[
              styles.schemeSwatch,
              { backgroundColor: color },
              index === activeIdx 
                ? styles.schemeSwatchActive 
                : styles.schemeSwatchInactive,
              index < schemeColors.length - 1 ? styles.schemeSwatchSpacing : null
            ]}
            accessibilityLabel={`Color swatch ${index + 1}: ${color}${index === activeIdx ? ' (active)' : ''}`}
          />
        ))}
      </View>
    </View>
  );
});
