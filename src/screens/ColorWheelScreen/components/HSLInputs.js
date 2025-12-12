// screens/ColorWheelScreen/components/HSLInputs.js
import React, { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import PropTypes from 'prop-types';
import { debounce } from '../../../utils/throttledCallbacks';
import { LAYOUT } from '../../../constants/layout';

// ✅ CIRCULAR DEPENDENCY FIX: Lazy load expoConfigHelper to prevent crash on module initialization
let _isDebugModeValue = null;
const getIsDebugMode = () => {
  if (_isDebugModeValue === null) {
    try {
      const helper = require('../../../utils/expoConfigHelper');
      _isDebugModeValue = helper.isDebugMode ? helper.isDebugMode() : false;
    } catch (error) {
      console.warn('HSLInputs: expoConfigHelper load failed', error?.message);
      _isDebugModeValue = false;
    }
  }
  return _isDebugModeValue;
};
const IS_DEBUG_MODE = () => getIsDebugMode();

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
  const debouncedLiveUpdate = useRef(null);
  
  // ✅ Initialize debounce with safety checks
  if (!debouncedLiveUpdate.current) {
    try {
      const debouncedFn = debounce((component, value, wheelRef) => {
        if (onLiveUpdate && typeof onLiveUpdate === 'function') {
          try {
            onLiveUpdate(component, value, wheelRef);
          } catch (error) {
            console.error('❌ Error in debounced live update:', error);
          }
        }
      }, LAYOUT.DEBOUNCE_MS); // Configurable debounce - balance between responsiveness and performance
      
      debouncedLiveUpdate.current = debouncedFn;
    } catch (error) {
      console.error('❌ Failed to create debounced function:', error);
      // Fallback to direct call without debounce
      debouncedLiveUpdate.current = (component, value, wheelRef) => {
        if (onLiveUpdate && typeof onLiveUpdate === 'function') {
          try {
            onLiveUpdate(component, value, wheelRef);
          } catch (error) {
            console.error('❌ Error in fallback live update:', error);
          }
        }
      };
    }
  }

  const handleChangeText = useCallback((component, value) => {
    // Immediate UI update (no debounce)
    onUpdateInput(component, value);
    
    // Debounced live update to color wheel (performance optimization)
    if (debouncedLiveUpdate.current) {
      debouncedLiveUpdate.current(component, value, wheelRef);
    }
  }, [onUpdateInput, wheelRef]);

  // ✅ MEMORY LEAK FIX: Proper debounce cleanup on unmount
  useEffect(() => {
    return () => {
      const debouncedFn = debouncedLiveUpdate.current;
      if (debouncedFn && typeof debouncedFn.cancel === 'function') {
        try {
          debouncedFn.cancel(); // ✅ Use the actual cancel method
        } catch (error) {
          console.warn('❌ Failed to cleanup debounced function:', error);
        }
      }
    };
  }, []);

  const handleInputFocus = useCallback((component) => {
    isInputFocused.current = true;
    
    // ✅ SAFER: Check if wheel has gesture control methods
    const wheel = wheelRef?.current;
    if (wheel && typeof wheel.setGesturesEnabled === 'function') {
      try {
        wheel.setGesturesEnabled(false);
        if (IS_DEBUG_MODE()) {
          console.log(`🎯 HSL input ${component} focused - wheel gestures disabled`);
        }
      } catch (error) {
        console.warn('Failed to disable wheel gestures:', error);
      }
    } else if (IS_DEBUG_MODE()) {
      console.log(`🎯 HSL input ${component} focused - wheel gesture control not available`);
    }
  }, [wheelRef]);

  const handleInputBlur = useCallback((component) => {
    isInputFocused.current = false;
    
    // ✅ SAFER: Check if wheel has gesture control methods
    const wheel = wheelRef?.current;
    if (wheel && typeof wheel.setGesturesEnabled === 'function') {
      try {
        wheel.setGesturesEnabled(true);
        if (IS_DEBUG_MODE()) {
          console.log(`🎯 HSL input ${component} blurred - wheel gestures re-enabled`);
        }
      } catch (error) {
        console.warn('Failed to re-enable wheel gestures:', error);
      }
    }
    
    // Apply the input changes
    onApplyInputs();
    
    if (IS_DEBUG_MODE() && !wheel?.setGesturesEnabled) {
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
