// HexInput.js — Hex code text input for the color wheel
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import PropTypes from 'prop-types';

const HEX_REGEX = /^[0-9A-Fa-f]{6}$/;

export const HexInput = React.memo(({ selectedColor, onHexChange, wheelRef }) => {
  const [localValue, setLocalValue] = useState(
    selectedColor ? selectedColor.replace('#', '') : 'FF0000'
  );
  const isFocused = useRef(false);

  // Sync from external color changes (wheel drag / swatch press)
  useEffect(() => {
    if (!isFocused.current && selectedColor) {
      setLocalValue(selectedColor.replace('#', '').toUpperCase());
    }
  }, [selectedColor]);

  const handleFocus = useCallback(() => {
    isFocused.current = true;
    const wheel = wheelRef?.current;
    if (wheel && typeof wheel.setGesturesEnabled === 'function') {
      try { wheel.setGesturesEnabled(false); } catch (_) {}
    }
  }, [wheelRef]);

  const handleBlur = useCallback(() => {
    isFocused.current = false;
    const wheel = wheelRef?.current;
    if (wheel && typeof wheel.setGesturesEnabled === 'function') {
      try { wheel.setGesturesEnabled(true); } catch (_) {}
    }
    // Apply on blur even if not 6 chars yet — show no-op
    if (HEX_REGEX.test(localValue)) {
      onHexChange?.('#' + localValue.toUpperCase());
    }
  }, [localValue, onHexChange, wheelRef]);

  const handleChangeText = useCallback((raw) => {
    // Strip # in case user pastes "#FF6B6B"
    const clean = raw.replace(/[^0-9A-Fa-f#]/g, '').replace('#', '').slice(0, 6).toUpperCase();
    setLocalValue(clean);
    if (HEX_REGEX.test(clean)) {
      onHexChange?.('#' + clean);
    }
  }, [onHexChange]);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>HEX</Text>
      <View style={styles.inputWrapper}>
        <Text style={styles.hash}>#</Text>
        <TextInput
          value={localValue}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[styles.input, HEX_REGEX.test(localValue) ? null : styles.inputError]}
          placeholder="FF6B6B"
          placeholderTextColor="#aaa"
          maxLength={6}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          textContentType="none"
          autoComplete="off"
          keyboardType={Platform.OS === 'ios' ? 'default' : 'visible-password'}
          accessibilityLabel="Hex color code input"
        />
        <View style={[styles.preview, { backgroundColor: HEX_REGEX.test(localValue) ? '#' + localValue : '#ccc' }]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginHorizontal: 8,
  },
  label: {
    fontSize: 12,
    color: '#555',
    width: 32,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hash: {
    fontSize: 14,
    color: '#888',
    marginRight: 2,
  },
  input: {
    flex: 1,
    fontSize: 14,
    letterSpacing: 1,
    color: '#222',
    padding: 0,
  },
  inputError: {
    color: '#c62828',
  },
  preview: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#ddd',
    marginLeft: 8,
  },
});

HexInput.propTypes = {
  selectedColor: PropTypes.string.isRequired,
  onHexChange: PropTypes.func.isRequired,
  wheelRef: PropTypes.object,
};

HexInput.displayName = 'HexInput';
