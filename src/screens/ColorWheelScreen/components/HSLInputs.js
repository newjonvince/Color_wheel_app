// screens/ColorWheelScreen/components/HSLInputs.js
import React from 'react';
import { View, Text, TextInput, Platform } from 'react-native';
import { styles } from '../styles';

export const HSLInputs = React.memo(({ 
  hslInputs,
  onUpdateInput,
  onLiveUpdate,
  onApplyInputs,
  wheelRef,
}) => {
  const handleChangeText = (component, value) => {
    onUpdateInput(component, value);
    onLiveUpdate(wheelRef, component, value);
  };

  return (
    <View style={styles.hslContainer}>
      <View style={[styles.hslInputContainer, styles.hslInputSpacing]}>
        <Text style={styles.hslLabel}>H</Text>
        <TextInput
          value={hslInputs.h}
          onChangeText={(v) => handleChangeText('h', v)}
          onBlur={onApplyInputs}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
          style={styles.hslInput}
          placeholder="0–360"
          accessibilityLabel="Hue value, 0 to 360 degrees"
          maxLength={3}
        />
      </View>
      
      <View style={[styles.hslInputContainer, styles.hslInputSpacingCenter]}>
        <Text style={styles.hslLabel}>S (%)</Text>
        <TextInput
          value={hslInputs.s}
          onChangeText={(v) => handleChangeText('s', v)}
          onBlur={onApplyInputs}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
          style={styles.hslInput}
          placeholder="0–100"
          accessibilityLabel="Saturation percentage, 0 to 100"
          maxLength={3}
        />
      </View>
      
      <View style={[styles.hslInputContainer, styles.hslInputSpacingLeft]}>
        <Text style={styles.hslLabel}>L (%)</Text>
        <TextInput
          value={hslInputs.l}
          onChangeText={(v) => handleChangeText('l', v)}
          onBlur={onApplyInputs}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
          style={styles.hslInput}
          placeholder="0–100"
          accessibilityLabel="Lightness percentage, 0 to 100"
          maxLength={3}
        />
      </View>
    </View>
  );
});
