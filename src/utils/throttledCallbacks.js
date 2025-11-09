// utils/throttledCallbacks.js - Throttling utilities for performance optimization
// Provides throttled and debounced callback wrappers for color wheel updates

import { useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for throttling expensive callback functions
 * Provides immediate visual feedback while throttling heavy operations
 */
export const useThrottledCallbacks = ({
  onColorsChange,
  onHexChange,
  selectedFollowsActive = true,
  throttleFps = 30,
  immediateFps = 60
}) => {
  const throttleMs = 1000 / throttleFps;
  const immediateMs = 1000 / immediateFps;
  
  // Refs for tracking timing
  const lastPaletteEmit = useRef(0);
  const lastSelectedEmit = useRef(0);
  const pendingPaletteUpdate = useRef(null);
  const pendingSelectedUpdate = useRef(null);
  const isGestureActive = useRef(false);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (pendingPaletteUpdate.current) {
        clearTimeout(pendingPaletteUpdate.current);
      }
      if (pendingSelectedUpdate.current) {
        clearTimeout(pendingSelectedUpdate.current);
      }
    };
  }, []);

  /**
   * Throttled color palette callback
   * Updates immediately during gesture start/end, throttled during movement
   */
  const throttledColorsChange = useCallback((colors, isImmediate = false) => {
    if (!onColorsChange) return;

    const now = Date.now();
    
    if (isImmediate || now - lastPaletteEmit.current >= throttleMs) {
      // Immediate update
      onColorsChange(colors);
      lastPaletteEmit.current = now;
      
      // Clear any pending update
      if (pendingPaletteUpdate.current) {
        clearTimeout(pendingPaletteUpdate.current);
        pendingPaletteUpdate.current = null;
      }
    } else {
      // Schedule throttled update
      if (pendingPaletteUpdate.current) {
        clearTimeout(pendingPaletteUpdate.current);
      }
      
      const delay = throttleMs - (now - lastPaletteEmit.current);
      pendingPaletteUpdate.current = setTimeout(() => {
        onColorsChange(colors);
        lastPaletteEmit.current = Date.now();
        pendingPaletteUpdate.current = null;
      }, Math.max(0, delay));
    }
  }, [onColorsChange, throttleMs]);

  /**
   * Smart hex change callback with selectedFollowsActive logic
   * Provides immediate feedback for selected color preview
   */
  const smartHexChange = useCallback((colors, activeIndex, isImmediate = false) => {
    if (!onHexChange || !colors || colors.length === 0) return;

    // Determine if we should update based on selectedFollowsActive
    const shouldUpdate = selectedFollowsActive 
      ? true // Update on any handle movement when following active
      : activeIndex === 0; // Only update when base handle (index 0) moves

    if (!shouldUpdate) return;

    const selectedIdx = selectedFollowsActive 
      ? Math.max(0, Math.min(activeIndex, colors.length - 1))
      : 0;
    
    const selectedColor = colors[selectedIdx];
    const now = Date.now();
    
    if (isImmediate || now - lastSelectedEmit.current >= immediateMs) {
      // Immediate update for responsive preview
      onHexChange(selectedColor);
      lastSelectedEmit.current = now;
      
      // Clear any pending update
      if (pendingSelectedUpdate.current) {
        clearTimeout(pendingSelectedUpdate.current);
        pendingSelectedUpdate.current = null;
      }
    } else {
      // Schedule immediate update (for smooth preview)
      if (pendingSelectedUpdate.current) {
        clearTimeout(pendingSelectedUpdate.current);
      }
      
      const delay = immediateMs - (now - lastSelectedEmit.current);
      pendingSelectedUpdate.current = setTimeout(() => {
        onHexChange(selectedColor);
        lastSelectedEmit.current = Date.now();
        pendingSelectedUpdate.current = null;
      }, Math.max(0, delay));
    }
  }, [onHexChange, selectedFollowsActive, immediateMs]);

  /**
   * Combined callback for color wheel updates
   * Handles both palette and selected color with appropriate throttling
   */
  const handleColorUpdate = useCallback((colors, activeIndex = 0, isImmediate = false) => {
    throttledColorsChange(colors, isImmediate);
    smartHexChange(colors, activeIndex, isImmediate);
  }, [throttledColorsChange, smartHexChange]);

  /**
   * Gesture lifecycle callbacks
   */
  const onGestureStart = useCallback((colors, activeIndex = 0) => {
    isGestureActive.current = true;
    handleColorUpdate(colors, activeIndex, true); // Immediate update on start
  }, [handleColorUpdate]);

  const onGestureChange = useCallback((colors, activeIndex = 0) => {
    handleColorUpdate(colors, activeIndex, false); // Throttled during movement
  }, [handleColorUpdate]);

  const onGestureEnd = useCallback((colors, activeIndex = 0) => {
    isGestureActive.current = false;
    
    // Clear any pending updates and force final state
    if (pendingPaletteUpdate.current) {
      clearTimeout(pendingPaletteUpdate.current);
      pendingPaletteUpdate.current = null;
    }
    if (pendingSelectedUpdate.current) {
      clearTimeout(pendingSelectedUpdate.current);
      pendingSelectedUpdate.current = null;
    }
    
    handleColorUpdate(colors, activeIndex, true); // Immediate final update
  }, [handleColorUpdate]);

  /**
   * Force immediate update (useful for external triggers)
   */
  const forceUpdate = useCallback((colors, activeIndex = 0) => {
    handleColorUpdate(colors, activeIndex, true);
  }, [handleColorUpdate]);

  return {
    // Individual callbacks
    throttledColorsChange,
    smartHexChange,
    
    // Combined callback
    handleColorUpdate,
    
    // Gesture lifecycle
    onGestureStart,
    onGestureChange,
    onGestureEnd,
    
    // Utilities
    forceUpdate,
    isGestureActive: () => isGestureActive.current
  };
};

/**
 * Simple throttle function for general use
 */
export const throttle = (func, delay) => {
  let timeoutId;
  let lastExecTime = 0;
  
  return function (...args) {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
};

/**
 * Debounce function for final state updates
 */
export const debounce = (func, delay) => {
  let timeoutId;
  
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};

/**
 * RequestAnimationFrame-based throttling for smooth UI updates
 */
export const useRAFThrottle = (callback) => {
  const rafId = useRef(null);
  const lastArgs = useRef(null);

  const throttledCallback = useCallback((...args) => {
    lastArgs.current = args;
    
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(() => {
        if (lastArgs.current) {
          callback(...lastArgs.current);
        }
        rafId.current = null;
      });
    }
  }, [callback]);

  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return throttledCallback;
};

/**
 * Higher-order component for adding throttling to existing color wheels
 */
export const withThrottledCallbacks = (WrappedComponent, options = {}) => {
  return React.forwardRef((props, ref) => {
    const {
      throttleFps = 30,
      immediateFps = 60,
      ...otherOptions
    } = options;

    const {
      onGestureStart,
      onGestureChange,
      onGestureEnd,
    } = useThrottledCallbacks({
      onColorsChange: props.onColorsChange,
      onHexChange: props.onHexChange,
      selectedFollowsActive: props.selectedFollowsActive,
      throttleFps,
      immediateFps,
      ...otherOptions
    });

    // Override the original callbacks with throttled versions
    const enhancedProps = {
      ...props,
      onColorsChange: onGestureChange,
      onHexChange: undefined, // Handled internally by throttled logic
      // Add gesture lifecycle props if the component supports them
      onGestureStart,
      onGestureEnd,
    };

    return <WrappedComponent ref={ref} {...enhancedProps} />;
  });
};

export default {
  useThrottledCallbacks,
  throttle,
  debounce,
  useRAFThrottle,
  withThrottledCallbacks
};
