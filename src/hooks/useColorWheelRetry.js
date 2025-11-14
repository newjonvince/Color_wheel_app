// hooks/useColorWheelRetry.js - ColorWheel retry logic
import { useState, useCallback, useRef } from 'react';

export const useColorWheelRetry = (Updates) => {
  const [wheelReloadNonce, setWheelReloadNonce] = useState(0);
  const retryControllerRef = useRef(null);

  const cancelRetry = useCallback(() => {
    const controller = retryControllerRef.current;
    if (controller) {
      controller.isCancelled = true;
      retryControllerRef.current = null;
    }
  }, []);

  const retryLoadColorWheel = useCallback(async () => {
    // Create new controller for this retry
    const controller = { isCancelled: false };
    retryControllerRef.current = controller;
    
    try {
      const mod = await import('../screens/ColorWheelScreen/index');
      if (!controller.isCancelled && mod?.default) {
        // Update the global ColorWheelScreen reference
        global.ColorWheelScreen = mod.default;
        setWheelReloadNonce((n) => n + 1);
        return true; // Success
      }
    } catch (importError) {
      if (__DEV__) console.warn('ColorWheel import failed:', importError);
    }
    
    // Fallback to app reload if import fails
    if (!controller.isCancelled && Updates) {
      try { 
        await Updates.reloadAsync(); 
        return true; // App reload initiated successfully
      } catch (reloadError) {
        if (__DEV__) console.warn('App reload failed:', reloadError);
      }
    }
    
    return false; // Failed to retry
  }, [Updates]);

  return {
    wheelReloadNonce,
    retryLoadColorWheel,
    cancelRetry,
  };
};
