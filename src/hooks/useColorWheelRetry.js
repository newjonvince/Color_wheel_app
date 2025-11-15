// hooks/useColorWheelRetry.js - ColorWheel retry logic
// ✅ FIX: Use React.lazy and Suspense instead of global mutation
import { useState, useCallback, useRef, lazy, Suspense } from 'react';

// ✅ SAFER: Use React.lazy for dynamic imports
const LazyColorWheelScreen = lazy(() => import('../screens/ColorWheelScreen/index'));

export const useColorWheelRetry = (Updates) => {
  const [wheelReloadNonce, setWheelReloadNonce] = useState(0);
  const [ColorWheelComponent, setColorWheelComponent] = useState(() => LazyColorWheelScreen);
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
      // ✅ FIX: Create new lazy component instead of global mutation
      const newLazyComponent = lazy(() => import('../screens/ColorWheelScreen/index'));
      
      if (!controller.isCancelled) {
        // ✅ SAFER: Update component state instead of global
        setColorWheelComponent(() => newLazyComponent);
        setWheelReloadNonce((n) => n + 1);
        return true; // Success
      }
    } catch (importError) {
      // Always log ColorWheel import failures for production debugging
      console.warn('ColorWheel import failed:', importError);
    }
    
    // Fallback to app reload if import fails
    if (!controller.isCancelled && Updates) {
      try { 
        await Updates.reloadAsync(); 
        return true; // App reload initiated successfully
      } catch (reloadError) {
        // Always log app reload failures for production debugging
        console.warn('App reload failed:', reloadError);
      }
    }
    
    return false; // Failed to retry
  }, [Updates]);

  return {
    wheelReloadNonce,
    retryLoadColorWheel,
    cancelRetry,
    ColorWheelComponent, // ✅ Return the lazy component instead of using global
  };
};
