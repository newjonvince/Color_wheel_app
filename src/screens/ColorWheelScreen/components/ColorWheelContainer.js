// screens/ColorWheelScreen/components/ColorWheelContainer.js
import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, InteractionManager } from 'react-native';
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
}) => {
  // Defer mounting the wheel until initial interactions/navigation settle,
  // so the first frame of the screen stays responsive.
  const [canRenderWheel, setCanRenderWheel] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      setCanRenderWheel(true);
    });

    return () => {
      cancelled = true;
      interactionHandle?.cancel?.();
    };
  }, []);

  return (
    <View style={styles.wheelContainer}>
      {canRenderWheel ? (
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
      ) : (
        <View style={{ width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: WHEEL_SIZE / 2, backgroundColor: baseHex }} />
      )}

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
