// config/colorWheelConfig.js - FullColorWheel configuration options

export const COLOR_WHEEL_CONFIG = {
  // FullColorWheel: Advanced Skia-based color picker with multi-handle support
  // Features: Multiple color handles, smooth animations, advanced gestures
  // Best for: Professional color selection, complex color schemes
  // Requirements: React Native Skia, Reanimated 3
  // Performance: High (GPU accelerated)
  
  // Icon configuration
  USE_VECTOR_ICONS: true, // Set to false to use emoji icons
  
  // Tab icon colors (iOS style)
  ICON_COLORS: {
    focused: '#007AFF',   // iOS blue
    unfocused: '#8E8E93', // iOS gray
  },
  
  // Performance settings
  ENABLE_ANIMATIONS: true,
  ENABLE_HAPTIC_FEEDBACK: true,
};

// Helper function to get current color wheel component
export const getColorWheelType = () => {
  return 'FullColorWheel'; // Always use FullColorWheel
};

// Helper function to get icon type
export const getIconType = () => {
  return COLOR_WHEEL_CONFIG.USE_VECTOR_ICONS ? 'vector' : 'emoji';
};
