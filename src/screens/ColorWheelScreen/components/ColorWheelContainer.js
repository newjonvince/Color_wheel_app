// screens/ColorWheelScreen/components/ColorWheelContainer.js
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import FullColorWheel from '../../../components/FullColorWheel';
import { styles, WHEEL_SIZE } from '../styles';

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
      <FullColorWheel
        ref={wheelRef}
        selectedFollowsActive={selectedFollowsActive}
        size={WHEEL_SIZE}
        scheme={selectedScheme}
        initialHex={baseHex}
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
          <MaterialIcons name="photo-camera" size={24} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={onOpenGallery}
          style={styles.cameraButton}
          accessibilityRole="button"
          accessibilityLabel="Choose photo from gallery to extract colors"
        >
          <Feather name="image" size={24} color="#333" />
        </TouchableOpacity>
      </View>
    </View>
  );
});
