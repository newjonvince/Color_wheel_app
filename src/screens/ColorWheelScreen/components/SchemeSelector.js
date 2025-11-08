// screens/ColorWheelScreen/components/SchemeSelector.js
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { styles } from '../styles';
import { SCHEMES, getAccessibilityLabel } from '../constants';

export const SchemeSelector = React.memo(({ 
  selectedScheme, 
  onSchemeChange, 
  selectedColor 
}) => {
  return (
    <View style={styles.schemeContainer}>
      <View style={styles.schemeButtonsContainer}>
        {SCHEMES.map((name) => (
          <Pressable
            key={name}
            onPress={() => onSchemeChange(name)}
            style={[
              styles.schemeButton,
              selectedScheme === name 
                ? styles.schemeButtonActive 
                : styles.schemeButtonInactive
            ]}
            accessibilityRole="button"
            accessibilityLabel={getAccessibilityLabel(name)}
            accessibilityState={{ selected: selectedScheme === name }}
          >
            <Text style={styles.schemeButtonText}>{name}</Text>
          </Pressable>
        ))}
      </View>
      <View 
        style={[styles.selectedColorPreview, { backgroundColor: selectedColor }]}
        accessibilityLabel={`Selected color: ${selectedColor}`}
      />
    </View>
  );
});
