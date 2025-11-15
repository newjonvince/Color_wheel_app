// utils/dependencyChecker.js - Verify dependencies for FullColorWheel
import { Platform } from 'react-native';

// Check if all required dependencies are available for FullColorWheel
export const checkFullColorWheelDependencies = () => {
  const results = {
    skia: false,
    reanimated: false,
    gestureHandler: false,
    platform: Platform.OS,
    errors: [],
    warnings: []
  };

  // Check React Native Skia
  try {
    const Skia = require('@shopify/react-native-skia');
    if (Skia && Skia.Canvas) {
      results.skia = true;
    } else {
      results.errors.push('Skia Canvas not available');
    }
  } catch (error) {
    results.errors.push(`Skia import failed: ${error.message}`);
  }

  // Check React Native Reanimated
  try {
    const Reanimated = require('react-native-reanimated');
    if (Reanimated && Reanimated.useSharedValue) {
      results.reanimated = true;
    } else {
      results.errors.push('Reanimated useSharedValue not available');
    }
  } catch (error) {
    results.errors.push(`Reanimated import failed: ${error.message}`);
  }

  // Check React Native Gesture Handler
  try {
    const GestureHandler = require('react-native-gesture-handler');
    if (GestureHandler && GestureHandler.Gesture) {
      results.gestureHandler = true;
    } else {
      results.errors.push('Gesture Handler not available');
    }
  } catch (error) {
    results.errors.push(`Gesture Handler import failed: ${error.message}`);
  }

  // Platform-specific checks
  if (Platform.OS === 'ios') {
    results.warnings.push('iOS: Ensure Skia is properly linked in Xcode');
  } else if (Platform.OS === 'android') {
    results.warnings.push('Android: Ensure Skia native libraries are included');
  }

  // Overall compatibility
  results.compatible = results.skia && results.reanimated && results.gestureHandler;

  return results;
};

// Verify FullColorWheel compatibility
export const verifyFullColorWheelCompatibility = () => {
  const check = checkFullColorWheelDependencies();
  
  if (check.compatible) {
    return {
      status: 'ready',
      message: 'FullColorWheel ready - all dependencies available',
      details: check
    };
  } else {
    return {
      status: 'error',
      message: `FullColorWheel dependencies missing: ${check.errors.join(', ')}`,
      details: check
    };
  }
};

// Runtime dependency verification for FullColorWheel
export const verifyRuntimeDependencies = () => {
  try {
    const fullCheck = checkFullColorWheelDependencies();
    
    // Always log dependency status for production debugging
    console.log('🔍 FullColorWheel Dependency Check:');
    console.log('Status:', fullCheck.compatible ? '✅ Ready' : '❌ Issues found');
    
    if (fullCheck.errors.length > 0) {
      console.error('FullColorWheel errors:', fullCheck.errors);
    }
    
    if (fullCheck.warnings.length > 0) {
      console.warn('FullColorWheel warnings:', fullCheck.warnings);
    }
    
    return fullCheck;
  } catch (error) {
    console.error('Dependency check failed:', error);
    return { compatible: false, errors: [error.message], warnings: [] };
  }
};
