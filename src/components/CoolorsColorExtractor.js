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
  ScrollView,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import ApiService from '../services/api';
import { hexToHsl } from '../utils/color';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const MAGNIFIER_SIZE = 120;

/**
 * Props:
 *  - initialImageUri?: string  // when provided, skips gallery and loads this image directly (e.g., from camera)
 *  - onColorExtracted(hex: string): void
 *  - onCreateCollage?(imageAssetOrUri, hex): void
 *  - onClose(): void
 */
export default function CoolorsColorExtractor({ initialImageUri, onColorExtracted, onCreateCollage, onClose }) {
  const [selectedImage, setSelectedImage] = useState(null); // { uri }
  const [magnifierPosition, setMagnifierPosition] = useState({ x: screenWidth / 2, y: screenHeight / 2 });
  const [extractedColor, setExtractedColor] = useState('#808080');
  const [palette, setPalette] = useState([]); // ['#xxxxxx']
  const [isLoading, setIsLoading] = useState(false);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [swatchCount, setSwatchCount] = useState(5); // Palette swatch count control
  const mounted = useRef(true);

  // Gesture values for pinch-to-zoom and pan
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // --- helpers --------------------------------------------------------------
  const fallbackPalette = useMemo(() => (
    ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FECA57','#FF9FF3','#54A0FF','#5F27CD','#00D2D3','#FF9F43','#10AC84','#EE5A24','#0984E3','#A29BFE','#6C5CE7']
  ), []);

  // Palette swatch count controls
  const incrementSwatchCount = () => setSwatchCount(c => Math.min(8, c + 1));
  const decrementSwatchCount = () => setSwatchCount(c => Math.max(3, c - 1));

  const chooseDominant = useCallback((paletteArray) => paletteArray?.[0] || '#808080', []);

  const callServerExtract = useCallback(async (uri) => {
    // Uses the API base URL from ApiService and includes auth token if present.
    // Endpoint implemented below: POST /images/extract-colors (multipart/form-data)
    try {
      const apiBase = ApiService.baseURL?.replace(/\/?$/, ''); // no trailing slash
      const url = `${apiBase}/images/extract-colors`;

      const form = new FormData();
      form.append('image', { uri, name: 'upload.jpg', type: 'image/jpeg' });

      const headers = { Accept: 'application/json' };
      if (ApiService.token) headers['Authorization'] = `Bearer ${ApiService.token}`;

      const res = await fetch(url, { method: 'POST', headers, body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // expected: { dominant: '#rrggbb', palette: ['#..', ...] }
      return data;
    } catch (e) {
      console.warn('Server extraction failed, using fallback palette:', e?.message);
      return { dominant: fallbackPalette[0], palette: fallbackPalette };
    }
  }, [fallbackPalette]);

  const processImage = useCallback(async (asset) => {
    setIsLoading(true);
    try {
      setSelectedImage(asset);
      const { dominant, palette: srvPalette } = await callServerExtract(asset.uri);
      setPalette(Array.isArray(srvPalette) && srvPalette.length ? srvPalette : fallbackPalette);
      setExtractedColor(dominant || fallbackPalette[0]);
    } catch (e) {
      setPalette(fallbackPalette);
      setExtractedColor(fallbackPalette[0]);
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, [callServerExtract, fallbackPalette]);

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

  // --- interaction ---------------------------------------------------------
  const extractColorAtPosition = useCallback((relativeX, relativeY) => {
    if (!palette.length) return;
    // Simple mapping: pick color index based on relative position.
    const idx = Math.max(0, Math.min(palette.length - 1, Math.floor((relativeX + relativeY) * palette.length) % palette.length));
    setExtractedColor(palette[idx]);
  }, [palette]);

  const updateMagnifierPosition = useCallback((x, y) => {
    const w = imageLayout.width || 1;
    const h = imageLayout.height || 1;
    const cx = Math.max(MAGNIFIER_SIZE / 2, Math.min(w - MAGNIFIER_SIZE / 2, x));
    const cy = Math.max(MAGNIFIER_SIZE / 2, Math.min(h - MAGNIFIER_SIZE / 2, y));
    setMagnifierPosition({ x: cx, y: cy });
    extractColorAtPosition(cx / w, cy / h);
  }, [imageLayout.width, imageLayout.height, extractColorAtPosition]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(4, e.scale));
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      // Boundaries are rough; you can refine with imageLayout (w,h)
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd(() => {
      // gentle settle
      translateX.value = withTiming(translateX.value, { duration: 120 });
      translateY.value = withTiming(translateY.value, { duration: 120 });
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setMagnifierPosition({ x: locationX, y: locationY });
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setMagnifierPosition({ x: locationX, y: locationY });
    },
  }), []);

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
          <GestureDetector gesture={composed}>
            <Animated.View style={[styles.imageWrapper, imageStyle]} {...panResponder.panHandlers}>
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.image}
                resizeMode="contain"
                onLayout={onImageLayout}
              />
              {/* magnifier stays positioned in image coordinates */}
              <View
                style={[
                  styles.magnifier,
                  {
                    left: magnifierPosition.x - MAGNIFIER_SIZE / 2,
                    top: magnifierPosition.y - MAGNIFIER_SIZE / 2,
                  },
                ]}
              >
                <View style={styles.magnifierInner}>
                  <View style={styles.crosshair}>
                    <View style={styles.crosshairHorizontal} />
                    <View style={styles.crosshairVertical} />
                  </View>
                  {/* Contrast back ring to keep the colored ring visible on any photo */}
                  <View style={styles.dominantRingBack} />

                  {/* The dominant color ring (updates live with extractedColor) */}
                  <View style={[styles.dominantRing, { borderColor: extractedColor }]} />

                  {/* Optional tiny center dot filled with the color */}
                  <View style={[styles.dominantCenterDot, { backgroundColor: extractedColor }]} />
                </View>
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      )}

      {/* Palette + selected color */}
      <View style={styles.colorBarContainer}>
        <View style={[styles.colorBar, { backgroundColor: extractedColor }]}>
          <View style={styles.colorDot} />
        </View>
        <Text style={styles.colorText}>{extractedColor.toUpperCase()}</Text>

        <View style={{ paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#fff' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 8 }}>
            {palette.slice(0, swatchCount).map((color, idx) => (
              <TouchableOpacity key={`${color}-${idx}`} onPress={() => setExtractedColor(color)}>
                <View style={[
                  { width: 54, height: 40, borderRadius: 8, marginRight: 8, backgroundColor: color },
                  extractedColor === color && { borderColor: '#333', borderWidth: 3 }
                ]} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingVertical: 8 }}>
            <TouchableOpacity onPress={decrementSwatchCount} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#eee', alignItems:'center', justifyContent:'center' }}>
              <Text style={{ fontSize: 18 }}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={incrementSwatchCount} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#eee', alignItems:'center', justifyContent:'center' }}>
              <Text style={{ fontSize: 18 }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={handleCreateCollagePress}>
          <Text style={styles.secondaryButtonText}>Create Collage</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.primaryButton]} onPress={handleUseOnWheel}>
          <Text style={styles.primaryButtonText}>View on Color Wheel</Text>
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
