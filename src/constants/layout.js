// constants/layout.js - Centralized layout and timing constants
// Prevents magic numbers and makes values consistent across the app

export const LAYOUT = {
  // Performance timing
  THROTTLE_FPS: 30,
  IMMEDIATE_FPS: 60,
  DEBOUNCE_MS: 300,
  
  // Animation timing
  ANIMATION_DURATION: {
    FAST: 150,
    NORMAL: 250,
    SLOW: 400,
  },
  
  // Spacing system
  SPACING: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  
  // Border radius
  BORDER_RADIUS: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 50,
  },
  
  // Component sizes
  SIZES: {
    BUTTON_HEIGHT: 44,
    INPUT_HEIGHT: 40,
    ICON_SIZE: 24,
    AVATAR_SIZE: 32,
  },
  
  // Color wheel specific
  COLOR_WHEEL: {
    MIN_SIZE: 200,
    MAX_SIZE: 400,
    DEFAULT_SIZE: 300,
    HANDLE_SIZE: 20,
    STROKE_WIDTH: 2,
  },
  
  // Touch targets
  TOUCH: {
    MIN_TARGET: 44, // iOS HIG minimum
    PADDING: 8,
  },
  
  // Z-index layers
  Z_INDEX: {
    BACKGROUND: 0,
    CONTENT: 1,
    OVERLAY: 10,
    MODAL: 100,
    TOOLTIP: 1000,
  },
};

// Responsive breakpoints
export const BREAKPOINTS = {
  SMALL: 320,
  MEDIUM: 768,
  LARGE: 1024,
};

// Common layout helpers
export const getSpacing = (size) => LAYOUT.SPACING[size] || size;
export const getBorderRadius = (size) => LAYOUT.BORDER_RADIUS[size] || size;

export default LAYOUT;
