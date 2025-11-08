// screens/ColorWheelScreen/components/ColorControls.js
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { styles } from '../styles';

export const ColorControls = React.memo(({ 
  linked,
  selectedFollowsActive,
  onToggleLinked,
  onToggleSelectedFollowsActive,
  onReset,
  onRandomize,
}) => {
  return (
    <View style={styles.controlsContainer}>
      <View style={styles.controlsRow}>
        <Pressable 
          onPress={onToggleLinked}
          style={[
            styles.toggleButton,
            linked ? styles.linkedButtonActive : styles.linkedButtonInactive
          ]}
          accessibilityRole="switch"
          accessibilityState={{ checked: linked }}
          accessibilityLabel="Toggle color linking"
        >
          <Text style={styles.buttonText}>{linked ? 'Linked' : 'Unlinked'}</Text>
        </Pressable>

        <Pressable 
          onPress={onToggleSelectedFollowsActive}
          style={[
            styles.followsActiveButton,
            selectedFollowsActive 
              ? styles.followsActiveButtonActive 
              : styles.followsActiveButtonInactive
          ]}
          accessibilityRole="switch"
          accessibilityState={{ checked: selectedFollowsActive }}
          accessibilityLabel="Toggle selected color follows active handle"
        >
          <Text style={styles.buttonText}>
            {selectedFollowsActive ? 'Selected = Active Handle' : 'Selected = Handle #1'}
          </Text>
        </Pressable>

        <View style={styles.actionButtonsContainer}>
          <Pressable 
            onPress={onReset} 
            style={[styles.actionButton, styles.actionButtonSpacing]}
            accessibilityRole="button"
            accessibilityLabel="Reset color scheme"
          >
            <Text>Reset</Text>
          </Pressable>
          <Pressable 
            onPress={onRandomize} 
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel="Generate random colors"
          >
            <Text>Randomize</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});
