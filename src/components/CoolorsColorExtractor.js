import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  PanResponder,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ApiService from '../services/api';
import { hexToHsl } from '../utils/color';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const MAGNIFIER_SIZE = 120;

/**
 * Props:
 * - navigation (React Navigation)  <-- REQUIRED for navigation flow
 * - initialImageUri: string
 * - initialSlots?: number
 * - navigateOnActions?: boolean (default false) - if true, uses navigation; if false, uses callbacks
 * - onComplete?: ({ imageUri, slots, dominant }) => void (modal flow)
 * - onSaveToBoard?: ({ imageUri, slots, dominant }) => void (modal flow)
 * - onClose?: () => void
 */
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export default function CoolorsColorExtractor({
  navigation,
  initialImageUri,
  initialSlots = 5,
  navigateOnActions = false,
  onComplete,
  onSaveToBoard,
  onClose,
}) {
  const [selectedImage, setSelectedImage] = useState(null); // { uri }
  const [magnifierPosition, setMagnifierPosition] = useState({ x: screenWidth / 2, y: screenHeight / 2 });
  const [extractedColor, setExtractedColor] = useState('#808080');
  const [palette, setPalette] = useState([]); // ['#xxxxxx']
  const [isLoading, setIsLoading] = useState(false);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [sessionData, setSessionData] = useState(null); // { imageId, token, width, height, dominant, palette }
  const mounted = useRef(true);

  // --- helpers --------------------------------------------------------------
  const fallbackPalette = useMemo(() => (
    ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FECA57','#FF9FF3','#54A0FF','#5F27CD','#00D2D3','#FF9F43','#10AC84','#EE5A24','#0984E3','#A29BFE','#6C5CE7']
  ), []);

  const chooseDominant = useCallback((paletteArray) => paletteArray?.[0] || '#808080', []);

  const startSession = useCallback(async (uri) => {
    // Uses session-based API for live sampling
    try {
      const data = await ApiService.startImageExtractSession(uri, {
        maxWidth: 1200,
        maxHeight: 1200,
      });
      // expected: { sessionId, token, width, height, dominant, palette }
      return data;
    } catch (e) {
      console.warn('Session start failed, using fallback palette:', e?.message);
      return { 
        sessionId: null, 
        token: null, 
        width: 800, 
        height: 600, 
        dominant: fallbackPalette[0], 
        palette: fallbackPalette 
      };
    }
  }, [fallbackPalette]);

  const sampleColor = useCallback(async (sessionToken, nx, ny) => {
    // Live sampling at normalized coordinates
    try {
      if (!sessionToken) return { hex: extractedColor };
      const data = await ApiService.sampleImageColor(sessionToken, { nx, ny });
      // expected: { hex, rgb, hsl }
      return data;
    } catch (e) {
      console.warn('Color sampling failed:', e?.message);
      return { hex: extractedColor };
    }
  }, [extractedColor]);

  const closeSession = useCallback(async (sessionId) => {
    // Explicit cleanup
    try {
      if (!sessionId) return;
      await ApiService.closeImageExtractSession(sessionId);
    } catch (e) {
      console.warn('Session cleanup failed:', e?.message);
    }
  }, []);

  const processImage = useCallback(async (asset) => {
    setIsLoading(true);
    try {
      setSelectedImage(asset);
      const sessionResult = await startSession(asset.uri);
      setSessionData(sessionResult);
      
      const srvPalette = sessionResult.palette;
      setPalette(Array.isArray(srvPalette) && srvPalette.length ? srvPalette : fallbackPalette);
      setExtractedColor(sessionResult.dominant || fallbackPalette[0]);
    } catch (e) {
      setPalette(fallbackPalette);
      setExtractedColor(fallbackPalette[0]);
      setSessionData(null);
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, [startSession, fallbackPalette]);

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
      if (!result.canceled && result.assets?.[0]) {
        await processImage(result.assets[0]);
      } else {
        onClose?.();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image');
      onClose?.();
    }
  }, [onClose, processImage]);

  // mount
  useEffect(() => {
    mounted.current = true;
    (async () => {
      if (initialImageUri) {
        await processImage({ uri: initialImageUri });
      } else {
        await pickImage();
      }
    })();
    return () => { mounted.current = false; };
  }, [initialImageUri, pickImage, processImage]);

  // Explicit session cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionData?.sessionId || sessionData?.imageId) {
        // Cleanup session immediately on unmount (don't rely on TTL)
        closeSession(sessionData.sessionId || sessionData.imageId);
      }
    };
  }, [sessionData, closeSession]);

  // --- dual-flow action handlers --------------------------------------------
  const handleExportToWheel = useCallback(() => {
    const resultData = {
      imageUri: selectedImage?.uri || initialImageUri,
      slots: palette,
      dominant: chooseDominant(palette),
    };

    if (!navigateOnActions && onComplete) {
      // Modal/callback flow
      onComplete(resultData);
    } else if (navigateOnActions && navigation) {
      // Navigation flow
      navigation.navigate('ColorWheel', {
        palette: resultData.slots,
        baseHex: resultData.dominant,
        from: 'extractor',
      });
    } else {
      Alert.alert('Error', 'Cannot complete action - missing navigation or callback');
    }
  }, [navigateOnActions, onComplete, navigation, selectedImage, initialImageUri, palette, chooseDominant]);

  const handleSaveToBoard = useCallback(() => {
    const resultData = {
      imageUri: selectedImage?.uri || initialImageUri,
      slots: palette,
      dominant: chooseDominant(palette),
    };

    if (!navigateOnActions && onSaveToBoard) {
      // Modal/callback flow
      onSaveToBoard(resultData);
    } else if (navigateOnActions && navigation) {
      // Navigation flow
      navigation.navigate('Profile', {
        imageUri: resultData.imageUri,
        palette: resultData.slots,
        dominant: resultData.dominant,
        from: 'extractor',
      });
    } else {
      Alert.alert('Error', 'Cannot save to board - missing navigation or callback');
    }
  }, [navigateOnActions, onSaveToBoard, navigation, selectedImage, initialImageUri, palette, chooseDominant]);

  // --- interaction ---------------------------------------------------------
  const extractColorAtPosition = useCallback(async (relativeX, relativeY) => {
    if (!sessionData?.token) {
      // Fallback: pick color from palette if no session
      if (!palette.length) return;
      const idx = Math.max(0, Math.min(palette.length - 1, Math.floor((relativeX + relativeY) * palette.length) % palette.length));
      setExtractedColor(palette[idx]);
      return;
    }

    // Live sampling using session API
    try {
      const { hex } = await sampleColor(sessionData.token, relativeX, relativeY);
      if (hex && mounted.current) {
        setExtractedColor(hex);
      }
    } catch (e) {
      console.warn('Live sampling failed:', e?.message);
      // Fallback to palette selection
      if (palette.length) {
        const idx = Math.max(0, Math.min(palette.length - 1, Math.floor((relativeX + relativeY) * palette.length) % palette.length));
        setExtractedColor(palette[idx]);
      }
    }
  }, [sessionData, sampleColor, palette]);

  const updateMagnifierPosition = useCallback(async (x, y) => {
    const w = imageLayout.width || 1;
    const h = imageLayout.height || 1;
    const cx = Math.max(MAGNIFIER_SIZE / 2, Math.min(w - MAGNIFIER_SIZE / 2, x));
    const cy = Math.max(MAGNIFIER_SIZE / 2, Math.min(h - MAGNIFIER_SIZE / 2, y));
    setMagnifierPosition({ x: cx, y: cy });
    await extractColorAtPosition(cx / w, cy / h);
  }, [imageLayout.width, imageLayout.height, extractColorAtPosition]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      if (!selectedImage) return;
      const { locationX, locationY } = evt.nativeEvent;
      updateMagnifierPosition(locationX, locationY);
    },
    onPanResponderMove: (evt) => {
      if (!selectedImage) return;
      const { locationX, locationY } = evt.nativeEvent;
      updateMagnifierPosition(locationX, locationY);
    },
  }), [selectedImage, updateMagnifierPosition]);



  const onImageLayout = useCallback((event) => {
    const { width, height, x, y } = event.nativeEvent.layout;
    setImageLayout({ width, height, x, y });
    if (width > 0 && height > 0) {
      setMagnifierPosition({ x: width / 2, y: height / 2 });
      extractColorAtPosition(0.5, 0.5);
    }
  }, [extractColorAtPosition]);

  const handleUseOnWheel = useCallback(() => {
    onColorExtracted?.(extractedColor);
  }, [extractedColor, onColorExtracted]);

  const handleCreateCollagePress = useCallback(() => {
    if (onCreateCollage && selectedImage) onCreateCollage(selectedImage, extractedColor);
  }, [onCreateCollage, selectedImage, extractedColor]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Processing image…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Color Extractor</Text>
        <TouchableOpacity
          onPress={() => initialImageUri ? pickImage() : handleUseOnWheel()}
          style={styles.nextButton}
        >
          <Text style={styles.nextButtonText}>{initialImageUri ? 'Pick another' : 'Next'}</Text>
        </TouchableOpacity>
      </View>

      {/* Image */}
      {selectedImage && (
        <View style={styles.imageContainer}>
          <View style={styles.imageWrapper} {...panResponder.panHandlers}>
            <Image
              source={{ uri: selectedImage.uri }}
              style={styles.image}
              resizeMode="contain"
              onLayout={onImageLayout}
            />
            {/* Magnifier */}
            <View
              style={[styles.magnifier, { left: magnifierPosition.x - MAGNIFIER_SIZE / 2, top: magnifierPosition.y - MAGNIFIER_SIZE / 2 }]}
            >
              <View style={styles.magnifierInner}>
                {/* Contrast back ring to keep the colored ring visible on any photo */}
                <View style={styles.dominantRingBack} />

                {/* The dominant color ring (updates live with extractedColor) */}
                <View style={[styles.dominantRing, { borderColor: extractedColor }]} />

                {/* Optional tiny center dot filled with the color */}
                <View style={[styles.dominantCenterDot, { backgroundColor: extractedColor }]} />

                {/* Existing crosshair stays on top for precise aiming */}
                <View style={styles.crosshair}>
                  <View style={styles.crosshairHorizontal} />
                  <View style={styles.crosshairVertical} />
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Palette + selected color */}
      <View style={styles.colorBarContainer}>
        <View style={[styles.colorBar, { backgroundColor: extractedColor }]}>
          <View style={styles.colorDot} />
        </View>
        <Text style={styles.colorText}>{extractedColor.toUpperCase()}</Text>

        {palette.length > 0 && (
          <View style={styles.paletteRow}>
            {palette.slice(0, 8).map((c) => (
              <TouchableOpacity key={c} onPress={() => setExtractedColor(c)}>
                <View style={[styles.paletteSwatch, { backgroundColor: c, borderColor: c === extractedColor ? '#000' : '#fff' }]} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={handleSaveToBoard}>
          <Text style={styles.secondaryButtonText}>Save to Board</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.primaryButton]} onPress={handleExportToWheel}>
          <Text style={styles.primaryButtonText}>
            {!navigateOnActions && onComplete ? 'Use Palette' : 'Export to Color Wheel'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { fontSize: 16, color: '#666' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, backgroundColor: '#fff' },
  closeButton: { padding: 10 },
  closeButtonText: { fontSize: 18, color: '#333' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  nextButton: { padding: 10 },
  nextButtonText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  imageContainer: { flex: 1, paddingHorizontal: 20 },
  imageWrapper: { flex: 1, position: 'relative' },
  image: { width: '100%', height: '100%' },
  magnifier: { position: 'absolute', width: MAGNIFIER_SIZE, height: MAGNIFIER_SIZE, borderRadius: MAGNIFIER_SIZE / 2, borderWidth: 4, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.9)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  magnifierInner: { flex: 1, borderRadius: (MAGNIFIER_SIZE - 8) / 2, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  // Ring sizes derived from the magnifier size
  dominantRingBack: {
    position: 'absolute',
    width: MAGNIFIER_SIZE - 24,   // slightly larger than the color ring for contrast
    height: MAGNIFIER_SIZE - 24,
    borderRadius: (MAGNIFIER_SIZE - 24) / 2,
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  dominantRing: {
    position: 'absolute',
    width: MAGNIFIER_SIZE - 30,   // main color ring
    height: MAGNIFIER_SIZE - 30,
    borderRadius: (MAGNIFIER_SIZE - 30) / 2,
    borderWidth: 6,               // ring thickness
  },
  dominantCenterDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  crosshair: { position: 'absolute', width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  crosshairHorizontal: { position: 'absolute', width: 20, height: 2, backgroundColor: '#333' },
  crosshairVertical: { position: 'absolute', width: 2, height: 20, backgroundColor: '#333' },
  colorBarContainer: { paddingHorizontal: 20, paddingVertical: 20, backgroundColor: '#fff', alignItems: 'center' },
  colorBar: { width: screenWidth - 40, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  colorDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', borderWidth: 2, borderColor: 'rgba(0,0,0,0.2)' },
  colorText: { fontSize: 16, fontWeight: '600', color: '#333' },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  paletteSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, marginRight: 6 },
  actionButtonsContainer: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 40, gap: 12 },
  actionButton: { flex: 1, paddingVertical: 16, borderRadius: 25, alignItems: 'center' },
  primaryButton: { backgroundColor: '#007AFF' },
  secondaryButton: { backgroundColor: '#f8f8f8', borderWidth: 1, borderColor: '#e0e0e0' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButtonText: { color: '#333', fontSize: 16, fontWeight: '600' },
});
