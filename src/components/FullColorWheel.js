// FullColorWheel.js
import React, { forwardRef, useImperativeHandle, useMemo } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useDerivedValue, useAnimatedStyle, withTiming, runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
// Safe Skia import with fallback
let Canvas, SkiaCircle, SweepGradient, vec, Paint, Path;
try {
  const SkiaModule = require('@shopify/react-native-skia');
  Canvas = SkiaModule.Canvas;
  SkiaCircle = SkiaModule.Circle;
  SweepGradient = SkiaModule.SweepGradient;
  vec = SkiaModule.vec;
  Paint = SkiaModule.Paint;
  Path = SkiaModule.Path;
} catch (error) {
  console.warn('Skia not available, using fallback rendering');
  // Fallback components
  Canvas = View;
  SkiaCircle = () => null;
  SweepGradient = () => null;
  vec = () => null;
  Paint = () => null;
  Path = () => null;
}
import Svg, { Circle, Path as SvgPath } from 'react-native-svg';
import { generateOklchScheme, hexToOklch, oklchToHexClamped } from '../utils/color';

const TAU = Math.PI * 2;

function hslToHex(h, s, l) { // fallback only
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

const SCHEME_OFFSETS = {
  complementary: [0, 180],
  analogous: [0, 30, -30],
  triadic: [0, 120, 240],
  tetradic: [0, 90, 180, 270],
  monochromatic: [0],
  'split-complementary': [0, 150, -150],
};

const FullColorWheel = forwardRef(function FullColorWheel({
  size,
  strokeWidth = 40,
  scheme = 'analogous',
  initialHex = '#FF00AA',
  onColorsChange,
  onHexChange,
  onImageSelected,
}, ref) {
  const radius = size / 2;
  const ringR = radius - strokeWidth / 2;
  const center = { x: radius, y: radius };

  // baseAngle is the hue anchor in degrees
  const baseAngle = useSharedValue(0);
  
  // Keep base L,C values from initialHex
  const baseLC = useSharedValue(hexToOklch(initialHex));

  // Camera and Gallery methods exposed via ref
  const openCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Camera permission is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const imageUri = result.assets[0].uri;
        if (onImageSelected) onImageSelected({ uri: imageUri });
      }
    } catch (error) {
      console.error('Camera error:', error);
      alert('Failed to open camera');
    }
  };

  const openGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Gallery permission is required to select photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const imageUri = result.assets[0].uri;
        if (onImageSelected) onImageSelected({ uri: imageUri });
      }
    } catch (error) {
      console.error('Gallery error:', error);
      alert('Failed to open gallery');
    }
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    openCamera,
    openGallery,
  }));

  // When initialHex changes, refresh baseLC once
  React.useEffect(() => {
    baseLC.value = hexToOklch(initialHex);
    const { hues, colors } = generateOklchScheme(initialHex, scheme);
    const h = hues[0] || 0;
    baseAngle.value = h;
    onColorsChange && onColorsChange(colors);
    onHexChange && onHexChange(colors[0]);
  }, [initialHex, scheme]);

  // markers derived from baseAngle + offsets
  const markers = useDerivedValue(() => {
    const offsets = SCHEME_OFFSETS[scheme] || [0];
    return offsets.map((off, i) => {
      const a = (baseAngle.value + off + 360) % 360;
      const rad = (a - 90) * (Math.PI / 180);
      const x = center.x + Math.cos(rad) * ringR;
      const y = center.y + Math.sin(rad) * ringR;
      return { a, x, y, i };
    });
  }, [scheme, ringR]);

  // Use useAnimatedReaction for better performance - runs on UI thread
  useAnimatedReaction(
    () => ({ angle: baseAngle.value, scheme }), // track deps on the UI thread
    (state) => {
      const offsets = SCHEME_OFFSETS[state.scheme] || [0];
      const hues = offsets.map(off => (state.angle + off + 360) % 360);
      const palette = hues.map(h => oklchToHexClamped(baseLC.value.L, baseLC.value.C, h));

      // fire JS callbacks safely
      runOnJS(onColorsChange)?.(palette);
      runOnJS(onHexChange)?.(palette[0]);
    },
    [scheme]
  );

  // gesture: set directly during drag, smooth only on release
  const startAngle = useSharedValue(0);
  const gesture = Gesture.Pan()
    .onBegin((e) => {
      const dx = e.x - center.x;
      const dy = e.y - center.y;
      const ang = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
      startAngle.value = ang;
      baseAngle.value = ang; // immediate response
    })
    .onChange((e) => {
      const dx = e.x - center.x;
      const dy = e.y - center.y;
      const ang = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
      baseAngle.value = ang; // direct update during drag
    })
    .onFinalize((e) => {
      const dx = e.x - center.x;
      const dy = e.y - center.y;
      const ang = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
      baseAngle.value = withTiming(ang, { duration: 140 }); // smooth to final
    });

  // marker animated styles
  const markerStyles = new Array(4).fill(0).map((_, idx) =>
    useAnimatedStyle(() => {
      const offsets = SCHEME_OFFSETS[scheme] || [0];
      if (idx >= offsets.length) return { opacity: 0 };
      const a = (baseAngle.value + offsets[idx] + 360) % 360;
      const rad = (a - 90) * (Math.PI / 180);
      return {
        position: 'absolute',
        left: center.x - 8 + Math.cos(rad) * ringR,
        top: center.y - 8 + Math.sin(rad) * ringR,
        width: 16, height: 16,
        borderRadius: 8,
        backgroundColor: '#fff',
        borderWidth: 3,
        borderColor: '#00000022',
      };
    })
  );

  // Skia wheel (fast) - sweep gradient
  const skiaGradientColors = useMemo(() => {
    const arr = [];
    for (let i=0; i<=360; i+=10) {
      arr.push(hslToHex(i, 100, 50));
    }
    return arr;
  }, []);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width: size, height: size }}>
        <Canvas style={{ width: size, height: size }}>
          <SkiaCircle cx={center.x} cy={center.y} r={radius} color="white" />
          <SkiaCircle cx={center.x} cy={center.y} r={radius}>
            <SweepGradient c={vec(center.x, center.y)} colors={skiaGradientColors} />
          </SkiaCircle>
          {/* cut inner hole for ring look */}
          <Path
            path={`M ${center.x} ${center.y - (radius - strokeWidth)} A ${radius - strokeWidth} ${radius - strokeWidth} 0 1 1 ${center.x - 0.01} ${center.y - (radius - strokeWidth)} Z`}
            color="white"
            style="stroke"
            strokeWidth={strokeWidth}
          />
        </Canvas>

        {/* Markers */}
        <Animated.View style={markerStyles[0]} />
        <Animated.View style={markerStyles[1]} />
        <Animated.View style={markerStyles[2]} />
        <Animated.View style={markerStyles[3]} />
      </View>
    </GestureDetector>
  );
});

export default FullColorWheel;
