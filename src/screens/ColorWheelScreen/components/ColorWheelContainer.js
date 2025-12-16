// screens/ColorWheelScreen/components/ColorWheelContainer.js
import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import PropTypes from 'prop-types';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import FullColorWheel from '../../../components/FullColorWheel';
import { styles, WHEEL_SIZE, colorWheelColors } from '../styles';

export const ColorWheelContainer = React.memo(({ 
  wheelRef,
  selectedFollowsActive,
  selectedScheme,
  baseHex,
  linked,
  onToggleLinked,
  onColorsChange,
  onHexChange,
  onActiveHandleChange,
  onOpenCamera,
  onOpenGallery,
}) => {
  // Always use FullColorWheel - no fallback needed
  const wheelProps = {
    ref: wheelRef,
    scheme: selectedScheme,
    initialHex: baseHex,
    selectedFollowsActive: selectedFollowsActive,
    linked,
    onToggleLinked, // PROP FIX: Pass onToggleLinked to FullColorWheel
    onColorsChange,
    onHexChange,
    onActiveHandleChange,
  };
  
  return (
    <View style={styles.wheelContainer}>
      <FullColorWheel {...wheelProps} />

      <View style={styles.cameraButtonsContainer}>
        <TouchableOpacity 
          onPress={onOpenCamera}
          style={[styles.cameraButton, styles.cameraButtonSpacing]}
          accessibilityRole="button"
          accessibilityLabel="Take photo to extract colors"
        >
          <MaterialIcons name="photo-camera" size={24} color={colorWheelColors.iconPrimary} />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={onOpenGallery}
          style={styles.cameraButton}
          accessibilityRole="button"
          accessibilityLabel="Choose photo from gallery to extract colors"
        >
          <Feather name="image" size={24} color={colorWheelColors.iconPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// PropTypes for better development experience and documentation
ColorWheelContainer.propTypes = {
  wheelRef: PropTypes.object,
  selectedFollowsActive: PropTypes.bool,
  selectedScheme: PropTypes.string.isRequired,
  baseHex: PropTypes.string.isRequired,
  linked: PropTypes.bool,
  onToggleLinked: PropTypes.func,
  onColorsChange: PropTypes.func.isRequired,
  onHexChange: PropTypes.func.isRequired,
  onActiveHandleChange: PropTypes.func,
  onOpenCamera: PropTypes.func.isRequired,
  onOpenGallery: PropTypes.func.isRequired,
};

ColorWheelContainer.defaultProps = {
  wheelRef: null,
  selectedFollowsActive: true,
  linked: true,
  onToggleLinked: () => {},
  onActiveHandleChange: () => {},
};
