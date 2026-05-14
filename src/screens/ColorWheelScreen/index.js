// screens/ColorWheelScreen/index.js - Refactored ColorWheelScreen
// SAFER: Lazy load with fallbacks
import React, { useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import PropTypes from 'prop-types';
// CRASH FIX: Lazy-load all imports to prevent early module initialization
let _AppErrorBoundary = null;
let _AppErrorBoundaryLoadAttempted = false;
const getAppErrorBoundary = () => {
  if (_AppErrorBoundaryLoadAttempted) return _AppErrorBoundary;
  _AppErrorBoundaryLoadAttempted = true;
  try {
    const mod = require('../../components/AppErrorBoundary');
    _AppErrorBoundary = mod?.default || mod;
  } catch (error) {
    console.warn('ColorWheelScreen: AppErrorBoundary load failed', error?.message);
    _AppErrorBoundary = ({ children }) => children;
  }
  return _AppErrorBoundary;
};

let _colorValidation = null;
let _colorValidationLoadAttempted = false;
const getColorValidation = () => {
  if (_colorValidationLoadAttempted) return _colorValidation;
  _colorValidationLoadAttempted = true;
  try {
    _colorValidation = require('../../utils/colorValidation');
  } catch (error) {
    console.warn('ColorWheelScreen: colorValidation load failed', error?.message);
    _colorValidation = { isValidHex6: () => false };
  }
  return _colorValidation;
};
const isValidHex6 = (hex) => {
  const mod = getColorValidation();
  return mod?.isValidHex6 ? mod.isValidHex6(hex) : false;
};

let _SchemeSelector = null;
let _SchemeSelectorLoadAttempted = false;
const getSchemeSelector = () => {
  if (_SchemeSelectorLoadAttempted) return _SchemeSelector;
  _SchemeSelectorLoadAttempted = true;
  try {
    const mod = require('./components/SchemeSelector');
    _SchemeSelector = mod?.SchemeSelector || mod?.default || mod;
  } catch (error) {
    console.warn('ColorWheelScreen: SchemeSelector load failed', error?.message);
    _SchemeSelector = () => <View><Text>SchemeSelector unavailable</Text></View>;
  }
  return _SchemeSelector;
};

let _ColorWheelContainer = null;
let _ColorWheelContainerLoadAttempted = false;
const getColorWheelContainer = () => {
  if (_ColorWheelContainerLoadAttempted) return _ColorWheelContainer;
  _ColorWheelContainerLoadAttempted = true;
  try {
    const mod = require('./components/ColorWheelContainer');
    _ColorWheelContainer = mod?.ColorWheelContainer || mod?.default || mod;
  } catch (error) {
    console.warn('ColorWheelScreen: ColorWheelContainer load failed', error?.message);
    _ColorWheelContainer = () => <View><Text>ColorWheelContainer unavailable</Text></View>;
  }
  return _ColorWheelContainer;
};

let _ColorControls = null;
let _ColorControlsLoadAttempted = false;
const getColorControls = () => {
  if (_ColorControlsLoadAttempted) return _ColorControls;
  _ColorControlsLoadAttempted = true;
  try {
    const mod = require('./components/ColorControls');
    _ColorControls = mod?.ColorControls || mod?.default || mod;
  } catch (error) {
    console.warn('ColorWheelScreen: ColorControls load failed', error?.message);
    _ColorControls = () => <View><Text>ColorControls unavailable</Text></View>;
  }
  return _ColorControls;
};

let _HSLInputs = null;
let _HSLInputsLoadAttempted = false;
const getHSLInputs = () => {
  if (_HSLInputsLoadAttempted) return _HSLInputs;
  _HSLInputsLoadAttempted = true;
  try {
    const mod = require('./components/HSLInputs');
    _HSLInputs = mod?.HSLInputs || mod?.default || mod;
  } catch (error) {
    console.warn('ColorWheelScreen: HSLInputs load failed', error?.message);
    _HSLInputs = () => <View><Text>HSLInputs unavailable</Text></View>;
  }
  return _HSLInputs;
};

let _HexInput = null;
let _HexInputLoadAttempted = false;
const getHexInput = () => {
  if (_HexInputLoadAttempted) return _HexInput;
  _HexInputLoadAttempted = true;
  try {
    const mod = require('./components/HexInput');
    _HexInput = mod?.HexInput || mod?.default || mod;
  } catch (error) {
    console.warn('ColorWheelScreen: HexInput load failed', error?.message);
    _HexInput = () => null;
  }
  return _HexInput;
};

let _ColorSliders = null;
let _ColorSlidersLoadAttempted = false;
const getColorSliders = () => {
  if (_ColorSlidersLoadAttempted) return _ColorSliders;
  _ColorSlidersLoadAttempted = true;
  try {
    const mod = require('./components/ColorSliders');
    _ColorSliders = mod?.ColorSliders || mod?.default || mod;
  } catch (error) {
    console.warn('ColorWheelScreen: ColorSliders load failed', error?.message);
    _ColorSliders = () => null;
  }
  return _ColorSliders;
};

let _PaletteActions = null;
let _PaletteActionsLoadAttempted = false;
const getPaletteActions = () => {
  if (_PaletteActionsLoadAttempted) return _PaletteActions;
  _PaletteActionsLoadAttempted = true;
  try {
    const mod = require('./components/PaletteActions');
    _PaletteActions = mod?.PaletteActions || mod?.default || mod;
  } catch (error) {
    console.warn('ColorWheelScreen: PaletteActions load failed', error?.message);
    _PaletteActions = () => null;
  }
  return _PaletteActions;
};

let _ColorSwatches = null;
let _ColorSwatchesLoadAttempted = false;
const getColorSwatches = () => {
  if (_ColorSwatchesLoadAttempted) return _ColorSwatches;
  _ColorSwatchesLoadAttempted = true;
  try {
    const mod = require('./components/ColorSwatches');
    _ColorSwatches = mod?.ColorSwatches || mod?.default || mod;
  } catch (error) {
    console.warn('ColorWheelScreen: ColorSwatches load failed', error?.message);
    _ColorSwatches = () => <View><Text>ColorSwatches unavailable</Text></View>;
  }
  return _ColorSwatches;
};

let _useOptimizedColorWheelState = null;
let _useOptimizedColorWheelStateLoadAttempted = false;
const getUseOptimizedColorWheelState = () => {
  if (_useOptimizedColorWheelStateLoadAttempted) return _useOptimizedColorWheelState;
  _useOptimizedColorWheelStateLoadAttempted = true;
  try {
    const mod = require('./useOptimizedColorWheelState');
    _useOptimizedColorWheelState = mod?.useOptimizedColorWheelState || mod?.default || mod;
  } catch (error) {
    console.warn('ColorWheelScreen: useOptimizedColorWheelState load failed', error?.message);
    _useOptimizedColorWheelState = () => ({});
  }
  return _useOptimizedColorWheelState;
};
const useOptimizedColorWheelState = (props) => {
  const hook = getUseOptimizedColorWheelState();
  return typeof hook === 'function' ? hook(props) : {};
};

let _styles = null;
let _stylesLoadAttempted = false;
const getStyles = () => {
  if (_stylesLoadAttempted) return _styles;
  _stylesLoadAttempted = true;
  try {
    const mod = require('./styles');
    _styles = mod?.styles || mod?.default || mod;
  } catch (error) {
    console.warn('ColorWheelScreen: styles load failed', error?.message);
    _styles = {};
  }
  return _styles;
};
const styles = new Proxy({}, {
  get: (target, prop) => {
    const styleModule = getStyles();
    return styleModule?.[prop] || {};
  }
});

let _apiPatterns = null;
let _apiPatternsLoadAttempted = false;
const getApiPatterns = () => {
  if (_apiPatternsLoadAttempted) return _apiPatterns;
  _apiPatternsLoadAttempted = true;
  try {
    const mod = require('../../utils/apiHelpers');
    _apiPatterns = mod?.apiPatterns || {};
  } catch (error) {
    console.warn('ColorWheelScreen: apiPatterns load failed', error?.message);
    _apiPatterns = { loadUserData: async () => ({ success: false }) };
  }
  return _apiPatterns;
};
const apiPatterns = new Proxy({}, {
  get: (target, prop) => {
    const patterns = getApiPatterns();
    return patterns?.[prop] || (() => Promise.resolve({ success: false }));
  }
});

let _optimizedColorModule = null;
let _optimizedColorLoadAttempted = false;
const getOptimizedColorModule = () => {
  if (_optimizedColorLoadAttempted) return _optimizedColorModule;
  _optimizedColorLoadAttempted = true;
  try {
    _optimizedColorModule = require('../../utils/optimizedColor');
  } catch (error) {
    console.warn('ColorWheelScreen: optimizedColor load failed', error?.message || error);
    _optimizedColorModule = null;
  }
  return _optimizedColorModule;
};

const getColorSchemeSafe = (baseColor, scheme, index) => {
  const mod = getOptimizedColorModule();
  const fn = mod?.getColorScheme;
  if (typeof fn === 'function') return fn(baseColor, scheme, index);
  return typeof baseColor === 'string' ? [baseColor] : [];
};

let _apiServiceInstance = null;
let _apiServiceLoadAttempted = false;
let _apiServiceLoadError = null;

const getApiServiceInstance = () => {
  if (_apiServiceLoadAttempted) return _apiServiceInstance;
  _apiServiceLoadAttempted = true;
  try {
    const mod = require('../../services/safeApiService');
    _apiServiceInstance = mod?.default || mod;
  } catch (error) {
    _apiServiceLoadError = error;
    console.warn('ColorWheelScreen: safeApiService load failed', error?.message || error);
    _apiServiceInstance = null;
  }
  return _apiServiceInstance;
};

const ApiService = {
  getToken: () => {
    const inst = getApiServiceInstance();
    return typeof inst?.getToken === 'function' ? inst.getToken() : undefined;
  },
};

Object.defineProperty(ApiService, 'ready', {
  enumerable: true,
  get: () => {
    const inst = getApiServiceInstance();
    return inst?.ready || Promise.resolve();
  },
});

import { isDebugMode as IS_DEBUG_MODE } from '../../utils/debugMode';

// Optional components (lazy load with fallbacks)
let CoolorsColorExtractor = null;
let ApiIntegrationStatus = null;

try {
  CoolorsColorExtractor = require('../../components/CoolorsColorExtractor').default;
} catch (error) {
  console.warn('CoolorsColorExtractor not available:', error.message);
  // Fallback component
  CoolorsColorExtractor = () => null;
}

try {
  ApiIntegrationStatus = require('../../components/ApiIntegrationStatus').default;
} catch (error) {
  console.warn('ApiIntegrationStatus not available:', error.message);
  // Fallback component
  ApiIntegrationStatus = () => null;
}

const ColorWheelScreen = ({ navigation, currentUser, onLogout, onSaveColorMatch }) => {
  const wheelRef = useRef(null);
  const scrollViewRef = useRef(null);
  
  // Lazy-load components on first render
  const AppErrorBoundary = getAppErrorBoundary();
  const SchemeSelector = getSchemeSelector();
  const ColorWheelContainer = getColorWheelContainer();
  const ColorControls = getColorControls();
  const HSLInputs = getHSLInputs();
  const ColorSwatches = getColorSwatches();
  const HexInput = getHexInput();
  const ColorSliders = getColorSliders();
  const PaletteActions = getPaletteActions();
  
  // CRASH FIX: Safe hook destructuring to prevent crash if hook returns undefined
  let colorWheelState;
  try {
    colorWheelState = useOptimizedColorWheelState({ wheelRef }) || {};
  } catch (error) {
    console.error('useOptimizedColorWheelState hook failed:', error);
    colorWheelState = {};
  }
  
  const {
    selectedScheme = 'monochromatic',
    setSelectedScheme = () => console.warn('setSelectedScheme not available'),
    palette = [],
    selectedColor = '#FF0000',
    baseHex = '#FF0000',
    linked = false,
    activeIdx = 0,
    selectedFollowsActive = false,
    showExtractor = false,
    hslInputs = { h: '0', s: '100', l: '50' },
    updateHslInput = () => console.warn('updateHslInput not available'),
    applyHslInputs = () => console.warn('applyHslInputs not available'),
    hsl = { h: 0, s: 100, l: 50 },
    updateColorWheelLive = () => console.warn('updateColorWheelLive not available'),
    resetScheme = () => console.warn('resetScheme not available'),
    randomize = () => console.warn('randomize not available'),
    toggleLinked = () => console.warn('toggleLinked not available'),
    toggleSelectedFollowsActive = () => console.warn('toggleSelectedFollowsActive not available'),
    openExtractor = () => console.warn('openExtractor not available'),
    openCamera = () => console.warn('openCamera not available'),
    openGallery = () => console.warn('openGallery not available'),
    closeExtractor = () => console.warn('closeExtractor not available'),
    extractorMode = 'gallery',
    extractorImageUri = null,
    handleExtractorComplete = () => console.warn('handleExtractorComplete not available'),
    handleColorsChange = () => console.warn('handleColorsChange not available'),
    handleHexChange = () => console.warn('handleHexChange not available'),
    handleActiveHandleChange = () => console.warn('handleActiveHandleChange not available'),
  } = colorWheelState;

  // Load user data with proper error handling using apiHelpers
  const loadUserData = useCallback(async () => {
    // DEBUG: Log auth status before API call
    console.log('🔍 ColorWheelScreen - Loading user data:', {
      hasCurrentUser: !!currentUser,
      userId: currentUser?.id || 'none',
      hasToken: !!ApiService.getToken(),
      timestamp: new Date().toISOString()
    });
    
    if (!currentUser) {
      console.warn('⚠️ No currentUser - skipping loadUserData');
      return;
    }

    try {
      console.log('📡 Calling apiPatterns.loadUserData()...');
      const result = await apiPatterns.loadUserData();
      console.log('✅ API call completed:', { success: result.success });

      if (result.success) {
        // Log API integration status only in debug mode
        if (IS_DEBUG_MODE()) {
          console.log('API Integration Status:', {
            authenticated: !!ApiService.getToken(),
            userDataLoaded: !!result.data,
            apiReady: true,
            timestamp: new Date().toISOString()
          });
        }
        return;
      }

      console.warn('Failed to load user data:', result.error);

      // Always log API integration issues for production debugging
      console.error('API Integration Issue:', {
        error: result.error?.message ?? String(result.error),
        isAuthError: result.error?.isAuthError,
        hasToken: !!ApiService.getToken(),
      });

      if (result.error?.isAuthError && typeof onLogout === 'function') {
        onLogout();
      }
    } catch (error) {
      console.error('loadUserData threw:', error);
      // Always log API integration crashes for production debugging
      console.error('API Integration Crash Path:', {
        message: error.message,
        stack: error.stack,
        hasToken: !!ApiService.getToken(),
      });
    }
  }, [currentUser, onLogout]);

  // Load data when screen focuses
  useFocusEffect(useCallback(() => { 
    loadUserData(); 
  }, [loadUserData]));

  // Enhanced memoized scheme colors with performance monitoring
  const schemeColors = useMemo(() => {
    const startTime = Date.now();
    
    let colors;
    if (Array.isArray(palette) && palette.length > 0) {
      colors = palette;
    } else {
      colors = getColorSchemeSafe(selectedColor, selectedScheme, 0);
    }
    
    const duration = Date.now() - startTime;
    if (IS_DEBUG_MODE() && duration > 50) {
      console.log(`⏱️ Scheme calculation took ${duration}ms for ${selectedScheme}`);
    }
    
    return colors;
  }, [palette, selectedColor, selectedScheme]);

  // Event handlers with useCallback for performance
  const handleSchemeChange = useCallback((scheme) => {
    setSelectedScheme(scheme);
    resetScheme();
  }, [setSelectedScheme, resetScheme]);

  const handleApplyInputs = useCallback(() => {
    applyHslInputs();
  }, [applyHslInputs]);

  const handleReset = useCallback(() => {
    resetScheme();
  }, [resetScheme]);

  // Handle swatch press to select different palette colors
  const handleSwatchPress = useCallback((color, index) => {
    try {
      if (!isValidHex6(color)) {
        console.warn('Invalid color selected from swatch:', color);
        return;
      }

      // CRASH FIX: Use existing hook handlers instead of undefined setters
      handleHexChange(color);
      
      // VALIDATION FIX: Proper index validation - must be actual number >= 0
      if (typeof index === 'number' && !isNaN(index) && Number.isInteger(index) && index >= 0) {
        // Valid palette index - update active handle
        handleActiveHandleChange(index);
        
        if (IS_DEBUG_MODE()) {
          console.log(`Color selected from swatch: ${color} (valid index: ${index})`);
        }
      } else if (index !== -1) { // -1 is used for selected color swatch, so it's expected
        console.warn('Invalid swatch index provided:', {
          index,
          type: typeof index,
          isNaN: isNaN(index),
          isInteger: Number.isInteger(index)
        });
      }
      
      if (IS_DEBUG_MODE() && (index === -1 || (typeof index === 'number' && !isNaN(index) && Number.isInteger(index) && index >= 0))) {
        console.log(`Color selected from swatch: ${color} (index: ${index})`);
      }
    } catch (error) {
      console.error('Error handling swatch press:', error);
    }
  }, [handleHexChange, handleActiveHandleChange]);

  // Memoized color match object to prevent unnecessary recreations
  const colorMatchData = useMemo(() => ({
    base_color: selectedColor,
    scheme: selectedScheme,
    colors: schemeColors,
    title: `${selectedScheme} palette`,
    description: `Generated color palette using ${selectedScheme} scheme`,
  }), [selectedColor, selectedScheme, schemeColors]);

  // Save color match handler
  const handleSaveColorMatch = useCallback(async () => {
    if (!onSaveColorMatch || !currentUser) return;
    
    try {
      
      // Log color match saving only in debug mode
      if (IS_DEBUG_MODE()) {
        console.log('Saving Color Match:', {
          baseColor: colorMatchData.base_color,
          scheme: colorMatchData.scheme,
          colorsCount: colorMatchData.colors.length,
          timestamp: new Date().toISOString()
        });
      }
      
      const result = await onSaveColorMatch(colorMatchData);
      
      // Log successful color match saves only in debug mode
      if (IS_DEBUG_MODE()) {
        console.log('Color Match Saved:', {
          success: !!result,
          matchId: result?.id,
          timestamp: new Date().toISOString()
        });
      }
      
      return result;
    } catch (error) {
      console.error('Failed to save color match:', error);
      // Always log color match save errors for production debugging
      console.error('Save Color Match Error:', {
        error: error.message,
        isAuthError: error.isAuthError,
        colorMatch: {
          baseColor: selectedColor,
          scheme: selectedScheme,
          colorsCount: schemeColors.length
        }
      });
      throw error;
    }
  }, [onSaveColorMatch, currentUser, colorMatchData]);

  const handleSliderChange = useCallback((component, value) => {
    updateHslInput(component, String(value));
    updateColorWheelLive(component, String(value), wheelRef);
  }, [updateHslInput, updateColorWheelLive, wheelRef]);

  const handleSlidingComplete = useCallback((component, value) => {
    updateHslInput(component, String(value));
    applyHslInputs();
  }, [updateHslInput, applyHslInputs]);

  return (
    <ScrollView
      ref={scrollViewRef}
      contentContainerStyle={styles.container}
      accessibilityLabel="Color wheel screen"
    >
      <SchemeSelector
        selectedScheme={selectedScheme}
        onSchemeChange={handleSchemeChange}
        selectedColor={selectedColor}
      />

      <ColorWheelContainer
        wheelRef={wheelRef}
        selectedFollowsActive={selectedFollowsActive}
        selectedScheme={selectedScheme}
        baseHex={baseHex}
        linked={linked}
        onToggleLinked={toggleLinked}
        onColorsChange={handleColorsChange}
        onHexChange={handleHexChange}
        onActiveHandleChange={handleActiveHandleChange}
        onOpenCamera={openCamera}
        onOpenGallery={openGallery}
      />

      <ColorControls
        linked={linked}
        selectedFollowsActive={selectedFollowsActive}
        onToggleLinked={toggleLinked}
        onToggleSelectedFollowsActive={toggleSelectedFollowsActive}
        onReset={handleReset}
        onRandomize={randomize}
      />

      <HexInput
        selectedColor={selectedColor}
        onHexChange={handleHexChange}
        wheelRef={wheelRef}
      />

      <HSLInputs
        hslInputs={hslInputs}
        onUpdateInput={updateHslInput}
        onLiveUpdate={updateColorWheelLive}
        onApplyInputs={handleApplyInputs}
        wheelRef={wheelRef}
      />

      <ColorSliders
        hsl={hsl}
        onSaturationChange={(v) => handleSliderChange('s', v)}
        onLightnessChange={(v) => handleSliderChange('l', v)}
        onSlidingComplete={handleSlidingComplete}
        scrollViewRef={scrollViewRef}
      />

      <ColorSwatches
        selectedColor={selectedColor}
        schemeColors={schemeColors}
        selectedScheme={selectedScheme}
        activeIdx={activeIdx}
        onSwatchPress={handleSwatchPress}
      />

      <PaletteActions
        palette={schemeColors}
        selectedColor={selectedColor}
      />

      {showExtractor && (
        <CoolorsColorExtractor
          mode={extractorMode}
          initialSlots={5}
          initialImageUri={extractorImageUri}
          onComplete={handleExtractorComplete}
          onClose={closeExtractor}
        />
      )}

      {/* API Integration Status (Development Only) */}
      <ApiIntegrationStatus />
    </ScrollView>
  );
};

// PropTypes for better development experience
ColorWheelScreen.propTypes = {
  navigation: PropTypes.object,
  currentUser: PropTypes.object,
  onLogout: PropTypes.func,
  onSaveColorMatch: PropTypes.func,
};

ColorWheelScreen.defaultProps = {
  navigation: null,
  currentUser: null,
  onLogout: () => {},
  onSaveColorMatch: () => {},
};

// Wrap with error boundary for production safety
const ColorWheelScreenWithErrorBoundary = (props) => {
  const AppErrorBoundary = getAppErrorBoundary();
  return (
    <AppErrorBoundary>
      <ColorWheelScreen {...props} />
    </AppErrorBoundary>
  );
};

export default React.memo(ColorWheelScreenWithErrorBoundary);
