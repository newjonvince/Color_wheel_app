// screens/ColorWheelScreen/index.js - Refactored ColorWheelScreen
import React, { useRef, useCallback, useMemo } from 'react';
import { ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import PropTypes from 'prop-types';

// Components
import { SchemeSelector } from './components/SchemeSelector';
import { ColorWheelContainer } from './components/ColorWheelContainer';
import { ColorControls } from './components/ColorControls';
import { HSLInputs } from './components/HSLInputs';
import { ColorSwatches } from './components/ColorSwatches';
import CoolorsColorExtractor from '../../components/CoolorsColorExtractor';

// Hooks and utilities
import { useColorWheelState } from './useColorWheelState';
import { getColorScheme } from '../../utils/color';
import { styles } from './styles';
import ApiService from '../../services/api';

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
  } = useColorWheelState();

  // Load user data with proper error handling
  const loadUserData = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      await ApiService.ready;
      await ApiService.getUserColorMatches();
    } catch (error) {
      console.warn('Failed to load user data:', error);
      if (error.isAuthError && typeof onLogout === 'function') {
        onLogout();
      }
    }
  }, [currentUser, onLogout]);

  // Load data when screen focuses
  useFocusEffect(useCallback(() => { 
    loadUserData(); 
  }, [loadUserData]));

  // Memoized scheme colors for performance
  const schemeColors = useMemo(() => {
    if (Array.isArray(palette) && palette.length > 0) {
      return palette;
    }
    return getColorScheme(selectedColor, selectedScheme, 0);
  }, [palette, selectedColor, selectedScheme]);

  // Event handlers with useCallback for performance
  const handleSchemeChange = useCallback((scheme) => {
    setSelectedScheme(scheme);
    resetScheme();
  }, [setSelectedScheme, resetScheme]);

  const handleApplyInputs = useCallback(() => {
    applyHslInputs(wheelRef);
  }, [applyHslInputs]);

  const handleReset = useCallback(() => {
    resetScheme();
  }, [resetScheme]);

  // Save color match handler
  const handleSaveColorMatch = useCallback(async () => {
    if (!onSaveColorMatch || !currentUser) return;
    
    try {
      const colorMatch = {
        base_color: selectedColor,
        scheme: selectedScheme,
        colors: schemeColors,
        title: `${selectedScheme} palette`,
        description: `Generated color palette using ${selectedScheme} scheme`,
      };
      
      await onSaveColorMatch(colorMatch);
    } catch (error) {
      console.error('Failed to save color match:', error);
    }
  }, [onSaveColorMatch, currentUser, selectedColor, selectedScheme, schemeColors]);

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
        wheelRef={wheelRef}
      />

      <ColorSwatches
        selectedColor={selectedColor}
        schemeColors={schemeColors}
        selectedScheme={selectedScheme}
        activeIdx={activeIdx}
      />

      {showExtractor && (
        <CoolorsColorExtractor
          initialSlots={5}
          onComplete={handleExtractorComplete}
          onClose={closeExtractor}
        />
      )}
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
