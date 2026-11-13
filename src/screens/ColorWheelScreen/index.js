// screens/ColorWheelScreen/index.js
// Layout (Canva-style): wheel -> tools -> 1. pick a color -> 2. palette type -> palette -> actions
import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, Alert, Modal } from 'react-native';
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
import { SaveToBoardSheet } from '../../components/palettes/SaveToBoardSheet';
import { WebCaptureModal } from '../../components/WebCaptureModal';

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

const ColorWheelScreen = ({ navigation = null, route = null, currentUser = null, onLogout = () => {} }) => {
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
    if (Number.isInteger(index) && index >= 0) {
      // Make the wheel edit this color too, so the hex field, sliders and ring act on it
      wheelRef.current?.selectHandle?.(index);
      handleActiveHandleChange(index);
    }
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
  // Unlocked, the colors no longer follow the palette type, so it is saved as a custom palette
  const colorMatchData = useMemo(() => (linked ? {
    base_color: selectedColor,
    scheme: selectedScheme,
    colors: schemeColors,
    title: `${schemeLabel} palette`,
    description: `Generated color palette using the ${selectedScheme} scheme`,
  } : {
    base_color: schemeColors[0] || selectedColor,
    scheme: 'custom',
    colors: schemeColors,
    title: 'Custom palette',
    description: 'Custom color palette',
  }), [linked, selectedColor, selectedScheme, schemeColors, schemeLabel]);

  // Saving goes through the board sheet: name it, choose boards, optionally share it
  const [saveOpen, setSaveOpen] = useState(false);
  const handleSavePalette = useCallback(() => {
    if (!currentUser) {
      Alert.alert('Sign in to save', 'Log in to save palettes to your boards.');
      return;
    }
    setSaveOpen(true);
  }, [currentUser]);

  // Open the Community tab on shared palettes closest to the colors on the wheel
  const exploreInspiration = useCallback(() => {
    const colors = schemeColors.filter(isValidHex6);
    if (colors.length === 0) return;
    navigation?.navigate('Community', { similarTo: { colors, nonce: Date.now() } });
  }, [navigation, schemeColors]);

  // ----- palettes sent from other tabs ("Try on wheel" in Boards, Community and the Guide) -----
  const applyRequest = route?.params?.applyPalette;
  const appliedNonce = useRef(null);
  useEffect(() => {
    if (!applyRequest || appliedNonce.current === applyRequest.nonce) return;
    appliedNonce.current = applyRequest.nonce;
    if (!isValidHex6(applyRequest.hex)) return;
    // Photo palettes have no wheel scheme: keep whichever scheme is selected
    if (applyRequest.scheme && applyRequest.scheme !== 'custom') setSelectedScheme(applyRequest.scheme);
    wheelRef.current?.selectHandle?.(0);
    handleActiveHandleChange(0);
    handleExtractorComplete([applyRequest.hex.toUpperCase()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyRequest]);

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

  // A picture found on the web: capture and crop it, then pick the color like any photo
  const [webOpen, setWebOpen] = useState(false);
  const handleWebCaptured = useCallback((uri) => {
    setWebOpen(false);
    if (uri) setTimeout(() => setPhotoUri(uri), 350);
  }, []);

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

        {!linked && (
          <Text style={{ marginTop: 10, fontSize: 13, lineHeight: 18, textAlign: 'center', color: colorWheelColors.text, opacity: 0.65 }}>
            Custom palette: drag each handle on its own, or tap a color below to edit it. Lock to snap back to the palette type.
          </Text>
        )}

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
            style={styles.primaryButton}
            onPress={handleSavePalette}
            accessibilityRole="button"
            accessibilityLabel="Save palette to a board"
          >
            <Ionicons name="bookmark-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Save to a board</Text>
          </Pressable>
        </View>
        <View style={[styles.actionsRow, { marginTop: 12 }]}>
          <Pressable
            style={styles.secondaryButton}
            onPress={exploreInspiration}
            accessibilityRole="button"
            accessibilityLabel="Explore shared palettes similar to these colors"
          >
            <Ionicons name="sparkles-outline" size={18} color={colorWheelColors.text} />
            <Text style={styles.secondaryButtonText}>Explore inspiration</Text>
          </Pressable>
        </View>

        <Text style={styles.photoLabel}>Pick a color from a picture</Text>
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
            <Text style={styles.secondaryButtonText}>Photos</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setWebOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Find a picture on the web and pick a color from it"
          >
            <Ionicons name="globe-outline" size={18} color={colorWheelColors.text} />
            <Text style={styles.secondaryButtonText}>Web</Text>
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

      <WebCaptureModal visible={webOpen} onClose={() => setWebOpen(false)} onCaptured={handleWebCaptured} />

      <SaveToBoardSheet
        visible={saveOpen}
        draft={colorMatchData}
        onClose={() => setSaveOpen(false)}
      />

      {IS_DEBUG_MODE() && <ApiIntegrationStatus />}
    </ScrollView>
  );
};

ColorWheelScreen.propTypes = {
  navigation: PropTypes.object,
  currentUser: PropTypes.object,
  onLogout: PropTypes.func,
  route: PropTypes.object,
};

const ColorWheelScreenWithErrorBoundary = (props) => (
  <AppErrorBoundary>
    <ColorWheelScreen {...props} />
  </AppErrorBoundary>
);

export default React.memo(ColorWheelScreenWithErrorBoundary);
