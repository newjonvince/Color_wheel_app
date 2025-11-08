// hooks/useColorWheelRetry.js - ColorWheel retry logic
import { useState, useCallback } from 'react';

export const useColorWheelRetry = (Updates) => {
  const [wheelReloadNonce, setWheelReloadNonce] = useState(0);

  const retryLoadColorWheel = useCallback(async () => {
    let isCancelled = false;
    
    try {
      const mod = await import('../screens/ColorWheelScreen');
      if (!isCancelled && mod?.default) {
        // Update the global ColorWheelScreen reference
        global.ColorWheelScreen = mod.default;
        setWheelReloadNonce((n) => n + 1);
        return true;
      }
    } catch (importError) {
      if (__DEV__) console.warn('ColorWheel import failed:', importError);
    }
    
    // Fallback to app reload if import fails
    if (!isCancelled && Updates) {
      try { 
        await Updates.reloadAsync(); 
      } catch (reloadError) {
        if (__DEV__) console.warn('App reload failed:', reloadError);
      }
    }
    
    // Return cleanup function
    return () => {
      isCancelled = true;
    };
  }, [Updates]);

  return {
    wheelReloadNonce,
    retryLoadColorWheel,
  };
};
