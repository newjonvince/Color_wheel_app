// components/ImageCropper.js
// Full-screen crop step. Drag a corner or an edge to resize the frame, drag inside it to move it,
// rotate in quarter turns. Returns a new JPEG containing only the framed area.
//
// Props:
//  - image: { uri, width, height } local image (pixels)
//  - onDone(uri: string): void   cropped file
//  - onBack(): void
//
// Renders full-screen content; the caller provides the Modal and a GestureHandlerRootView.

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const PAD = 20;        // room around the picture so corner handles are never clipped
const HIT = 30;        // how close a touch must be to an edge to grab it
const MIN_SIZE = 64;   // smallest frame, in screen points
const START_INSET = 0.08;

// Edge bits for the drag mode
const MOVE = 1, LEFT = 2, TOP = 4, RIGHT = 8, BOTTOM = 16;

const clampW = (v, lo, hi) => {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
};

async function transformImage(uri, apply) {
  const { ImageManipulator, SaveFormat } = require('expo-image-manipulator');
  const ctx = ImageManipulator.manipulate(uri);
  let ref = null;
  try {
    apply(ctx);
    ref = await ctx.renderAsync();
    const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
    return { uri: saved.uri, width: saved.width, height: saved.height };
  } finally {
    try { ref?.release?.(); } catch (_) {}
    try { ctx?.release?.(); } catch (_) {}
  }
}

const Corner = ({ style }) => <View pointerEvents="none" style={[styles.corner, style]} />;

export default function ImageCropper({ image, onDone, onBack }) {
  const insets = useSafeAreaInsets();
  const [img, setImg] = useState(image);
  const [stage, setStage] = useState(null); // { w, h } of the area the picture is fitted into
  const [working, setWorking] = useState(false);

  // Where the picture sits inside the stage (aspect-fit)
  const fit = useMemo(() => {
    if (!stage || !img?.width || !img?.height) return null;
    const availW = Math.max(1, stage.w - PAD * 2);
    const availH = Math.max(1, stage.h - PAD * 2);
    const k = Math.min(availW / img.width, availH / img.height);
    const w = img.width * k;
    const h = img.height * k;
    return { x: (stage.w - w) / 2, y: (stage.h - h) / 2, w, h };
  }, [stage, img]);

  // Frame edges, in stage coordinates
  const l = useSharedValue(0);
  const t = useSharedValue(0);
  const r = useSharedValue(0);
  const b = useSharedValue(0);
  const mode = useSharedValue(0);
  const sl = useSharedValue(0);
  const st = useSharedValue(0);
  const sr = useSharedValue(0);
  const sb = useSharedValue(0);

  const resetFrame = useCallback(() => {
    if (!fit) return;
    const dx = fit.w * START_INSET;
    const dy = fit.h * START_INSET;
    l.value = fit.x + dx;
    t.value = fit.y + dy;
    r.value = fit.x + fit.w - dx;
    b.value = fit.y + fit.h - dy;
  }, [fit, l, t, r, b]);

  useEffect(() => { resetFrame(); }, [resetFrame]);

  const minX = fit?.x ?? 0;
  const minY = fit?.y ?? 0;
  const maxX = fit ? fit.x + fit.w : 0;
  const maxY = fit ? fit.y + fit.h : 0;
  const minSize = fit ? Math.min(MIN_SIZE, fit.w, fit.h) : MIN_SIZE;

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onBegin((e) => {
      'worklet';
      const inX = e.x > l.value - HIT && e.x < r.value + HIT;
      const inY = e.y > t.value - HIT && e.y < b.value + HIT;
      let m = 0;
      if (inX && inY) {
        if (Math.abs(e.x - l.value) < HIT) m |= LEFT;
        else if (Math.abs(e.x - r.value) < HIT) m |= RIGHT;
        if (Math.abs(e.y - t.value) < HIT) m |= TOP;
        else if (Math.abs(e.y - b.value) < HIT) m |= BOTTOM;
        if (m === 0) m = MOVE;
      }
      mode.value = m;
      sl.value = l.value;
      st.value = t.value;
      sr.value = r.value;
      sb.value = b.value;
    })
    .onChange((e) => {
      'worklet';
      const m = mode.value;
      if (m === 0) return;
      if (m === MOVE) {
        const w = sr.value - sl.value;
        const h = sb.value - st.value;
        const nl = clampW(sl.value + e.translationX, minX, maxX - w);
        const nt = clampW(st.value + e.translationY, minY, maxY - h);
        l.value = nl;
        r.value = nl + w;
        t.value = nt;
        b.value = nt + h;
        return;
      }
      if (m & LEFT) l.value = clampW(sl.value + e.translationX, minX, r.value - minSize);
      if (m & RIGHT) r.value = clampW(sr.value + e.translationX, l.value + minSize, maxX);
      if (m & TOP) t.value = clampW(st.value + e.translationY, minY, b.value - minSize);
      if (m & BOTTOM) b.value = clampW(sb.value + e.translationY, t.value + minSize, maxY);
    })
    .onFinalize(() => {
      'worklet';
      mode.value = 0;
    });

  const frameStyle = useAnimatedStyle(() => ({
    left: l.value,
    top: t.value,
    width: Math.max(0, r.value - l.value),
    height: Math.max(0, b.value - t.value),
  }));
  const dimTop = useAnimatedStyle(() => ({ height: Math.max(0, t.value) }));
  const dimBottom = useAnimatedStyle(() => ({ top: b.value }));
  const dimLeft = useAnimatedStyle(() => ({
    top: t.value,
    height: Math.max(0, b.value - t.value),
    width: Math.max(0, l.value),
  }));
  const dimRight = useAnimatedStyle(() => ({
    top: t.value,
    height: Math.max(0, b.value - t.value),
    left: r.value,
  }));

  const rotate = useCallback(async () => {
    if (working) return;
    setWorking(true);
    try {
      setImg(await transformImage(img.uri, (ctx) => ctx.rotate(90)));
    } catch (error) {
      console.warn('ImageCropper: rotate failed', error?.message);
      Alert.alert('Could not rotate', 'Please try again.');
    } finally {
      setWorking(false);
    }
  }, [working, img]);

  const done = useCallback(async () => {
    if (working || !fit) return;
    setWorking(true);
    try {
      const k = img.width / fit.w; // picture pixels per screen point
      const originX = Math.max(0, Math.round((l.value - fit.x) * k));
      const originY = Math.max(0, Math.round((t.value - fit.y) * k));
      const width = Math.max(1, Math.min(img.width - originX, Math.round((r.value - l.value) * k)));
      const height = Math.max(1, Math.min(img.height - originY, Math.round((b.value - t.value) * k)));
      const cropped = await transformImage(img.uri, (ctx) => ctx.crop({ originX, originY, width, height }));
      onDone?.(cropped.uri);
    } catch (error) {
      console.warn('ImageCropper: crop failed', error?.message);
      Alert.alert('Could not crop', 'Please try again.');
    } finally {
      setWorking(false);
    }
  }, [working, fit, img, l, t, r, b, onDone]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to the web page">
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>Crop</Text>
        <Pressable onPress={resetFrame} hitSlop={12} accessibilityRole="button" accessibilityLabel="Reset the crop frame">
          <Text style={styles.reset}>Reset</Text>
        </Pressable>
      </View>

      <GestureDetector gesture={pan}>
        <View
          style={styles.stage}
          onLayout={(e) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {fit && (
            <>
              <Image
                source={{ uri: img.uri }}
                style={{ position: 'absolute', left: fit.x, top: fit.y, width: fit.w, height: fit.h }}
              />
              <Animated.View pointerEvents="none" style={[styles.dim, styles.dimTop, dimTop]} />
              <Animated.View pointerEvents="none" style={[styles.dim, styles.dimBottom, dimBottom]} />
              <Animated.View pointerEvents="none" style={[styles.dim, styles.dimLeft, dimLeft]} />
              <Animated.View pointerEvents="none" style={[styles.dim, styles.dimRight, dimRight]} />
              <Animated.View pointerEvents="none" style={[styles.frame, frameStyle]}>
                <View style={[styles.gridLine, styles.gridV, { left: '33.33%' }]} />
                <View style={[styles.gridLine, styles.gridV, { left: '66.66%' }]} />
                <View style={[styles.gridLine, styles.gridH, { top: '33.33%' }]} />
                <View style={[styles.gridLine, styles.gridH, { top: '66.66%' }]} />
                <Corner style={styles.cornerTL} />
                <Corner style={styles.cornerTR} />
                <Corner style={styles.cornerBL} />
                <Corner style={styles.cornerBR} />
              </Animated.View>
            </>
          )}
        </View>
      </GestureDetector>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Text style={styles.hint}>Drag the corners to frame the picture. Drag inside the frame to move it.</Text>
        <View style={styles.buttons}>
          <Pressable
            style={[styles.tool, working && styles.disabled]}
            onPress={rotate}
            disabled={working}
            accessibilityRole="button"
            accessibilityLabel="Rotate a quarter turn"
          >
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.toolText}>Rotate</Text>
          </Pressable>
          <Pressable
            style={[styles.done, working && styles.disabled]}
            onPress={done}
            disabled={working}
            accessibilityRole="button"
            accessibilityLabel="Use this crop and pick colors"
          >
            {working
              ? <ActivityIndicator color="#111827" />
              : <Text style={styles.doneText}>Next: pick colors</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const CORNER = 22;
const CORNER_STROKE = 4;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111315' },
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  reset: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  stage: { flex: 1, overflow: 'hidden' },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)' },
  dimTop: { left: 0, right: 0, top: 0 },
  dimBottom: { left: 0, right: 0, bottom: 0 },
  dimLeft: { left: 0 },
  dimRight: { right: 0 },

  frame: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.28)' },
  gridV: { top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  gridH: { left: 0, right: 0, height: StyleSheet.hairlineWidth },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#FFFFFF' },
  cornerTL: { left: -2, top: -2, borderLeftWidth: CORNER_STROKE, borderTopWidth: CORNER_STROKE },
  cornerTR: { right: -2, top: -2, borderRightWidth: CORNER_STROKE, borderTopWidth: CORNER_STROKE },
  cornerBL: { left: -2, bottom: -2, borderLeftWidth: CORNER_STROKE, borderBottomWidth: CORNER_STROKE },
  cornerBR: { right: -2, bottom: -2, borderRightWidth: CORNER_STROKE, borderBottomWidth: CORNER_STROKE },

  bottom: { paddingHorizontal: 16, paddingTop: 12 },
  hint: { color: '#A1A7B0', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tool: {
    height: 50,
    paddingHorizontal: 18,
    borderRadius: 25,
    backgroundColor: '#2A2D31',
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolText: { marginLeft: 8, color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  done: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { color: '#111827', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
