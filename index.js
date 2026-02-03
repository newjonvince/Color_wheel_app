// index.js - App entry point with performance optimizations
// CRASH FIX: Use require() instead of import to control execution order.
// ES6 imports are hoisted and run before any other code, so we use require()
// to ensure error handling is set up FIRST, before any native modules load.

// Step 1: Set up global error handler FIRST (before any native module access)
try {
  const ErrorUtils = global?.ErrorUtils;
  if (ErrorUtils?.setGlobalHandler) {
    const originalHandler = ErrorUtils.getGlobalHandler?.();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      try {
        // Log to console (visible in Xcode/device logs)
        console.error('[FATAL JS ERROR]', {
          isFatal,
          message: error?.message || String(error),
          name: error?.name,
          stack: error?.stack?.substring?.(0, 2000) || 'no stack',
          timestamp: new Date().toISOString(),
        });
      } catch (_) {
        // Ignore logging failures
      }
      try {
        originalHandler?.(error, isFatal);
      } catch (_) {
        // Ignore handler failures
      }
    });
    console.log('[STARTUP] ErrorUtils handler installed');
  }
} catch (e) {
  console.warn('[STARTUP] ErrorUtils setup failed:', e?.message);
}

// Step 2: Enable react-native-screens (after error handler is ready)
try {
  const { enableScreens } = require('react-native-screens');
  enableScreens(true);
  console.log('[STARTUP] react-native-screens enabled');
} catch (e) {
  console.warn('[STARTUP] react-native-screens failed:', e?.message);
}

// Step 2.5: CRASH FIX - Initialize gesture handler BEFORE App.js import
// This must happen at the entry point, before any component uses gestures
// Wrapped in try-catch to prevent native crashes from killing the app
try {
  require('react-native-gesture-handler');
  console.log('[STARTUP] react-native-gesture-handler initialized');
} catch (e) {
  console.warn('[STARTUP] react-native-gesture-handler failed:', e?.message);
}

// Step 2.6: CRASH FIX - Catch font loading errors from @expo/vector-icons
// FontLoaderModule can crash during initialization if font files are missing/corrupted
// This prevents "registerFont" crashes from killing the app
try {
  // Intercept font loading errors by pre-loading vector icons module
  const vectorIcons = require('@expo/vector-icons');
  console.log('[STARTUP] @expo/vector-icons loaded successfully');
} catch (e) {
  console.warn('[STARTUP] @expo/vector-icons failed to load:', e?.message);
  console.warn('[STARTUP] App will use fallback text icons instead of vector icons');
  // App will continue with fallback icons - no need to throw
}

// Step 3: Load and register the app (after all safety measures are in place)
try {
  const { registerRootComponent } = require('expo');
  const App = require('./App').default;
  console.log('[STARTUP] App module loaded, registering root component');
  registerRootComponent(App);
} catch (e) {
  console.error('[STARTUP] App registration failed:', e?.message, e?.stack);
  // Re-throw to trigger RCTFatal with our error handler active
  throw e;
}
