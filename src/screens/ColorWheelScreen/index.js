// screens/ColorWheelScreen/index.js
// Layout (Canva-style): wheel -> tools -> 1. pick a color -> 2. palette type -> palette -> actions
import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, Alert, ActivityIndicator, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import PropTypes from 'prop-types';
import { Ionicons } from '@expo/vector-icons';
import AppErrorBoundary from '../../components/AppErrorBoundary';
import { isValidHex6 } from '../../utils/colorValidation';
import { getColorScheme, hexToHsl } from '../../utils/optimizedColor';
import { SchemeSelector } from './components/SchemeSelector';
import { ColorWheelContainer } from './components/ColorWheelContainer';
import { ColorControls } from './components/ColorControls';
import { HSLInputs } from './components/HSLInputs';
import { ColorSwatches } from './components/ColorSwatches';
import { useOptimizedColorWheelState } from './useOptimizedColorWheelState';
import { getSchemeDisplayName } from './constants';
import { styles, colorWheelColors } from './styles';
import { apiPatterns } from '../../utils/apiHelpers';

let _apiServiceInstance = null;
let _apiServiceLoadAttempted = false;
const getApiServiceInstance = () => {
  if (_apiServiceLoadAttempted) return _apiServiceInstance;
  _apiServiceLoadAttempted = true;
  try {
    const mod = require('../../services/safeApiService');
    _apiServiceInstance = mod?.default || mod;
  } catch (error) {
    console.warn('ColorWheelScreen: safeApiService load failed', error?.message || error);
    _apiServiceInstance = null;
  }
  return _apiServiceInstance;
};
const hasToken = () => {
  const inst = getApiServiceInstance();
  return typeof inst?.getToken === 'function' ? !!inst.getToken() : false;
};

// Lazy: expoConfigHelper touches expo-constants, which must not run at module load
let _isDebugModeValue = null;
const IS_DEBUG_MODE = () => {
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

// Optional components (fall back to nothing if they fail to load)
let CoolorsColorExtractor = null;
let pickPhotoAsync = async () => null;
let ApiIntegrationStatus = null;
try {
  const extractorModule = require('../../components/CoolorsColorExtractor');
  CoolorsColorExtractor = extractorModule.default;
  pickPhotoAsync = extractorModule.pickPhotoAsync || pickPhotoAsync;
} catch (error) {
  console.warn('CoolorsColorExtractor not available:', error.message);
  CoolorsColorExtractor = () => null;
}
try {
  ApiIntegrationStatus = require('../../components/ApiIntegrationStatus').default;
} catch (error) {
  console.warn('ApiIntegrationStatus not available:', error.message);
  ApiIntegrationStatus = () => null;
}

const normalizeHex = (raw) => {
  const text = String(raw || '').trim();
  const withHash = text.startsWith('#') ? text : `#${text}`;
  return withHash.toUpperCase();
};

const ColorWheelScreen = ({ navigation = null, currentUser = null, onLogout = () => {}, onSaveColorMatch = null }) => {
  const wheelRef = useRef(null);

  let colorWheelState;
  try {
    colorWheelState = useOptimizedColorWheelState({ wheelRef }) || {};
  } catch (error) {
    console.error('useOptimizedColorWheelState hook failed:', error);
    colorWheelState = {};
  }

  const {
    selectedScheme = 'complementary',
    setSelectedScheme = () => {},
    palette = [],
    selectedColor = '#FF6B6B',
    baseHex = '#FF6B6B',
    linked = true,
    activeIdx = 0,
    selectedFollowsActive = true,
    hslInputs = { h: '0', s: '100', l: '50' },
    updateHslInput = () => {},
    applyHslInputs = () => {},
    updateColorWheelLive = () => {},
    resetScheme = () => {},
    randomize = () => {},
    toggleLinked = () => {},
    toggleSelectedFollowsActive = () => {},
    handleExtractorComplete = () => {},
    handleColorsChange = () => {},
    handleHexChange = () => {},
    handleActiveHandleChange = () => {},
  } = colorWheelState;

  // ----- user data on focus -----
  const loadUserData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const result = await apiPatterns.loadUserData();
      if (result.success) return;
      console.warn('Failed to load user data:', result.error?.message ?? String(result.error));
      if (result.error?.isAuthError && typeof onLogout === 'function') onLogout();
    } catch (error) {
      console.error('loadUserData threw:', error?.message, { hasToken: hasToken() });
    }
  }, [currentUser, onLogout]);

  useFocusEffect(useCallback(() => {
    loadUserData();
  }, [loadUserData]));

  // ----- palette -----
  const schemeColors = useMemo(() => {
    if (Array.isArray(palette) && palette.length > 0) return palette;
    try {
      const generated = getColorScheme(selectedColor, selectedScheme);
      return Array.isArray(generated) && generated.length ? generated : [selectedColor];
    } catch (_) {
      return [selectedColor];
    }
  }, [palette, selectedColor, selectedScheme]);

  const handleSchemeChange = useCallback((scheme) => {
    setSelectedScheme(scheme);
    resetScheme();
  }, [setSelectedScheme, resetScheme]);

  const handleSwatchPress = useCallback((color, index) => {
    if (!isValidHex6(color)) return;
    handleHexChange(color);
    if (Number.isInteger(index) && index >= 0) handleActiveHandleChange(index);
  }, [handleHexChange, handleActiveHandleChange]);

  // ----- hex field ("1. Pick a color") -----
  const [hexDraft, setHexDraft] = useState(selectedColor);
  const hexFocused = useRef(false);
  useEffect(() => {
    if (!hexFocused.current) setHexDraft(selectedColor);
  }, [selectedColor]);

  const commitHex = useCallback(() => {
    hexFocused.current = false;
    const hex = normalizeHex(hexDraft);
    if (!isValidHex6(hex)) {
      setHexDraft(selectedColor);
      return;
    }
    const { h = 0, s = 100, l = 50 } = hexToHsl(hex) || {};
    handleHexChange(hex);
    wheelRef.current?.setActiveHandleHSL?.(h, s, l);
  }, [hexDraft, selectedColor, handleHexChange]);

  // ----- save -----
  const schemeLabel = getSchemeDisplayName(selectedScheme);
  const colorMatchData = useMemo(() => ({
    base_color: selectedColor,
    scheme: selectedScheme,
    colors: schemeColors,
    title: `${schemeLabel} palette`,
    description: `Generated color palette using the ${selectedScheme} scheme`,
  }), [selectedColor, selectedScheme, schemeColors, schemeLabel]);

  const [saving, setSaving] = useState(false);
  const handleSavePalette = useCallback(async () => {
    if (!currentUser) {
      Alert.alert('Sign in to save', 'Log in to save palettes to your boards.');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const result = typeof onSaveColorMatch === 'function'
        ? await onSaveColorMatch(colorMatchData)
        : await apiPatterns.createColorMatch(colorMatchData);
      const ok = result == null ? true : result.success !== false;
      if (ok) {
        Alert.alert('Palette saved', `${colorMatchData.title} was added to your boards.`);
      } else {
        Alert.alert('Could not save', result.userMessage || result.error?.message || 'Please try again.');
      }
    } catch (error) {
      Alert.alert('Could not save', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [currentUser, saving, onSaveColorMatch, colorMatchData]);

  // ----- color from a photo -----
  // Pick the photo first, then present the extractor: presenting the picker from inside an
  // already-open modal is unreliable on iOS.
  const [photoUri, setPhotoUri] = useState(null);
  const pickingRef = useRef(false);

  const startPhotoPick = useCallback(async (source) => {
    if (pickingRef.current) return;
    pickingRef.current = true;
    try {
      const uri = await pickPhotoAsync(source);
      // Let the system picker finish dismissing before our modal presents
      if (uri) setTimeout(() => setPhotoUri(uri), 300);
    } catch (error) {
      console.error('Photo pick failed:', error?.message || error);
      Alert.alert('Could not open photos', 'Please try again.');
    } finally {
      pickingRef.current = false;
    }
  }, []);

  const closePhoto = useCallback(() => setPhotoUri(null), []);

  // The picked color becomes the wheel's base color (handle 1), and the scheme rebuilds around it
  const handlePhotoColor = useCallback((result) => {
    const hex = Array.isArray(result) ? result[0] : result?.slots?.[0];
    setPhotoUri(null);
    if (!isValidHex6(hex)) return;
    wheelRef.current?.selectHandle?.(0);
    handleActiveHandleChange(0);
    handleExtractorComplete([hex]);
  }, [handleActiveHandleChange, handleExtractorComplete]);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: selectedColor }]}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel="Color wheel screen"
    >
      <View style={styles.card}>
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
        />

        <ColorControls
          linked={linked}
          selectedFollowsActive={selectedFollowsActive}
          onToggleLinked={toggleLinked}
          onToggleSelectedFollowsActive={toggleSelectedFollowsActive}
          onReset={resetScheme}
          onRandomize={randomize}
        />

        <Text style={styles.stepLabel}>1. Pick a color</Text>
        <View style={styles.colorRow}>
          <View style={[styles.colorDot, { backgroundColor: selectedColor }]} accessibilityLabel={`Selected color ${selectedColor}`} />
          <TextInput
            style={styles.hexInput}
            value={hexDraft}
            onChangeText={setHexDraft}
            onFocus={() => { hexFocused.current = true; }}
            onBlur={commitHex}
            onSubmitEditing={commitHex}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            returnKeyType="done"
            placeholder="#RRGGBB"
            accessibilityLabel="Hex color"
          />
        </View>
        <HSLInputs
          hslInputs={hslInputs}
          onUpdateInput={updateHslInput}
          onLiveUpdate={updateColorWheelLive}
          onApplyInputs={applyHslInputs}
          wheelRef={wheelRef}
        />

        <Text style={styles.stepLabel}>2. Choose a palette type</Text>
        <SchemeSelector selectedScheme={selectedScheme} onSchemeChange={handleSchemeChange} />

        <ColorSwatches
          schemeColors={schemeColors}
          activeIdx={activeIdx}
          onSwatchPress={handleSwatchPress}
        />

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={handleSavePalette}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save palette"
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" />
              : <Ionicons name="bookmark-outline" size={18} color="#FFFFFF" />}
            <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save palette'}</Text>
          </Pressable>
        </View>

        <Text style={styles.photoLabel}>Pick a color from a photo</Text>
        <View style={styles.photoRow}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => startPhotoPick('camera')}
            accessibilityRole="button"
            accessibilityLabel="Take a photo and pick a color from it"
          >
            <Ionicons name="camera-outline" size={18} color={colorWheelColors.text} />
            <Text style={styles.secondaryButtonText}>Camera</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => startPhotoPick('library')}
            accessibilityRole="button"
            accessibilityLabel="Choose a photo and pick a color from it"
          >
            <Ionicons name="images-outline" size={18} color={colorWheelColors.text} />
            <Text style={styles.secondaryButtonText}>Photo library</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={!!photoUri}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closePhoto}
      >
        {photoUri && (
          <CoolorsColorExtractor
            initialImageUri={photoUri}
            maxColors={1}
            onComplete={handlePhotoColor}
            onClose={closePhoto}
          />
        )}
      </Modal>

      {IS_DEBUG_MODE() && <ApiIntegrationStatus />}
    </ScrollView>
  );
};

ColorWheelScreen.propTypes = {
  navigation: PropTypes.object,
  currentUser: PropTypes.object,
  onLogout: PropTypes.func,
  onSaveColorMatch: PropTypes.func,
};

const ColorWheelScreenWithErrorBoundary = (props) => (
  <AppErrorBoundary>
    <ColorWheelScreen {...props} />
  </AppErrorBoundary>
);

export default React.memo(ColorWheelScreenWithErrorBoundary);
