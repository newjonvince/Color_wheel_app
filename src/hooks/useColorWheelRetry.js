// hooks/useColorWheelRetry.js - ColorWheel retry logic
import { useState, useCallback } from 'react';

export const useColorWheelRetry = (Updates) => {
  const [wheelReloadNonce, setWheelReloadNonce] = useState(0);
  
  // Cancellation controller for retry operations
  let retryController = null;

  const cancelRetry = useCallback(() => {
    if (retryController) {
      retryController.cancel();
      retryController = null;
    }
  }, []);

  const retryLoadColorWheel = useCallback(async () => {
    // Create new controller for this retry
    retryController = {
      isCancelled: false,
      cancel() {
        this.isCancelled = true;
      }
    };

    const controller = retryController;
    
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
