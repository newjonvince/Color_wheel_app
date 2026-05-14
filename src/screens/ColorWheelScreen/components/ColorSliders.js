// ColorSliders.js — Visual S and L sliders for the color wheel
import React, { useCallback, useRef } from 'react';
import { View, Text, PanResponder, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import PropTypes from 'prop-types';

const TRACK_HEIGHT = 14;
const THUMB_SIZE = 24;

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

const Slider = React.memo(({ label, value, min = 0, max = 100, trackColors, onValueChange, onSlidingComplete, scrollViewRef }) => {
  const trackWidth = useRef(0);
  const thumbX = useRef(new Animated.Value(0));
  const isDragging = useRef(false);
  // Refs so PanResponder always calls the latest callbacks
  const onValueChangeRef = useRef(onValueChange);
  const onSlidingCompleteRef = useRef(onSlidingComplete);
  const scrollViewRefRef = useRef(scrollViewRef);
  React.useEffect(() => { onValueChangeRef.current = onValueChange; }, [onValueChange]);
  React.useEffect(() => { onSlidingCompleteRef.current = onSlidingComplete; }, [onSlidingComplete]);
  React.useEffect(() => { scrollViewRefRef.current = scrollViewRef; }, [scrollViewRef]);
  const currentValue = useRef(value);

  // Sync thumb position from prop (external updates)
  const setThumbFromValue = useCallback((val, width) => {
    const w = width || trackWidth.current;
    if (!w) return;
    const pct = (val - min) / (max - min);
    thumbX.current.setValue(clamp(pct * w, 0, w));
  }, [min, max]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isDragging.current = true;
        const sv = scrollViewRefRef.current?.current;
        if (sv) { try { sv.setNativeProps({ scrollEnabled: false }); } catch (_) {} }
        const x = evt.nativeEvent.locationX;
        const pct = clamp(x / trackWidth.current, 0, 1);
        const val = Math.round(min + pct * (max - min));
        currentValue.current = val;
        thumbX.current.setValue(clamp(x, 0, trackWidth.current));
        onValueChangeRef.current?.(val);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const pct = clamp(x / trackWidth.current, 0, 1);
        const val = Math.round(min + pct * (max - min));
        currentValue.current = val;
        thumbX.current.setValue(clamp(x, 0, trackWidth.current));
        onValueChangeRef.current?.(val);
      },
      onPanResponderRelease: () => {
        isDragging.current = false;
        const sv = scrollViewRefRef.current?.current;
        if (sv) { try { sv.setNativeProps({ scrollEnabled: true }); } catch (_) {} }
        onSlidingCompleteRef.current?.(currentValue.current);
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        const sv = scrollViewRefRef.current?.current;
        if (sv) { try { sv.setNativeProps({ scrollEnabled: true }); } catch (_) {} }
      },
    })
  ).current;

  const handleLayout = useCallback((e) => {
    trackWidth.current = e.nativeEvent.layout.width;
    setThumbFromValue(value, trackWidth.current);
  }, [value, setThumbFromValue]);

  // Sync when value prop changes externally (not dragging)
  React.useEffect(() => {
    if (!isDragging.current) {
      setThumbFromValue(value);
    }
  }, [value, setThumbFromValue]);

  return (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <View style={styles.sliderContainer}>
        <View
          style={styles.track}
          onLayout={handleLayout}
          {...panResponder.panHandlers}
        >
          <LinearGradient
            colors={trackColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.trackGradient}
          />
          <Animated.View
            style={[
              styles.thumb,
              {
                transform: [{ translateX: Animated.subtract(thumbX.current, THUMB_SIZE / 2) }],
              },
            ]}
            pointerEvents="none"
          />
        </View>
        <Text style={styles.valueText}>{value}</Text>
      </View>
    </View>
  );
});

export const ColorSliders = React.memo(({ hsl, onSaturationChange, onLightnessChange, onSlidingComplete, scrollViewRef }) => {
  const s = typeof hsl?.s === 'number' ? hsl.s : parseInt(hsl?.s, 10) || 50;
  const l = typeof hsl?.l === 'number' ? hsl.l : parseInt(hsl?.l, 10) || 50;
  const h = typeof hsl?.h === 'number' ? hsl.h : parseInt(hsl?.h, 10) || 0;

  // Build saturation gradient color (gray→vivid at current hue/lightness)
  const satGray = `hsl(${h}, 0%, ${l}%)`;
  const satVivid = `hsl(${h}, 100%, ${l}%)`;
  // Build lightness gradient (dark→light at current hue/saturation)
  const lightDark = `hsl(${h}, ${s}%, 0%)`;
  const lightBright = `hsl(${h}, ${s}%, 100%)`;

  return (
    <View style={styles.container}>
      <Slider
        label="S"
        value={s}
        min={0}
        max={100}
        trackColors={[satGray, satVivid]}
        onValueChange={onSaturationChange}
        onSlidingComplete={(v) => onSlidingComplete?.('s', v)}
        scrollViewRef={scrollViewRef}
      />
      <Slider
        label="L"
        value={l}
        min={0}
        max={100}
        trackColors={[lightDark, lightBright]}
        onValueChange={onLightnessChange}
        onSlidingComplete={(v) => onSlidingComplete?.('l', v)}
        scrollViewRef={scrollViewRef}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginHorizontal: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#555',
    width: 20,
    marginRight: 8,
  },
  sliderContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    flex: 1,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'visible',
    justifyContent: 'center',
    position: 'relative',
  },
  trackGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
    top: -(THUMB_SIZE - TRACK_HEIGHT) / 2,
  },
  valueText: {
    fontSize: 12,
    color: '#555',
    width: 30,
    textAlign: 'right',
    marginLeft: 6,
  },
});

ColorSliders.propTypes = {
  hsl: PropTypes.shape({
    h: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    s: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    l: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }).isRequired,
  onSaturationChange: PropTypes.func,
  onLightnessChange: PropTypes.func,
  onSlidingComplete: PropTypes.func,
  scrollViewRef: PropTypes.object,
};

ColorSliders.displayName = 'ColorSliders';
Slider.displayName = 'Slider';
