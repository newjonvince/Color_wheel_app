// screens/ColorWheelScreen/index.js - Refactored ColorWheelScreen
// SAFER: Lazy load with fallbacks
import React, { useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import PropTypes from 'prop-types';
import AppErrorBoundary from '../../components/AppErrorBoundary';
import { isValidHex6 } from '../../utils/colorValidation';
import { SchemeSelector } from './components/SchemeSelector';
import { ColorWheelContainer } from './components/ColorWheelContainer';
import { ColorControls } from './components/ColorControls';
import { HSLInputs } from './components/HSLInputs';
import { ColorSwatches } from './components/ColorSwatches';
import { useOptimizedColorWheelState } from './useOptimizedColorWheelState';
import { styles } from './styles';
import { apiPatterns } from '../../utils/apiHelpers';

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

// CIRCULAR DEPENDENCY FIX: Lazy load expoConfigHelper to prevent crash on module initialization
let _isDebugModeValue = null;
const getIsDebugMode = () => {
  if (_isDebugModeValue === null) {
    try {
      const helper = require('../../utils/expoConfigHelper');
      _isDebugModeValue = helper.isDebugMode ? helper.isDebugMode() : false;
    } catch (error) {
      console.warn('ColorWheelScreen: expoConfigHelper load failed', error?.message);
      _isDebugModeValue = false;
    }
  }
  return _isDebugModeValue;
};
const IS_DEBUG_MODE = () => getIsDebugMode();

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
    hslInputs = { h: 0, s: 100, l: 50 },
    updateHslInput = () => console.warn('updateHslInput not available'),
    applyHslInputs = () => console.warn('applyHslInputs not available'),
    updateColorWheelLive = () => console.warn('updateColorWheelLive not available'),
    resetScheme = () => console.warn('resetScheme not available'),
    randomize = () => console.warn('randomize not available'),
    toggleLinked = () => console.warn('toggleLinked not available'),
    toggleSelectedFollowsActive = () => console.warn('toggleSelectedFollowsActive not available'),
    openExtractor = () => console.warn('openExtractor not available'),
    closeExtractor = () => console.warn('closeExtractor not available'),
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

  return (
    <ScrollView 
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
        onOpenCamera={openExtractor}
        onOpenGallery={openExtractor}
      />

      <ColorControls
        linked={linked}
        selectedFollowsActive={selectedFollowsActive}
        onToggleLinked={toggleLinked}
        onToggleSelectedFollowsActive={toggleSelectedFollowsActive}
        onReset={handleReset}
        onRandomize={randomize}
      />

      <HSLInputs
        hslInputs={hslInputs}
        onUpdateInput={updateHslInput}
        onLiveUpdate={updateColorWheelLive}
        onApplyInputs={handleApplyInputs}
      />

      <ColorSwatches
        selectedColor={selectedColor}
        schemeColors={schemeColors}
        selectedScheme={selectedScheme}
        activeIdx={activeIdx}
        onSwatchPress={handleSwatchPress}
      />

      {showExtractor && (
        <CoolorsColorExtractor
          initialSlots={5}
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
const ColorWheelScreenWithErrorBoundary = (props) => (
  <AppErrorBoundary>
    <ColorWheelScreen {...props} />
  </AppErrorBoundary>
);

export default React.memo(ColorWheelScreenWithErrorBoundary);
