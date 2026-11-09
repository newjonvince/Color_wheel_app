// screens/ColorWheelScreen/components/ColorWheelContainer.js
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import PropTypes from 'prop-types';
import { MaterialIcons, Feather } from '@expo/vector-icons';

import { styles, WHEEL_SIZE, colorWheelColors } from '../styles';
import FullColorWheel from '../../../components/FullColorWheel';

export const ColorWheelContainer = React.memo(({
  wheelRef = null,
  selectedFollowsActive = true,
  selectedScheme,
  baseHex,
  linked = true,
  onToggleLinked = () => {},
  onColorsChange,
  onHexChange,
  onActiveHandleChange = () => {},
  onOpenCamera,
  onOpenGallery,
}) => (
  <View style={styles.wheelContainer}>
    <FullColorWheel
      ref={wheelRef}
      size={WHEEL_SIZE}
      scheme={selectedScheme}
      initialHex={baseHex}
      selectedFollowsActive={selectedFollowsActive}
      linked={linked}
      onToggleLinked={onToggleLinked}
      onColorsChange={onColorsChange}
      onHexChange={onHexChange}
      onActiveHandleChange={onActiveHandleChange}
    />

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
));

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
