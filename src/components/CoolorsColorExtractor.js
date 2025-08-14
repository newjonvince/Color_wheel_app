// CoolorsColorExtractor.js — interactive magnifier with live palette slots
// Drop-in replacement. Requires server endpoints:
//  - POST /images/extract-colors   (multipart: image) -> { dominant, palette: ["#..."] }
//  - POST /images/sample-color     (multipart: image + {x,y,radius} or JSON alongside) -> { hex }
// If /sample-color isn't available, the component falls back to approximating from the initial palette.
//
// Props:
//  - initialImageUri?: string
//  - initialSlots?: number (default 5)
//  - onComplete?(result: { imageUri, slots: string[], activeIndex: number }): void
//  - onColorExtracted?(hex: string): void  // kept for backward-compat (uses slots[0])
//
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, Alert, StyleSheet, Dimensions, PanResponder } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import ApiService from '../services/api'; // <- uses the new file

// Safe wrapper to log real errors + stack traces from component layer
const safe = (fn, context = 'unknown') => (...args) => {
  try {
    return fn(...args);
  } catch (error) {
    console.error(`🚨 CoolorsColorExtractor Error in ${context}:`, error);
    console.error('Stack trace:', error.stack);
    console.error('Args:', args);
    throw error; // Re-throw to maintain error handling flow
  }
};

// iOS image safety: Re-encode to JPEG to avoid HEIC 415 from server
const prepareAssetForUpload = async (asset) => {
  try {
    // Re-encode to JPEG to avoid HEIC 415 from server
    const manip = await ImageManipulator.manipulateAsync(
      asset.uri,
      [], // no transforms
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
    return { ...asset, uri: manip.uri };
  } catch (error) {
    console.warn('Failed to prepare asset for upload, using original:', error);
    return asset; // Fallback to original if manipulation fails
  }
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
// Match your screenshots (large lens) while staying responsive
const MAGNIFIER_SIZE = Math.max(110, Math.min(Math.round(screenWidth * 0.28), 160));
const DEFAULT_SLOTS = 5;

// Small throttle helper (leading, trailing last call after delay)
function useThrottle(fn, ms) {
  const last = useRef(0);
  const trailing = useRef(null);
  return useCallback((...args) => {
    const now = Date.now();
    const remaining = ms - (now - last.current);
    if (remaining <= 0) {
      last.current = now;
      fn(...args);
    } else {
      clearTimeout(trailing.current);
      trailing.current = setTimeout(() => {
        last.current = Date.now();
        fn(...args);
      }, remaining);
    }
  }, [fn, ms]);
}

export default function CoolorsColorExtractor({
  mode = 'gallery',                // 'camera' | 'gallery'
  initialImageUri,
  initialSlots = DEFAULT_SLOTS,
  onComplete,
  onColorExtracted,                // optional: uses slots[0]
  onCreateCollage,
  onClose,
}) {
  const [selectedImage, setSelectedImage] = useState(null); // { uri }
  const [isLoading, setIsLoading] = useState(false);

  const [serverPalette, setServerPalette] = useState([]); // reference palette from the server
  const [imageToken, setImageToken] = useState(null);     // <-- session id from backend
  const [sampleRadius, setSampleRadius] = useState(0.02); // 2% of min dimension

  // layout and magnifier
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [magnifierPosition, setMagnifierPosition] = useState({ x: screenWidth / 2, y: screenHeight / 2 });

  // palette & slots
  const [slots, setSlots] = useState(Array.from({ length: initialSlots }, () => '#CCCCCC'));
  const [activeIndex, setActiveIndex] = useState(0);

  // live color under magnifier
  const [magnifierColor, setMagnifierColor] = useState('#FF6B6B');
  const [liveColor, setLiveColor] = useState('#FF6B6B');
  const [previousColor, setPreviousColor] = useState('#FF6B6B');

  const fallbackPalette = useMemo(() => (
    ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FECA57','#FF9FF3','#54A0FF','#5F27CD','#00D2D3','#FF9F43','#10AC84','#EE5A24','#0984E3','#A29BFE','#6C5CE7']
  ), []);

  const fillSlots = useCallback((paletteArr) => {
    const base = Array.from({ length: Math.max(initialSlots, 1) }, (_, i) => paletteArr[i % paletteArr.length] || '#CCCCCC');
    setSlots(base);
    setMagnifierColor(base[0] || '#808080');
  }, [initialSlots]);

  // --- permissions and picking --------------------------------------------------
  const ensurePermissions = useCallback(async () => {
    if (initialImageUri) return true;
    if (mode === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take a photo.');
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required to pick an image.');
        return false;
      }
    }
    return true;
  }, [mode, initialImageUri]);

  const launchPicker = useCallback(async () => {
    if (initialImageUri) {
      return { cancelled: false, assets: [{ uri: initialImageUri }] };
    }
    if (mode === 'camera') {
      return await ImagePicker.launchCameraAsync({ quality: 0.9 });
    }
    return await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
  }, [mode, initialImageUri]);

  const fillSlotsFromPalette = useCallback((paletteArr) => {
    const base = Array.from({ length: Math.max(initialSlots, 1) }, (_, i) => paletteArr[i % paletteArr.length] || '#CCCCCC');
    setSlots(base);
    setLiveColor(base[0] || '#808080');
  }, [initialSlots]);

  const callServerSample = useCallback(async (imageId, normX, normY, radius = 0.02) => {
    // Throttled elsewhere; keep this fast.
    try {
      if (!imageId) throw new Error('No image session');
      if (ApiService?.sampleColorAt) {
        return await ApiService.sampleColorAt(imageId, normX, normY, radius);
      }
      // Safe optional-chaining to prevent crashes if ApiService is undefined
      const apiBase = ApiService?.baseURL?.replace(/\/?$/, '');
      if (!apiBase) {
        throw new Error('API base URL unavailable');
      }
      const url = `${apiBase}/images/sample-color`;
      const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ imageId, x: normX, y: normY, units:'norm', radius }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json(); // { hex }
    } catch (e) {
      console.error('🚨 CoolorsColorExtractor Error in callServerSample:', e);
      console.error('Stack trace:', e.stack);
      console.error('Args:', { imageId, normX, normY, radius });
      
      // Check for session expiration (404 error)
      if (e.message && e.message.includes('404')) {
        Alert.alert(
          'Session expired',
          'Session expired — Reopen image',
          [
            { text: 'OK', onPress: () => onClose?.() }
          ]
        );
        return { hex: liveColor }; // Return current color to avoid UI flicker
      }
      
      // fallback: snap to nearest server palette color
      const approx = nearestFromPalette(liveColor, serverPalette.length ? serverPalette : fallbackPalette);
      return { hex: approx };
    }
  }, [fallbackPalette, liveColor, serverPalette]);

  const hexToRgb = (hex) => {
    const h = hex.replace('#','');
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return {r,g,b};
  };

  const deltaE = (hex1, hex2) => {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    // Simple RGB distance (approximates Delta-E for haptic threshold)
    return Math.sqrt((rgb1.r-rgb2.r)**2 + (rgb1.g-rgb2.g)**2 + (rgb1.b-rgb2.b)**2);
  };

  const nearestFromPalette = (hex, palette) => {
    const {r, g, b} = hexToRgb(hex);
    let best = palette[0], bestD = Infinity;
    palette.forEach(p => {
      const {r:pr, g:pg, b:pb} = hexToRgb(p);
      const d = Math.sqrt((r-pr)**2 + (g-pg)**2 + (b-pb)**2);
      if (d < bestD) { bestD = d; best = p; }
    });
    return best;
  };

  const processImage = useCallback(async (asset) => {
    setIsLoading(true);
    try {
      setSelectedImage(asset);
      console.log('CoolorsColorExtractor: Processing image with ApiService.extractColorsFromImage');
      
      // iOS image safety: Re-encode to JPEG to avoid HEIC 415 from server
      const assetSafe = await prepareAssetForUpload(asset);
      
      // Use the proper ApiService method for backend extraction
      const response = await ApiService.extractColorsFromImage(assetSafe.uri, {
        onProgress: (progress) => {
          console.log(`Upload progress: ${progress}%`);
        }
      });
      
      const { dominant, palette, imageId } = response;
      setImageToken(imageId || null);
      const basePalette = (Array.isArray(palette) && palette.length) ? palette : fallbackPalette;
      setServerPalette(basePalette);
      fillSlotsFromPalette(basePalette);
      
      // preselect first slot with dominant
      setSlots(prev => {
        const next = [...prev];
        next[0] = dominant || basePalette[0];
        return next;
      });
      setLiveColor(dominant || basePalette[0]);
      
      console.log('CoolorsColorExtractor: Image processed successfully, dominant:', dominant);
    } catch (e) {
      console.error('🚨 CoolorsColorExtractor Error in processImage:', e);
      console.error('Stack trace:', e.stack);
      console.error('Asset:', asset);
      setServerPalette(fallbackPalette);
      fillSlotsFromPalette(fallbackPalette);
    } finally {
      setIsLoading(false);
    }
  }, [fallbackPalette, fillSlotsFromPalette]);

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
      console.error('🚨 CoolorsColorExtractor Error in pickImage:', error);
      console.error('Stack trace:', error.stack);
      Alert.alert('Error', 'Failed to select image');
      onClose?.();
    }
  }, [onClose, processImage]);

  useEffect(() => {
    (async () => {
      if (initialImageUri) {
        await processImage({ uri: initialImageUri });
        return;
      }
      // Honor `mode` and request permissions
      const perm = await (mode === 'camera'
        ? ImagePicker.requestCameraPermissionsAsync()
        : ImagePicker.requestMediaLibraryPermissionsAsync());
      if (perm.status !== 'granted') {
        Alert.alert('Permission needed', mode === 'camera'
          ? 'Camera permission is required to take a photo.'
          : 'Photo library permission is required to pick an image.');
        onClose?.();
        return;
      }
      const result = await (mode === 'camera'
        ? ImagePicker.launchCameraAsync({ quality: 0.9 })
        : ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 }));
      if (!result?.canceled && result.assets?.[0]) await processImage(result.assets[0]);
      else onClose?.();
    })();
  }, [initialImageUri, mode, onClose, processImage]);

  // Close server session on unmount
  useEffect(() => () => { if (imageToken) ApiService.closeImageSession(imageToken); }, [imageToken]);

  // --- magnifier interactions ---------------------------------------------------
  const updateActiveSlot = useCallback((hex) => {
    setSlots(prev => {
      const next = [...prev];
      next[activeIndex] = hex;
      return next;
    });
    setLiveColor(hex);
  }, [activeIndex]);

  const throttledSample = useThrottle(async (nx, ny) => {
    if (!selectedImage) return;
    const out = await callServerSample(imageToken, nx, ny, sampleRadius);
    const hex = (out && out.hex) ? out.hex.toUpperCase() : liveColor;
    
    // Haptic feedback on significant color change (ΔE threshold)
    const colorDelta = deltaE(hex, previousColor);
    if (colorDelta > 30) { // Threshold for haptic tick (RGB distance ~30)
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (_) {} // Ignore haptic errors
      setPreviousColor(hex);
    }
    
    // Update both the magnifier display color and the active slot
    setMagnifierColor(hex);
    setLiveColor(hex);
    
    // Update the active slot in the palette
    setSlots(prev => {
      const next = [...prev];
      next[activeIndex] = hex;
      return next;
    });
  }, 125); // ~8Hz

  const extractAt = useCallback((x, y) => {
    const w = imageLayout.width || 1;
    const h = imageLayout.height || 1;
    const cx = Math.max(MAGNIFIER_SIZE/2, Math.min(w - MAGNIFIER_SIZE/2, x));
    const cy = Math.max(MAGNIFIER_SIZE/2, Math.min(h - MAGNIFIER_SIZE/2, y));
    setMagnifierPosition({ x: cx, y: cy });
    const nx = cx / w, ny = cy / h;
    throttledSample(nx, ny);
  }, [imageLayout.height, imageLayout.width, throttledSample]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      if (!selectedImage) return;
      const { locationX, locationY } = evt.nativeEvent;
      extractAt(locationX, locationY);
    },
    onPanResponderMove: (evt) => {
      if (!selectedImage) return;
      const { locationX, locationY } = evt.nativeEvent;
      extractAt(locationX, locationY);
    },
  }), [selectedImage, extractAt]);

  const onImageLayout = useCallback((event) => {
    const { width, height, x, y } = event.nativeEvent.layout;
    setImageLayout({ width, height, x, y });
    if (width > 0 && height > 0) {
      setMagnifierPosition({ x: width / 2, y: height / 2 });
    }
  }, []);

  // --- controls with safe error logging -----------------------------------------------------------------
  const addSlot = safe(() => {
    setSlots(prev => [...prev, serverPalette[prev.length % serverPalette.length] || '#CCCCCC']);
  }, 'addSlot');

  const removeSlot = safe(() => {
    setSlots(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
  }, 'removeSlot');

  const nextSlot = safe(() => {
    if (activeIndex < slots.length - 1) {
      setActiveIndex(i => i + 1);
    } else {
      // finished → callbacks
      onComplete?.({ imageUri: selectedImage?.uri, slots, activeIndex });
      onColorExtracted?.(slots[0]);
    }
  }, 'nextSlot');

  const handleUseOnWheel = safe(() => {
    onColorExtracted?.(slots[0]);
    onComplete?.({ imageUri: selectedImage?.uri, slots, activeIndex });
  }, 'handleUseOnWheel');

  const handleCreateCollagePress = safe(() => {
    if (onCreateCollage && selectedImage) onCreateCollage(selectedImage, slots);
  }, 'handleCreateCollagePress');

  // --- UI -----------------------------------------------------------------------
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
        <Text style={styles.headerTitle}>Image picker</Text>
        <TouchableOpacity onPress={nextSlot} style={styles.nextButton}>
          <Text style={styles.nextButtonText}>{activeIndex < slots.length - 1 ? 'Next' : 'Done'}</Text>
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
            {/* Magnifier with colored center showing sampled color */}
            <View
              style={[styles.magnifier, { left: magnifierPosition.x - MAGNIFIER_SIZE / 2, top: magnifierPosition.y - MAGNIFIER_SIZE / 2 }]}
            >
              <View style={[styles.magnifierInner, { borderColor: '#FFFFFF', borderWidth: 6 }]}>
                {/* Colored center circle showing the sampled color */}
                <View style={[styles.magnifierCenter, { backgroundColor: magnifierColor }]}>
                  <View style={styles.crosshair}>
                    <View style={[styles.crosshairHorizontal, { backgroundColor: '#FFFFFF' }]} />
                    <View style={[styles.crosshairVertical, { backgroundColor: '#FFFFFF' }]} />
                  </View>
                </View>
              </View>
              {/* Hex readout below magnifier */}
              <View style={styles.hexReadout}>
                <Text style={styles.hexText}>{magnifierColor}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Slots row */}
      <View style={styles.paletteBar}>
        <View style={styles.slotsRow}>
          {slots.map((c, idx) => (
            <TouchableOpacity key={idx} onPress={() => setActiveIndex(idx)}>
              <View style={[styles.slot, { backgroundColor: c }, activeIndex === idx ? styles.slotActive : null]}>
                {activeIndex === idx && <View style={styles.slotDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* plus / minus */}
        <View style={styles.slotActions}>
          <TouchableOpacity style={styles.circleBtn} onPress={removeSlot}><Text style={styles.circleBtnText}>−</Text></TouchableOpacity>
          <TouchableOpacity style={styles.circleBtn} onPress={addSlot}><Text style={styles.circleBtnText}>＋</Text></TouchableOpacity>
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
  magnifier: { position: 'absolute', width: MAGNIFIER_SIZE, height: MAGNIFIER_SIZE, borderRadius: MAGNIFIER_SIZE / 2, backgroundColor: 'rgba(255,255,255,0.85)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5, borderWidth: 6, borderColor: '#fff' },
  magnifierInner: { flex: 1, borderRadius: (MAGNIFIER_SIZE - 12) / 2, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 4 },
  magnifierCenter: { width: '100%', height: '100%', borderRadius: (MAGNIFIER_SIZE - 18) / 2, justifyContent: 'center', alignItems: 'center' },
  crosshair: { position: 'absolute', width: 22, height: 22, justifyContent: 'center', alignItems: 'center' },
  crosshairHorizontal: { position: 'absolute', width: 22, height: 2, backgroundColor: '#FFFFFF' },
  crosshairVertical: { position: 'absolute', width: 2, height: 22, backgroundColor: '#FFFFFF' },
  
  // Hex readout below magnifier
  hexReadout: { 
    position: 'absolute', 
    top: MAGNIFIER_SIZE + 8, 
    left: -20, 
    right: -20, 
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)', 
    borderRadius: 12, 
    paddingVertical: 6, 
    paddingHorizontal: 12 
  },
  hexText: { 
    color: '#FFFFFF', 
    fontSize: 14, 
    fontWeight: '600', 
    fontFamily: 'monospace' 
  },

  paletteBar: { backgroundColor: '#fff', paddingVertical: 16, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e6e6e6' },
  slotsRow: { flexDirection: 'row', alignItems: 'center' },
  slot: { width: (screenWidth - 32 - 100) / 5, maxWidth: 80, height: 44, borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: '#e6e6e6', justifyContent: 'center', alignItems: 'center' },
  slotActive: { borderColor: '#000' },
  slotDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#000' },
  slotActions: { flexDirection: 'row', position: 'absolute', right: 16, top: 12 },
  circleBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  circleBtnText: { fontSize: 20, color: '#333', fontWeight: '600' },

  actionButtonsContainer: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 40, gap: 12 },
  actionButton: { flex: 1, paddingVertical: 16, borderRadius: 25, alignItems: 'center' },
  primaryButton: { backgroundColor: '#007AFF' },
  secondaryButton: { backgroundColor: '#f8f8f8', borderWidth: 1, borderColor: '#e0e0e0' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButtonText: { color: '#333', fontSize: 16, fontWeight: '600' },
});
