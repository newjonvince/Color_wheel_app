// screens/ColorWheelScreen/components/ColorSwatches.js
import React, { useCallback, useState, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import PropTypes from 'prop-types';
import { getColorName } from '../../../utils/colorNames';

let _Clipboard = null;
let _clipboardAttempted = false;
const getClipboard = () => {
  if (_clipboardAttempted) return _Clipboard;
  _clipboardAttempted = true;
  try { _Clipboard = require('expo-clipboard'); } catch (_) { _Clipboard = null; }
  return _Clipboard;
};

const TOAST_DURATION = 1500;

import { isDebugMode as IS_DEBUG_MODE } from '../../../utils/debugMode';

import { styles } from '../styles';
import { getSchemeDisplayName } from '../constants';

export const ColorSwatches = React.memo(({ 
  selectedColor,
  schemeColors,
  selectedScheme,
  activeIdx,
  onSwatchPress,
}) => {
  const schemeTitle = getSchemeDisplayName(selectedScheme);
  const [toastMsg, setToastMsg] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(TOAST_DURATION - 240),
      Animated.timing(toastOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start();
    toastTimer.current = setTimeout(() => setToastMsg(''), TOAST_DURATION);
  }, [toastOpacity]);

  const copyHex = useCallback(async (hex) => {
    try {
      const Clipboard = getClipboard();
      const upper = hex.toUpperCase();
      if (Clipboard?.setStringAsync) {
        await Clipboard.setStringAsync(upper);
      } else if (Clipboard?.setString) {
        Clipboard.setString(upper);
      }
      const name = getColorName(hex);
      showToast(`Copied ${upper}${name ? ` · ${name}` : ''}`);
    } catch (_) {
      showToast('Copy failed');
    }
  }, [showToast]);

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

  const colorName = getColorName(selectedColor);

  return (
    <View style={styles.swatchesContainer}>
      <View style={localStyles.selectedHeader}>
        <Text style={styles.swatchTitle}>Selected Color</Text>
        {colorName ? <Text style={localStyles.colorName}>{colorName}</Text> : null}
        <Text style={localStyles.hexCode}>{selectedColor?.toUpperCase()}</Text>
      </View>
      <TouchableOpacity
        style={[styles.selectedColorSwatch, { backgroundColor: selectedColor }]}
        onPress={() => handleSwatchPress(selectedColor, -1)}
        onLongPress={() => copyHex(selectedColor)}
        delayLongPress={400}
        accessibilityLabel={`Selected color ${selectedColor}. Long press to copy hex.`}
        accessibilityRole="button"
      />
      
      <Text style={[styles.swatchTitle, { marginTop: 16 }]}>
        {schemeTitle} swatches (tap to select · long press to copy)
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
            onLongPress={() => copyHex(color)}
            delayLongPress={400}
            accessibilityLabel={`Color swatch ${index + 1}: ${color}${index === activeIdx ? ' (active)' : ''}. Long press to copy.`}
            accessibilityRole="button"
            activeOpacity={0.7}
          />
        ))}
      </View>

      {toastMsg ? (
        <Animated.View style={[localStyles.toast, { opacity: toastOpacity }]}>
          <Text style={localStyles.toastText}>{toastMsg}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
});

const localStyles = StyleSheet.create({
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 6,
  },
  colorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  hexCode: {
    fontSize: 12,
    color: '#777',
    fontFamily: 'monospace',
  },
  toast: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.70)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  toastText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
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
