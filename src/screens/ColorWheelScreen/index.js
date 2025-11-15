// screens/ColorWheelScreen/index.js - Refactored ColorWheelScreen
// ✅ SAFER: Lazy load with fallbacks
import React, { useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import PropTypes from 'prop-types';

// Core components (required)
import { SchemeSelector } from './components/SchemeSelector';
import { ColorWheelContainer } from './components/ColorWheelContainer';
import { ColorControls } from './components/ColorControls';
import { HSLInputs } from './components/HSLInputs';
import { ColorSwatches } from './components/ColorSwatches';

// Optional components (lazy load with fallbacks)
let CoolorsColorExtractor = null;
let ApiIntegrationStatus = null;

try {
  CoolorsColorExtractor = require('../../components/CoolorsColorExtractor').default;
} catch (error) {
  console.warn('⚠️ CoolorsColorExtractor not available:', error.message);
  // Fallback component
  CoolorsColorExtractor = () => null;
}

try {
  ApiIntegrationStatus = require('../../components/ApiIntegrationStatus').default;
} catch (error) {
  console.warn('⚠️ ApiIntegrationStatus not available:', error.message);
  // Fallback component
  ApiIntegrationStatus = () => null;
}

// Hooks and utilities
import { useOptimizedColorWheelState } from './useOptimizedColorWheelState';
import { getColorScheme } from '../../utils/optimizedColor';
import { styles } from './styles';
import ApiService from '../../services/safeApiService';
import { apiPatterns } from '../../utils/apiHelpers';

const ColorWheelScreen = ({ navigation, currentUser, onLogout, onSaveColorMatch }) => {
  const wheelRef = useRef(null);
  
  // State management through custom hook
  const {
    selectedScheme,
    setSelectedScheme,
    palette,
    selectedColor,
    baseHex,
    linked,
    activeIdx,
    selectedFollowsActive,
    showExtractor,
    hslInputs,
    updateHslInput,
    applyHslInputs,
    updateColorWheelLive,
    resetScheme,
    randomize,
    toggleLinked,
    toggleSelectedFollowsActive,
    openExtractor,
    closeExtractor,
    handleExtractorComplete,
    handleColorsChange,
    handleHexChange,
    handleActiveHandleChange,
  } = useOptimizedColorWheelState({ wheelRef });

  // Load user data with proper error handling using apiHelpers
  const loadUserData = useCallback(async () => {
    if (!currentUser) return;

    try {
      const result = await apiPatterns.loadUserData();

      if (result.success) {
        // Always log API integration status for production debugging
        console.log('✅ API Integration Status:', {
          authenticated: !!ApiService.getToken(),
          userDataLoaded: !!result.data,
          apiReady: true,
        });
        return;
      }

      console.warn('Failed to load user data:', result.error);

      // Always log API integration issues for production debugging
      console.error('❌ API Integration Issue:', {
        error: result.error?.message ?? String(result.error),
        isAuthError: result.error?.isAuthError,
        hasToken: !!ApiService.getToken(),
      });

      if (result.error?.isAuthError && typeof onLogout === 'function') {
        onLogout();
      }
    } catch (error) {
      console.error('❌ loadUserData threw:', error);
      // Always log API integration crashes for production debugging
      console.error('❌ API Integration Crash Path:', {
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

  // ✅ Enhanced memoized scheme colors with performance monitoring
  const schemeColors = useMemo(() => {
    const startTime = Date.now();
    
    let colors;
    if (Array.isArray(palette) && palette.length > 0) {
      colors = palette;
    } else {
      colors = getColorScheme(selectedColor, selectedScheme, 0);
    }
    
    const duration = Date.now() - startTime;
    if (__DEV__ && duration > 50) {
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

  // ✅ Handle swatch press to select different palette colors
  const handleSwatchPress = useCallback((color, index) => {
    try {
      if (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        console.warn('⚠️ Invalid color selected from swatch:', color);
        return;
      }

      // Update selected color and active index
      setSelectedColor(color);
      setBaseHex(color);
      
      if (index >= 0) {
        // Valid palette index - update active handle
        setActiveIdx(index);
        
        // Update wheel if available
        const wheel = wheelRef?.current;
        if (wheel?.setActiveHandle) {
          wheel.setActiveHandle(index);
        }
      }
      
      if (__DEV__) {
        console.log(`🎨 Color selected from swatch: ${color} (index: ${index})`);
      }
    } catch (error) {
      console.error('❌ Error handling swatch press:', error);
    }
  }, [setSelectedColor, setBaseHex, setActiveIdx, wheelRef]);

  // ✅ Memoized color match object to prevent unnecessary recreations
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
      
      // Always log color match saving for production debugging
      console.log('💾 Saving Color Match:', {
        baseColor: colorMatchData.base_color,
        scheme: colorMatchData.scheme,
        colorsCount: colorMatchData.colors.length,
        colors: colorMatchData.colors
      });
      
      const result = await onSaveColorMatch(colorMatchData);
      
      // Always log successful color match saves for production debugging
      console.log('✅ Color Match Saved:', {
        success: !!result,
        matchId: result?.id,
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error) {
      console.error('Failed to save color match:', error);
      // Always log color match save errors for production debugging
      console.error('❌ Save Color Match Error:', {
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

export default React.memo(ColorWheelScreen);
