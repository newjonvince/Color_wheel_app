// screens/ColorWheelScreen/components/ColorControls.js
// Compact tool pills under the wheel: link toggle, follow-active toggle, reset, random.
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import PropTypes from 'prop-types';
import { Ionicons } from '@expo/vector-icons';
import { styles, colorWheelColors } from '../styles';

const Pill = ({ icon, label, on, onPress, role = 'button', hint }) => (
  <Pressable
    onPress={onPress}
    style={[styles.toolPill, on && styles.toolPillOn]}
    accessibilityRole={role}
    accessibilityState={role === 'switch' ? { checked: !!on } : undefined}
    accessibilityLabel={label}
    accessibilityHint={hint}
  >
    <Ionicons name={icon} size={16} color={on ? '#FFFFFF' : colorWheelColors.text} />
    <Text style={[styles.toolPillText, on && styles.toolPillTextOn]}>{label}</Text>
  </Pressable>
);

export const ColorControls = React.memo(({
  linked,
  selectedFollowsActive,
  onToggleLinked,
  onToggleSelectedFollowsActive,
  onReset,
  onRandomize,
}) => (
  <View style={styles.toolsRow}>
    <Pill
      icon="link-outline"
      label="Linked"
      on={linked}
      onPress={onToggleLinked}
      role="switch"
      hint="When on, the scheme handles move together"
    />
    <Pill
      icon="eye-outline"
      label="Follow active"
      on={selectedFollowsActive}
      onPress={onToggleSelectedFollowsActive}
      role="switch"
      hint="When on, the picked color is the handle you touched last"
    />
    <Pill icon="refresh" label="Reset" onPress={onReset} hint="Rebuild the palette from the base color" />
    <Pill icon="shuffle" label="Random" onPress={onRandomize} hint="Pick a random base color" />
  </View>
));

ColorControls.propTypes = {
  linked: PropTypes.bool.isRequired,
  selectedFollowsActive: PropTypes.bool.isRequired,
  onToggleLinked: PropTypes.func.isRequired,
  onToggleSelectedFollowsActive: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  onRandomize: PropTypes.func.isRequired,
};

ColorControls.displayName = 'ColorControls';
