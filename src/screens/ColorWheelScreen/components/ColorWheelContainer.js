// screens/ColorWheelScreen/components/ColorWheelContainer.js
import React from 'react';
import { View } from 'react-native';
import PropTypes from 'prop-types';

import { styles, WHEEL_SIZE } from '../styles';
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
};

ColorWheelContainer.displayName = 'ColorWheelContainer';
