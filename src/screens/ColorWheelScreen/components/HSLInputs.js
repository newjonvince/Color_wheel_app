// screens/ColorWheelScreen/components/HSLInputs.js
import React, { useCallback, useRef, useEffect } from 'react';
import { View, Text, TextInput, Platform } from 'react-native';
import PropTypes from 'prop-types';
import { debounce } from '../../../utils/debounce';
import { styles } from '../styles';

export const HSLInputs = React.memo(({ 
  hslInputs,
  onUpdateInput,
  onLiveUpdate,
  onApplyInputs,
  wheelRef,
}) => {
  // ✅ Gesture conflict handling - disable wheel gestures when input is focused
  const inputRefs = useRef({ h: null, s: null, l: null });
  const isInputFocused = useRef(false);

  // ✅ Debounced live update to prevent excessive updates on every keypress
  const debouncedLiveUpdate = useRef(
    debounce((component, value, wheelRef) => {
      if (onLiveUpdate && typeof onLiveUpdate === 'function') {
        try {
          onLiveUpdate(component, value, wheelRef);
        } catch (error) {
          console.error('❌ Error in debounced live update:', error);
        }
      }
    }, 300) // 300ms debounce - balance between responsiveness and performance
  ).current;

  const handleChangeText = useCallback((component, value) => {
    // Immediate UI update (no debounce)
    onUpdateInput(component, value);
    
    // Debounced live update to color wheel (performance optimization)
    debouncedLiveUpdate(component, value, wheelRef);
  }, [onUpdateInput, wheelRef, debouncedLiveUpdate]);

  // ✅ Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedLiveUpdate.cancel();
    };
  }, [debouncedLiveUpdate]);

  const handleInputFocus = useCallback((component) => {
    isInputFocused.current = true;
    
    // Disable wheel gestures when text input is focused
    const wheel = wheelRef?.current;
    if (wheel?.setGesturesEnabled) {
      wheel.setGesturesEnabled(false);
    }
    
    if (__DEV__) {
      console.log(`🎯 HSL input ${component} focused - wheel gestures disabled`);
    }
  }, [wheelRef]);

  const handleInputBlur = useCallback((component) => {
    isInputFocused.current = false;
    
    // Re-enable wheel gestures when text input loses focus
    const wheel = wheelRef?.current;
    if (wheel?.setGesturesEnabled) {
      wheel.setGesturesEnabled(true);
    }
    
    // Apply the input changes
    onApplyInputs();
    
    if (__DEV__) {
      console.log(`🎯 HSL input ${component} blurred - wheel gestures enabled`);
    }
  }, [wheelRef, onApplyInputs]);

  return (
    <View style={styles.hslContainer}>
      <View style={[styles.hslInputContainer, styles.hslInputSpacing]}>
        <Text style={styles.hslLabel}>H</Text>
        <TextInput
          ref={(ref) => { inputRefs.current.h = ref; }}
          value={hslInputs.h}
          onChangeText={(v) => handleChangeText('h', v)}
          onFocus={() => handleInputFocus('h')}
          onBlur={() => handleInputBlur('h')}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
          style={styles.hslInput}
          placeholder="0–360"
          accessibilityLabel="Hue degrees, 0 to 360"
          maxLength={3}
        />
      </View>
      
      <View style={[styles.hslInputContainer, styles.hslInputSpacingCenter]}>
        <Text style={styles.hslLabel}>S (%)</Text>
        <TextInput
          ref={(ref) => { inputRefs.current.s = ref; }}
          value={hslInputs.s}
          onChangeText={(v) => handleChangeText('s', v)}
          onFocus={() => handleInputFocus('s')}
          onBlur={() => handleInputBlur('s')}
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
          ref={(ref) => { inputRefs.current.l = ref; }}
          value={hslInputs.l}
          onChangeText={(v) => handleChangeText('l', v)}
          onFocus={() => handleInputFocus('l')}
          onBlur={() => handleInputBlur('l')}
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

// ✅ PropTypes validation for development safety
HSLInputs.propTypes = {
  hslInputs: PropTypes.shape({
    h: PropTypes.string.isRequired,
    s: PropTypes.string.isRequired,
    l: PropTypes.string.isRequired,
  }).isRequired,
  onUpdateInput: PropTypes.func.isRequired,
  onLiveUpdate: PropTypes.func.isRequired,
  onApplyInputs: PropTypes.func.isRequired,
  wheelRef: PropTypes.object,
};

HSLInputs.displayName = 'HSLInputs';
