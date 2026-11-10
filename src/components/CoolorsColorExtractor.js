// components/CoolorsColorExtractor.js
// Full-screen photo color picker. The photo opens zoomed in; drag to move, pinch to zoom,
// tap a spot to bring it under the aiming ring, then pick. Pixels are read on the device
// with Skia, so the photo is never uploaded and sampling is instant.
//
// Props:
//  - initialImageUri: string (required) local photo URI (use pickPhotoAsync to get one)
//  - initialSlots?: number (default 5) - legacy name for maxColors
//  - maxColors?: number - 1 = "pick one color and return", >1 = collect up to N colors
//  - onComplete?(result: { imageUri, slots: string[], activeIndex: number }): void
//  - onColorExtracted?(hex: string): void
//  - onClose?(): void
//
// The component renders full-screen content; callers present it inside a <Modal>.

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Skia, ColorType, AlphaType } from '@shopify/react-native-skia';

const AUTO_ZOOM = 2.5;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const MAX_EDGE = 1600;          // long edge of the working copy; keeps the pixel buffer ~10MB max
const RETICLE = 64;             // aiming ring diameter (screen px)
const RETICLE_STROKE = 12;
const SAMPLE_SCREEN_RADIUS = 3; // average ~6 screen px under the ring so fabric texture doesn't flicker

// ---------------------------------------------------------------------------
// Photo helpers
// ---------------------------------------------------------------------------

/**
 * Launch the camera or the photo library and return the chosen photo's URI (or null).
 * The library (iOS 14+ PHPicker) needs no permission prompt; the camera does.
 */
export async function pickPhotoAsync(source = 'library') {
  const ImagePicker = require('expo-image-picker');
  const options = { mediaTypes: ['images'], allowsEditing: false, quality: 1, exif: false };

  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm?.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to take a photo.');
      return null;
    }
  }

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);

  const uri = !result?.canceled && result?.assets?.[0]?.uri;
  return typeof uri === 'string' && uri.length > 0 ? uri : null;
}

// Re-encode to an upright JPEG (handles HEIC + EXIF rotation) and cap the size.
async function normalizePhoto(uri) {
  const { ImageManipulator, SaveFormat } = require('expo-image-manipulator');
  const refs = [];
  try {
    let ref = await ImageManipulator.manipulate(uri).renderAsync();
    refs.push(ref);
    if (Math.max(ref.width, ref.height) > MAX_EDGE) {
      const ctx = ImageManipulator.manipulate(uri);
      ctx.resize(ref.width >= ref.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
      ref = await ctx.renderAsync();
      refs.push(ref, ctx);
    }
    const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
    return { uri: saved.uri, width: saved.width, height: saved.height };
  } finally {
    refs.forEach((r) => { try { r?.release?.(); } catch (_) {} });
  }
}

// Decode the working copy with Skia and copy out its RGBA pixels once.
async function decodePixels(uri) {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Could not decode the photo');
  const width = image.width();
  const height = image.height();
  const pixels = image.readPixels(0, 0, {
    width,
    height,
    colorType: ColorType?.RGBA_8888 ?? 4,
    alphaType: AlphaType?.Unpremul ?? 3,
  });
  try { image.dispose?.(); } catch (_) {}
  try { data.dispose?.(); } catch (_) {}
  if (!pixels) throw new Error('Could not read the photo pixels');
  return { pixels, width, height };
}

const toHex = (r, g, b) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

// Readable text color on top of a swatch
const inkFor = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#111827' : '#FFFFFF';
};

// Worklet-safe clamp of a translation so the ring always stays on the photo
const clampT = (t, scale, half) => {
  'worklet';
  const lim = scale * half;
  return Math.min(lim, Math.max(-lim, t));
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CoolorsColorExtractor({
  initialImageUri,
  initialSlots = 5,
  maxColors,
  onComplete,
  onColorExtracted,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const limit = Math.max(1, maxColors ?? initialSlots ?? 5);
  const single = limit === 1;

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorText, setErrorText] = useState('');
  const [photo, setPhoto] = useState(null);         // { uri, width, height }
  const [viewport, setViewport] = useState(null);   // { W, H }
  const [live, setLive] = useState('#9CA3AF');
  const [picked, setPicked] = useState([]);
  const [showHint, setShowHint] = useState(true);
  const [zoomLabel, setZoomLabel] = useState(`${AUTO_ZOOM}×`);

  const pixelsRef = useRef(null);
  const liveRef = useRef(live);

  // Transform of the photo inside the viewport (about the viewport center)
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const pinchStart = useSharedValue({ s: 1, x: 0, y: 0, fx: 0, fy: 0 });
  const lastSample = useSharedValue(0);

  // ----- load the photo -----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!initialImageUri) {
        setErrorText('No photo was selected.');
        setStatus('error');
        return;
      }
      try {
        const normalized = await normalizePhoto(initialImageUri);
        const decoded = await decodePixels(normalized.uri);
        if (cancelled) return;
        pixelsRef.current = decoded;
        setPhoto({ uri: normalized.uri, width: decoded.width, height: decoded.height });
        setStatus('ready');
      } catch (error) {
        console.error('CoolorsColorExtractor: failed to load photo', error?.message || error);
        if (!cancelled) {
          setErrorText('This photo could not be opened. Try a different one.');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      pixelsRef.current = null;
    };
  }, [initialImageUri]);

  // ----- geometry: photo fitted ("contain") inside the viewport -----
  const geom = useMemo(() => {
    if (!photo || !viewport) return null;
    const { W, H } = viewport;
    const fit = Math.min(W / photo.width, H / photo.height);
    const dw = photo.width * fit;
    const dh = photo.height * fit;
    return { W, H, fit, dw, dh, ox: (W - dw) / 2, oy: (H - dh) / 2 };
  }, [photo, viewport]);
  const geomRef = useRef(null);
  geomRef.current = geom;

  // ----- sampling (JS thread): average a small box under the ring -----
  const sampleAt = useCallback((tX, tY, s) => {
    const g = geomRef.current;
    const buf = pixelsRef.current;
    if (!g || !buf) return;
    const { pixels, width, height } = buf;

    // Viewport center -> photo coordinates (inverse of translate + scale about the center)
    const qx = g.W / 2 - tX / s;
    const qy = g.H / 2 - tY / s;
    const cx = Math.min(width - 1, Math.max(0, Math.round((qx - g.ox) / g.fit)));
    const cy = Math.min(height - 1, Math.max(0, Math.round((qy - g.oy) / g.fit)));
    const r = Math.min(8, Math.max(0, Math.round(SAMPLE_SCREEN_RADIUS / (g.fit * s))));

    let R = 0, G = 0, B = 0, n = 0;
    for (let y = Math.max(0, cy - r); y <= Math.min(height - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(width - 1, cx + r); x++) {
        const i = (y * width + x) * 4;
        R += pixels[i]; G += pixels[i + 1]; B += pixels[i + 2]; n++;
      }
    }
    if (!n) return;
    const hex = toHex(R / n, G / n, B / n);
    if (hex !== liveRef.current) {
      liveRef.current = hex;
      setLive(hex);
    }
  }, []);

  const hideHint = useCallback(() => setShowHint(false), []);
  const updateZoomLabel = useCallback((s) => {
    setZoomLabel(`${Math.round(s * 10) / 10}×`);
  }, []);

  // ----- auto zoom once the photo and viewport are known -----
  useEffect(() => {
    if (status !== 'ready' || !geom) return;
    tx.value = 0;
    ty.value = 0;
    scale.value = 1;
    scale.value = withTiming(AUTO_ZOOM, { duration: 450 });
    sampleAt(0, 0, AUTO_ZOOM);
    updateZoomLabel(AUTO_ZOOM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, geom]);

  // ----- gestures -----
  const gestures = useMemo(() => {
    if (!geom) return Gesture.Tap().enabled(false);
    const { W, H, dw, dh } = geom;
    const halfW = dw / 2;
    const halfH = dh / 2;

    const requestSample = (force) => {
      'worklet';
      const now = Date.now();
      if (!force && now - lastSample.value < 33) return;
      lastSample.value = now;
      runOnJS(sampleAt)(tx.value, ty.value, scale.value);
    };

    // Animate to a target transform and sample where it will land
    const animateTo = (nx, ny, ns) => {
      'worklet';
      const cxT = clampT(nx, ns, halfW);
      const cyT = clampT(ny, ns, halfH);
      tx.value = withTiming(cxT, { duration: 220 });
      ty.value = withTiming(cyT, { duration: 220 });
      if (ns !== scale.value) scale.value = withTiming(ns, { duration: 220 });
      runOnJS(sampleAt)(cxT, cyT, ns);
      runOnJS(updateZoomLabel)(ns);
    };

    const pan = Gesture.Pan()
      .maxPointers(1)
      .onStart(() => {
        'worklet';
        runOnJS(hideHint)();
      })
      .onChange((e) => {
        'worklet';
        tx.value = clampT(tx.value + e.changeX, scale.value, halfW);
        ty.value = clampT(ty.value + e.changeY, scale.value, halfH);
        requestSample(false);
      })
      .onEnd(() => {
        'worklet';
        requestSample(true);
      });

    const pinch = Gesture.Pinch()
      .onStart((e) => {
        'worklet';
        pinchStart.value = { s: scale.value, x: tx.value, y: ty.value, fx: e.focalX, fy: e.focalY };
        runOnJS(hideHint)();
      })
      .onUpdate((e) => {
        'worklet';
        const st = pinchStart.value;
        const ns = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, st.s * e.scale));
        const k = ns / st.s;
        // Keep the photo point that started under the fingers under the fingers
        const nx = (e.focalX - W / 2) - k * (st.fx - W / 2 - st.x);
        const ny = (e.focalY - H / 2) - k * (st.fy - H / 2 - st.y);
        scale.value = ns;
        tx.value = clampT(nx, ns, halfW);
        ty.value = clampT(ny, ns, halfH);
        requestSample(false);
      })
      .onEnd(() => {
        'worklet';
        requestSample(true);
        runOnJS(updateZoomLabel)(scale.value);
      });

    // Tap: slide the tapped spot under the ring
    const tap = Gesture.Tap()
      .maxDuration(250)
      .onEnd((e, success) => {
        'worklet';
        if (!success) return;
        runOnJS(hideHint)();
        animateTo(tx.value - (e.x - W / 2), ty.value - (e.y - H / 2), scale.value);
      });

    // Double tap: toggle between fitted and zoomed, keeping the spot under the ring
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((e, success) => {
        'worklet';
        if (!success) return;
        const s = scale.value;
        const ns = s < 1.5 ? AUTO_ZOOM : 1;
        animateTo((tx.value * ns) / s, (ty.value * ns) / s, ns);
      });

    return Gesture.Simultaneous(pan, pinch, Gesture.Exclusive(doubleTap, tap));
  }, [geom, sampleAt, hideHint, updateZoomLabel, tx, ty, scale, pinchStart, lastSample]);

  const toggleZoom = useCallback(() => {
    if (!geom) return;
    const s = scale.value;
    const ns = s < 1.5 ? AUTO_ZOOM : 1;
    const nx = clampT((tx.value * ns) / s, ns, geom.dw / 2);
    const ny = clampT((ty.value * ns) / s, ns, geom.dh / 2);
    tx.value = withTiming(nx, { duration: 220 });
    ty.value = withTiming(ny, { duration: 220 });
    scale.value = withTiming(ns, { duration: 220 });
    sampleAt(nx, ny, ns);
    updateZoomLabel(ns);
  }, [geom, scale, tx, ty, sampleAt, updateZoomLabel]);

  const photoStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  // ----- picking -----
  const haptic = useCallback(() => {
    try {
      const Haptics = require('expo-haptics');
      Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Light);
    } catch (_) {}
  }, []);

  const finish = useCallback((colors) => {
    if (!colors.length) return;
    onColorExtracted?.(colors[0]);
    onComplete?.({ imageUri: photo?.uri || initialImageUri, slots: colors, activeIndex: 0 });
  }, [onColorExtracted, onComplete, photo, initialImageUri]);

  const handlePick = useCallback(() => {
    haptic();
    if (single) {
      finish([live]);
      return;
    }
    setPicked((prev) => (prev.length >= limit || prev.includes(live) ? prev : [...prev, live]));
  }, [haptic, single, finish, live, limit]);

  const removePicked = useCallback((hex) => {
    setPicked((prev) => prev.filter((c) => c !== hex));
  }, []);

  const handleDone = useCallback(() => {
    finish(picked.length ? picked : [live]);
  }, [finish, picked, live]);

  // ----- render -----
  const full = !single && picked.length >= limit;

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => onClose?.()} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>Pick a color</Text>
        <Pressable
          onPress={toggleZoom}
          style={[styles.zoomPill, status !== 'ready' && styles.hidden]}
          disabled={status !== 'ready'}
          accessibilityRole="button"
          accessibilityLabel={`Zoom ${zoomLabel}. Tap to toggle zoom.`}
        >
          <Ionicons name="search" size={14} color="#FFFFFF" />
          <Text style={styles.zoomText}>{zoomLabel}</Text>
        </Pressable>
      </View>

      {/* Photo viewport */}
      <View
        style={styles.viewport}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) setViewport({ W: width, H: height });
        }}
      >
        {status === 'loading' && (
          <View style={styles.center}>
            <ActivityIndicator color="#FFFFFF" size="large" />
            <Text style={styles.centerText}>Preparing photo…</Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.center}>
            <Ionicons name="image-outline" size={40} color="#9CA3AF" />
            <Text style={styles.centerText}>{errorText}</Text>
            <Pressable onPress={() => onClose?.()} style={styles.errorButton} accessibilityRole="button">
              <Text style={styles.errorButtonText}>Close</Text>
            </Pressable>
          </View>
        )}

        {status === 'ready' && geom && (
          <GestureDetector gesture={gestures}>
            <View style={StyleSheet.absoluteFill} collapsable={false}>
              <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
                <Image
                  source={{ uri: photo.uri }}
                  style={{ position: 'absolute', left: geom.ox, top: geom.oy, width: geom.dw, height: geom.dh }}
                  resizeMode="stretch"
                  accessibilityIgnoresInvertColors
                />
              </Animated.View>

              {/* Aiming ring: filled with the color under it, transparent center */}
              <View pointerEvents="none" style={styles.reticleWrap}>
                <View style={styles.reticleOuter}>
                  <View style={[styles.reticle, { borderColor: live }]} />
                </View>
                <View style={styles.reticleDot} />
              </View>

              {showHint && (
                <View pointerEvents="none" style={styles.hint}>
                  <Text style={styles.hintText}>Drag to move · Pinch to zoom · Tap a spot to aim</Text>
                </View>
              )}
            </View>
          </GestureDetector>
        )}
      </View>

      {/* Bottom panel */}
      <View style={[styles.panel, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.liveRow}>
          <View style={[styles.liveSwatch, { backgroundColor: live }]} />
          <View style={styles.liveInfo}>
            <Text style={styles.liveHex} selectable>{live}</Text>
            <Text style={styles.liveCaption}>Color under the ring</Text>
          </View>
          <Pressable
            onPress={handlePick}
            disabled={status !== 'ready' || full}
            style={[styles.pickButton, { backgroundColor: live }, (status !== 'ready' || full) && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel={single ? `Use color ${live}` : `Add color ${live}`}
          >
            <Ionicons name={single ? 'checkmark' : 'add'} size={18} color={inkFor(live)} />
            <Text style={[styles.pickText, { color: inkFor(live) }]}>{single ? 'Use color' : 'Add'}</Text>
          </Pressable>
        </View>

        {!single && (
          <View style={styles.pickedRow}>
            <View style={styles.pickedChips}>
              {picked.length === 0 ? (
                <Text style={styles.pickedHint}>Add up to {limit} colors</Text>
              ) : (
                picked.map((hex) => (
                  <Pressable
                    key={hex}
                    onPress={() => removePicked(hex)}
                    style={[styles.chip, { backgroundColor: hex }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${hex}. Tap to remove.`}
                  >
                    <Ionicons name="close" size={12} color={inkFor(hex)} />
                  </Pressable>
                ))
              )}
            </View>
            <Pressable
              onPress={handleDone}
              disabled={status !== 'ready'}
              style={[styles.doneButton, status !== 'ready' && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={styles.doneText}>Done{picked.length ? ` (${picked.length})` : ''}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B0C' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  zoomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
    justifyContent: 'center',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  zoomText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  hidden: { opacity: 0 },

  viewport: { flex: 1, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  centerText: { color: '#D1D5DB', fontSize: 15, textAlign: 'center' },
  errorButton: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: '#FFFFFF' },
  errorButtonText: { color: '#111827', fontWeight: '600' },

  reticleWrap: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // White edge around the color ring so it reads on any photo
  reticleOuter: {
    width: RETICLE + 6,
    height: RETICLE + 6,
    borderRadius: (RETICLE + 6) / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  reticle: {
    width: RETICLE,
    height: RETICLE,
    borderRadius: RETICLE / 2,
    borderWidth: RETICLE_STROKE,
    backgroundColor: 'transparent',
  },
  reticleDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.6)',
  },
  hint: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  hintText: { color: '#FFFFFF', fontSize: 13 },

  panel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveSwatch: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#E5E7EB' },
  liveInfo: { flex: 1 },
  liveHex: { fontSize: 20, fontWeight: '700', color: '#111827', fontVariant: ['tabular-nums'] },
  liveCaption: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  pickText: { fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.45 },

  pickedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 12 },
  pickedChips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: 36, alignItems: 'center' },
  pickedHint: { color: '#6B7280', fontSize: 13 },
  chip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  doneButton: { height: 40, paddingHorizontal: 18, borderRadius: 999, backgroundColor: '#111827', justifyContent: 'center' },
  doneText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
