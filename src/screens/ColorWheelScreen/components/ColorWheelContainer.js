// screens/ColorWheelScreen/components/ColorWheelContainer.js
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import SafeColorWheel from '../../../components/SafeColorWheel';
import { styles, WHEEL_SIZE, colorWheelColors } from '../styles';

// Temporarily using SafeColorWheel instead of FullColorWheel to prevent Skia crashes

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
  return (
    <View style={styles.wheelContainer}>
      <SafeColorWheel
        scheme={selectedScheme}
        initialHex={baseHex}
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
  );
});
