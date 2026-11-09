// screens/ColorWheelScreen/components/SchemeSelector.js
// "Choose a palette type": a dropdown that opens a bottom sheet listing the schemes.
import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import PropTypes from 'prop-types';
import { Ionicons } from '@expo/vector-icons';
import { styles, colorWheelColors } from '../styles';
import { SCHEMES, getAccessibilityLabel, getSchemeDisplayName } from '../constants';

export const SchemeSelector = React.memo(({ selectedScheme, onSchemeChange }) => {
  const [open, setOpen] = useState(false);

  const choose = useCallback((name) => {
    setOpen(false);
    if (name !== selectedScheme) onSchemeChange(name);
  }, [onSchemeChange, selectedScheme]);

  return (
    <>
      <Pressable
        style={styles.dropdown}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Palette type: ${getSchemeDisplayName(selectedScheme)}. Tap to change.`}
      >
        <Text style={styles.dropdownText}>{getSchemeDisplayName(selectedScheme)}</Text>
        <Ionicons name="chevron-down" size={20} color={colorWheelColors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Palette type</Text>
            <ScrollView bounces={false}>
              {SCHEMES.map((name) => {
                const on = name === selectedScheme;
                return (
                  <Pressable
                    key={name}
                    style={styles.sheetRow}
                    onPress={() => choose(name)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <View>
                      <Text style={[styles.sheetRowText, on && styles.sheetRowTextOn]}>
                        {getSchemeDisplayName(name)}
                      </Text>
                      <Text style={styles.sheetRowHint}>{getAccessibilityLabel(name)}</Text>
                    </View>
                    {on && <Ionicons name="checkmark" size={22} color={colorWheelColors.text} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
});

SchemeSelector.propTypes = {
  selectedScheme: PropTypes.string.isRequired,
  onSchemeChange: PropTypes.func.isRequired,
};

SchemeSelector.displayName = 'SchemeSelector';
