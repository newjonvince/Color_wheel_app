// CoolorsColorExtractor.js (v3) — session-based, UI-thread safe for Reanimated worklets
// Fixes release crash by avoiding JS object captures inside worklets.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import ApiService from '../services/api';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export default function CoolorsColorExtractor({
  navigation,
  navigateOnActions = false,
  initialImageUri,
  initialSlots = 5,
  onComplete,
  onSaveToBoard,
  onClose,
}) {
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [imageMeta, setImageMeta] = useState({ width: 0, height: 0 });
  const [palette, setPalette] = useState([]);
  const [dominant, setDominant] = useState('#FFFFFF');
  const [error, setError] = useState(null);

  // Layout -> SharedValues for geometry (worklet-safe)
  const [layoutW, setLayoutW] = useState(0);
  const [layoutH, setLayoutH] = useState(0);
  const svOffsetX = useSharedValue(0);
  const svOffsetY = useSharedValue(0);
  const svRenderedW = useSharedValue(1);
  const svRenderedH = useSharedValue(1);

  // Magnifier normalized coords
  const nx = useSharedValue(0.5);
  const ny = useSharedValue(0.5);
  const [currentHex, setCurrentHex] = useState('#FFFFFF');

  // Compute fit info on JS and push to SharedValues
  useEffect(() => {
    const iw = imageMeta.width || 1;
    const ih = imageMeta.height || 1;
    const vw = layoutW || 1;
    const vh = layoutH || 1;
    const scale = Math.min(vw / iw, vh / ih);
    const renderedW = iw * scale;
    const renderedH = ih * scale;
    const offsetX = (vw - renderedW) / 2;
    const offsetY = (vh - renderedH) / 2;
    svOffsetX.value = offsetX;
    svOffsetY.value = offsetY;
    svRenderedW.value = renderedW;
    svRenderedH.value = renderedH;
  }, [imageMeta, layoutW, layoutH]);

  // Start session
  useEffect(() => {
    let live = true;
    (async () => {
      if (!initialImageUri) { setError('No image'); setLoading(false); return; }
      setLoading(true);
      try {
        const data = await ApiService.startImageExtractSession(initialImageUri, { maxWidth: 1200, maxHeight: 1200 });
        if (!live) return;
        const token = data.imageId || data.sessionId || data.token;
        setSessionId(token);
        setSessionToken(token);
        setImageMeta({ width: data.width, height: data.height });
        const slots = Array.isArray(data.palette) && data.palette.length ? data.palette.slice(0, initialSlots) : [];
        setPalette(slots);
        setDominant(data.dominant || slots[0] || '#FFFFFF');
        setCurrentHex(data.dominant || slots[0] || '#FFFFFF');
        setLoading(false);
      } catch (e) {
        setError('Failed to start extraction session');
        setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [initialImageUri, initialSlots]);

  // Close session on unmount
  useEffect(() => {
    return () => { if (sessionId) ApiService.closeImageExtractSession(sessionId).catch(()=>{}); };
  }, [sessionId]);

  // Live sample
  const doSample = useCallback(async (rx, ry) => {
    if (!sessionToken) return;
    try {
      const res = await ApiService.sampleImageColor(sessionToken, { nx: rx, ny: ry });
      if (res?.hex) setCurrentHex(res.hex.toUpperCase());
      if (Array.isArray(res?.updatedPalette) && res.updatedPalette.length) {
        setPalette(res.updatedPalette);
      }
    } catch {}
  }, [sessionToken]);

  // Gesture worklet — compute normalization using SharedValues only
  const drag = Gesture.Pan()
    .onBegin((e) => {
      'worklet';
      const rx = clamp01((e.x - svOffsetX.value) / svRenderedW.value);
      const ry = clamp01((e.y - svOffsetY.value) / svRenderedH.value);
      nx.value = rx; ny.value = ry;
      // Guard runOnJS call to prevent native crashes
      if (typeof doSample === 'function') {
        runOnJS(doSample)(rx, ry);
      }
    })
    .onChange((e) => {
      'worklet';
      const rx = clamp01((e.x - svOffsetX.value) / svRenderedW.value);
      const ry = clamp01((e.y - svOffsetY.value) / svRenderedH.value);
      nx.value = rx; ny.value = ry;
      // Guard runOnJS call to prevent native crashes
      if (typeof doSample === 'function') {
        runOnJS(doSample)(rx, ry);
      }
    });

  // Magnifier style using SharedValues only
  const magnifierStyle = useAnimatedStyle(() => {
    const px = svOffsetX.value + nx.value * svRenderedW.value;
    const py = svOffsetY.value + ny.value * svRenderedH.value;
    return { transform: [{ translateX: px - 28 }, { translateY: py - 28 }] };
  });

  // Actions
  const handleUseColors = useCallback(() => {
    onComplete && onComplete({ imageUri: initialImageUri, slots: palette, dominant: currentHex });
  }, [onComplete, palette, currentHex, initialImageUri]);

  const handleExportToWheel = useCallback(() => {
    if (navigateOnActions && navigation) {
      navigation.navigate('ColorWheel', { // <- make sure this route exists
        palette,
        baseHex: dominant || currentHex,
        from: 'extractor',
      });
    } else {
      onComplete && onComplete({ imageUri: initialImageUri, slots: palette, dominant: currentHex });
    }
  }, [navigateOnActions, navigation, palette, dominant, currentHex, onComplete, initialImageUri]);

  const handleSaveToBoard = useCallback(() => {
    if (navigateOnActions && navigation) {
      navigation.navigate('BoardScreen', {
        imageUri: initialImageUri,
        palette,
        dominant: dominant || currentHex,
        from: 'extractor',
      });
    } else {
      onSaveToBoard && onSaveToBoard({ imageUri: initialImageUri, slots: palette, dominant: currentHex });
    }
  }, [navigateOnActions, navigation, initialImageUri, palette, dominant, currentHex, onSaveToBoard]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Preparing image…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={onClose}><Text style={styles.btnText}>Close</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={styles.root}
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        setLayoutW(width); setLayoutH(height);
      }}
    >
      <GestureDetector gesture={drag}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: initialImageUri }} style={styles.image} resizeMode="contain" />
          <Animated.View style={[styles.magnifier, magnifierStyle]} pointerEvents="none">
            <View style={[styles.magSwatch, { backgroundColor: currentHex }]} />
            <Text style={styles.magHex}>{currentHex}</Text>
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.paletteRow}>
        {palette.map((c, i) => (<View key={i} style={[styles.swatch, { backgroundColor: c }]} />))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={onClose}>
          <Text style={[styles.btnText, styles.secondaryText]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.alt]} onPress={handleExportToWheel}>
          <Text style={styles.btnText}>Export to Color Wheel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={handleSaveToBoard}>
          <Text style={styles.btnText}>Save to Board</Text>
        </TouchableOpacity>
      </View>

      {!navigateOnActions && (
        <View style={styles.footerInline}>
          <TouchableOpacity style={styles.btn} onPress={handleUseColors}>
            <Text style={styles.btnText}>Use Colors</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B0C' },
  imageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '80%' },
  magnifier: {
    position: 'absolute',
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6,
  },
  magSwatch: { width: 40, height: 22, borderRadius: 6, borderWidth: 1, borderColor: '#E6E6E6' },
  magHex: { color: '#111', fontSize: 11, fontWeight: '600', marginTop: 4 },
  paletteRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: '#0B0B0C' },
  swatch: { width: 48, height: 22, borderRadius: 6, borderWidth: 1, borderColor: '#2A2A2A' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#0B0B0C' },
  footerInline: { paddingHorizontal: 16, paddingBottom: 16, backgroundColor: '#0B0B0C' },
  btn: { backgroundColor: '#246BFD', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, flex: 1, marginHorizontal: 4, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  secondary: { backgroundColor: '#232323' },
  secondaryText: { color: '#EDEDED' },
  alt: { backgroundColor: '#4B6BFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { marginTop: 8, color: '#999' },
  error: { color: '#F44', marginBottom: 12 },
});
