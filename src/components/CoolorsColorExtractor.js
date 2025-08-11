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
//  - onCreateCollage?(imageAssetOrUri, slotsArray): void
//  - onClose(): void
//
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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const MAGNIFIER_SIZE = 120;
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
  initialImageUri,
  initialSlots = DEFAULT_SLOTS,
  onComplete,
  onColorExtracted,
  onCreateCollage,
  onClose,
}) {
  const [selectedImage, setSelectedImage] = useState(null); // { uri, width?, height? }
  const [isLoading, setIsLoading] = useState(false);

  // layout state
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [magnifierPosition, setMagnifierPosition] = useState({ x: screenWidth / 2, y: screenHeight / 2 });

  // palette & slots
  const [serverPalette, setServerPalette] = useState([]); // reference palette from the server
  const [slots, setSlots] = useState(Array.from({ length: initialSlots }, () => '#CCCCCC'));
  const [activeIndex, setActiveIndex] = useState(0);

  // current color under magnifier (not yet committed unless we are on active slot)
  const [liveColor, setLiveColor] = useState('#808080');

  // --- helpers -----------------------------------------------------------------
  const fallbackPalette = useMemo(() => (
    ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FECA57','#FF9FF3','#54A0FF','#5F27CD','#00D2D3','#FF9F43','#10AC84','#EE5A24','#0984E3','#A29BFE','#6C5CE7']
  ), []);

  const fillSlotsFromPalette = useCallback((paletteArr) => {
    const base = Array.from({ length: Math.max(initialSlots, 1) }, (_, i) => paletteArr[i % paletteArr.length] || '#CCCCCC');
    setSlots(base);
    setLiveColor(base[0] || '#808080');
  }, [initialSlots]);

  const callServerSample = useCallback(async (uri, normX, normY, radius = 0.02) => {
    // Throttled elsewhere; keep this fast.
    try {
      if (ApiService?.sampleColorAt) {
        return await ApiService.sampleColorAt(uri, normX, normY, radius);
      }
      const apiBase = ApiService.baseURL?.replace(/\/?$/, '');
      const url = `${apiBase}/images/sample-color`;
      const form = new FormData();
      form.append('image', { uri, name: 'upload.jpg', type: 'image/jpeg' });
      form.append('x', String(normX));
      form.append('y', String(normY));
      form.append('radius', String(radius));
      const headers = { Accept: 'application/json' };
      if (ApiService.token) headers['Authorization'] = `Bearer ${ApiService.token}`;
      const res = await fetch(url, { method: 'POST', headers, body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json(); // { hex }
    } catch (e) {
      // fallback: snap to nearest server palette color
      const approx = nearestFromPalette(liveColor, serverPalette.length ? serverPalette : fallbackPalette);
      return { hex: approx };
    }
  }, [fallbackPalette, liveColor, serverPalette]);

  // simple distance on RGB
  const hexToRgb = (hex) => {
    const h = hex.replace('#','');
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return {r,g,b};
  };
  const nearestFromPalette = (hex, palette) => {
    const {r, g, b} = hexToRgb(hex);
    let best = palette[0], bestD = Infinity;
    palette.forEach(p => {
      const q = hexToRgb(p);
      const d = (r-q.r)**2 + (g-q.g)**2 + (b-q.b)**2;
      if (d < bestD) { bestD = d; best = p; }
    });
    return best;
  };

  const processImage = useCallback(async (asset) => {
    setIsLoading(true);
    try {
      setSelectedImage(asset);
      console.log('CoolorsColorExtractor: Processing image with ApiService.extractColorsFromImage');
      
      // Use the proper ApiService method for backend extraction
      const response = await ApiService.extractColorsFromImage(asset.uri, {
        onProgress: (progress) => {
          console.log(`Upload progress: ${progress}%`);
        }
      });
      
      const { dominant, palette } = response;
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
      console.error('CoolorsColorExtractor: processImage error', e);
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
      Alert.alert('Error', 'Failed to select image');
      onClose?.();
    }
  }, [onClose, processImage]);

  // mount init
  useEffect(() => {
    (async () => {
      if (initialImageUri) await processImage({ uri: initialImageUri });
      else await pickImage();
    })();
  }, [initialImageUri, pickImage, processImage]);

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
    const out = await callServerSample(selectedImage.uri, nx, ny, 0.02);
    const hex = (out && out.hex) ? out.hex.toUpperCase() : liveColor;
    updateActiveSlot(hex);
  }, 120); // ~8 samples/sec

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

  // --- controls -----------------------------------------------------------------
  const addSlot = () => setSlots(prev => [...prev, serverPalette[prev.length % serverPalette.length] || '#CCCCCC']);
  const removeSlot = () => setSlots(prev => prev.length > 1 ? prev.slice(0, -1) : prev);

  const nextSlot = () => {
    if (activeIndex < slots.length - 1) {
      setActiveIndex(i => i + 1);
    } else {
      // finished → callbacks
      onComplete?.({ imageUri: selectedImage?.uri, slots, activeIndex });
      onColorExtracted?.(slots[0]);
    }
  };

  const handleUseOnWheel = () => {
    onColorExtracted?.(slots[0]);
    onComplete?.({ imageUri: selectedImage?.uri, slots, activeIndex });
  };

  const handleCreateCollagePress = () => {
    if (onCreateCollage && selectedImage) onCreateCollage(selectedImage, slots);
  };

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
            {/* Magnifier with colored ring */}
            <View
              style={[styles.magnifier, { left: magnifierPosition.x - MAGNIFIER_SIZE / 2, top: magnifierPosition.y - MAGNIFIER_SIZE / 2 }]}
            >
              <View style={[styles.magnifierInner, { borderColor: liveColor }]}>
                <View style={styles.crosshair}>
                  <View style={styles.crosshairHorizontal} />
                  <View style={styles.crosshairVertical} />
                </View>
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
  crosshair: { position: 'absolute', width: 22, height: 22, justifyContent: 'center', alignItems: 'center' },
  crosshairHorizontal: { position: 'absolute', width: 22, height: 2, backgroundColor: '#333' },
  crosshairVertical: { position: 'absolute', width: 2, height: 22, backgroundColor: '#333' },

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
