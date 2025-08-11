// src/components/AdvancedColorWheel.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  Modal, 
  Alert, 
  PanResponder, 
  Dimensions,
  Share
} from 'react-native';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as MailComposer from 'expo-mail-composer';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import ApiService from '../services/api';

// ✅ pull from your shared utils so hue math matches the app
import { hslToHex, hexToHsl, isValidHexColor } from '../utils/color';

const { width: screenWidth } = Dimensions.get('window');
const WHEEL_SIZE = screenWidth * 0.8;
const WHEEL_RADIUS = WHEEL_SIZE / 2;
const WHEEL_STROKE_WIDTH = 40;
const RING_INNER = WHEEL_RADIUS - WHEEL_STROKE_WIDTH;
const RING_OUTER = WHEEL_RADIUS;

export default function AdvancedColorWheel({
  currentUser,
  onSaveColorMatch,
  initialHex,            // 🆕 optional: seed the wheel with a hex
  initialScheme,         // 🆕 optional: seed the scheme
}) {
  const [selectedScheme, setSelectedScheme] = useState(initialScheme || 'triadic');
  const [activeMarkerId, setActiveMarkerId] = useState(1);
  const [baseHue, setBaseHue] = useState(180); // default if no initialHex
  const [showExportModal, setShowExportModal] = useState(false);

  // 🆕 Seed the wheel on mount if initialHex is provided & valid
  useEffect(() => {
    if (!initialHex) return;
    const hex = initialHex.trim();
    if (!isValidHexColor(hex)) return;

    const { h } = hexToHsl(hex);     // { h, s, l }
    setBaseHue(Math.round(h));
    if (initialScheme) setSelectedScheme(initialScheme);
  }, [initialHex, initialScheme]);

  // Build markers derived from baseHue + scheme
  const colorMarkers = useMemo(() => {
    const mk = (id, angle) => ({
      id,
      angle: ((angle % 360) + 360) % 360,
      color: hslToHex(((angle % 360) + 360) % 360, 100, 50),
      isActive: id === activeMarkerId,
    });

    switch (selectedScheme) {
      case 'complementary':
        return [mk(1, baseHue), mk(2, baseHue + 180)];
      case 'analogous':
        return [mk(1, baseHue), mk(2, baseHue + 30), mk(3, baseHue - 30)];
      case 'triadic':
        return [mk(1, baseHue), mk(2, baseHue + 120), mk(3, baseHue + 240)];
      case 'tetradic':
        return [mk(1, baseHue), mk(2, baseHue + 90), mk(3, baseHue + 180), mk(4, baseHue + 270)];
      case 'monochromatic':
        // keep same hue, vary lightness for two companions
        return [
          { ...mk(1, baseHue) },
          { id: 2, angle: baseHue, color: hslToHex(baseHue, 100, 30), isActive: 2 === activeMarkerId },
          { id: 3, angle: baseHue, color: hslToHex(baseHue, 100, 70), isActive: 3 === activeMarkerId },
        ];
      case 'freestyle':
        // treat freestyle as 2 markers opposite each other initially (user will drag)
        return [mk(1, baseHue), mk(2, baseHue + 180)];
      default:
        return [mk(1, baseHue)];
    }
  }, [baseHue, selectedScheme, activeMarkerId]);

  // Build the 360 ring once
  const ringSlices = useMemo(() => {
    const slices = [];
    for (let i = 0; i < 360; i++) {
      const start = (i * Math.PI) / 180;
      const end = ((i + 1) * Math.PI) / 180;

      const x1 = WHEEL_RADIUS + RING_INNER * Math.cos(start);
      const y1 = WHEEL_RADIUS + RING_INNER * Math.sin(start);
      const x2 = WHEEL_RADIUS + RING_OUTER * Math.cos(start);
      const y2 = WHEEL_RADIUS + RING_OUTER * Math.sin(start);
      const x3 = WHEEL_RADIUS + RING_OUTER * Math.cos(end);
      const y3 = WHEEL_RADIUS + RING_OUTER * Math.sin(end);
      const x4 = WHEEL_RADIUS + RING_INNER * Math.cos(end);
      const y4 = WHEEL_RADIUS + RING_INNER * Math.sin(end);

      const color = hslToHex(i, 100, 50);
      slices.push(
        <Path key={i} d={`M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`} fill={color} />
      );
    }
    return slices;
  }, []);

  // Convert a touch point to a hue on the ring
  const pointToHue = (x, y) => {
    const cx = WHEEL_SIZE / 2;
    const cy = WHEEL_SIZE / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < RING_INNER || dist > RING_OUTER) return null; // ignore drags not on the ring

    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (ang < 0) ang += 360;
    return Math.round(ang);
  };

  const handleDragOnRing = useCallback((x, y) => {
    const hue = pointToHue(x, y);
    if (hue == null) return;
    setBaseHue(hue);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          handleDragOnRing(locationX, locationY);
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          handleDragOnRing(locationX, locationY);
        },
      }),
    [handleDragOnRing]
  );

  // When a user taps a marker, make it active (hue stays driven by marker 1)
  const onMarkerPress = async (id) => {
    setActiveMarkerId(id);
    try { await Haptics.selectionAsync(); } catch {}
  };

  const currentColors = useMemo(() => colorMarkers.map(m => m.color), [colorMarkers]);

  const handleSaveColorMatch = async () => {
    try {
      const payload = {
        base_color: currentColors[0],   // 🔁 snake_case for backend
        scheme: selectedScheme,
        colors: currentColors,
        privacy: 'private',
        is_locked: false,
        locked_color: null,
        metadata: {
          source: 'advanced_wheel',
          markerCount: currentColors.length,
          baseHue,
          timestamp: new Date().toISOString(),
        },
      };

      const res = await ApiService.createColorMatch(payload);
      if (res?.success) {
        onSaveColorMatch?.({
          ...payload,
          id: res.colorMatch?.id,
          timestamp: res.colorMatch?.created_at,
        });
        Alert.alert('Saved!', 'Color palette saved to your boards!');
      } else {
        throw new Error(res?.message || 'Failed to save color match');
      }
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert('Save Failed', err.message || 'Please try again.');
    }
  };

  const handleExport = async (method) => {
    const text = `🎨 Fashion Color Palette (${selectedScheme})\n\nColors: ${currentColors.join(', ')}\n\nCreated with Fashion Color Wheel`;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      if (method === 'text') {
        await Share.share({ message: text, title: 'Fashion Color Palette' });
      } else if (method === 'email') {
        const ok = await MailComposer.isAvailableAsync();
        if (!ok) {
          Alert.alert('Email Not Available', 'Email is not configured on this device.');
          return;
        }
        await MailComposer.composeAsync({ subject: 'Fashion Color Palette', body: text });
      } else if (method === 'copy') {
        await Clipboard.setStringAsync(text);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Copied!', 'Color palette copied to clipboard');
      }
      setShowExportModal(false);
    } catch (e) {
      console.error('Export error:', e);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Export Failed', 'Failed to export color palette');
    }
  };

  const renderMarkers = () =>
    colorMarkers.map((marker) => {
      const rad = (marker.angle * Math.PI) / 180;
      const ringRadius = WHEEL_RADIUS - WHEEL_STROKE_WIDTH / 2;
      const cx = WHEEL_RADIUS + ringRadius * Math.cos(rad);
      const cy = WHEEL_RADIUS + ringRadius * Math.sin(rad);
      return (
        <Circle
          key={marker.id}
          cx={cx}
          cy={cy}
          r={marker.isActive ? 12 : 10}
          fill={marker.color}
          stroke={marker.isActive ? '#333' : '#fff'}
          strokeWidth={marker.isActive ? 4 : 3}
          opacity={marker.isActive ? 1 : 0.9}
          onPressIn={() => onMarkerPress(marker.id)}
        />
      );
    });

  const renderWheel = () => (
    <View style={styles.wheelContainer} {...panResponder.panHandlers}>
      <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
        <Defs>
          <RadialGradient id="colorWheel" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="white" />
            <Stop offset="100%" stopColor="transparent" />
          </RadialGradient>
        </Defs>
        {ringSlices}
        {renderMarkers()}
      </Svg>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {renderWheel()}

      {/* Scheme selector */}
      <View style={styles.schemeSection}>
        <Text style={styles.sectionTitle}>Color Combination</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.schemeScroll}>
          {['complementary', 'analogous', 'triadic', 'tetradic', 'monochromatic', 'freestyle'].map((scheme) => (
            <TouchableOpacity
              key={scheme}
              style={[styles.schemeButton, selectedScheme === scheme && styles.selectedScheme]}
              onPress={async () => {
                setSelectedScheme(scheme);
                try { await Haptics.selectionAsync(); } catch {}
                setActiveMarkerId(1);
              }}
            >
              <Text style={[styles.schemeText, selectedScheme === scheme && styles.selectedSchemeText]}>
                {scheme.charAt(0).toUpperCase() + scheme.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Preview with interactive swatches */}
      <View style={styles.colorsPreview}>
        {currentColors.map((c, i) => (
          <TouchableOpacity 
            key={`${c}-${i}`} 
            style={styles.colorPreviewItem}
            activeOpacity={0.7}
            onLongPress={async () => {
              try {
                await Clipboard.setStringAsync(c.toUpperCase());
                await Haptics.selectionAsync();
                Alert.alert('Copied!', `${c.toUpperCase()} copied to clipboard`);
              } catch (error) {
                console.error('Copy error:', error);
                Alert.alert('Copy Failed', 'Unable to copy color code');
              }
            }}
          >
            <View style={[styles.previewColor, { backgroundColor: c }]} />
            <Text style={styles.colorValue}>{c}</Text>
            <Text style={styles.copyHint}>Long press to copy</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveColorMatch}>
          <Ionicons name="bookmark" size={20} color="white" />
          <Text style={styles.saveButtonText}>Save to Boards</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportButton} onPress={() => setShowExportModal(true)}>
          <Ionicons name="share" size={20} color="white" />
          <Text style={styles.exportButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Export Modal */}
      <Modal visible={showExportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Export Color Palette</Text>
            <TouchableOpacity style={styles.exportOption} onPress={() => handleExport('text')}>
              <Ionicons name="chatbubble" size={24} color="#3498db" />
              <Text style={styles.exportOptionText}>Share as Text</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportOption} onPress={() => handleExport('email')}>
              <Ionicons name="mail" size={24} color="#3498db" />
              <Text style={styles.exportOptionText}>Send via Email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportOption} onPress={() => handleExport('copy')}>
              <Ionicons name="copy" size={24} color="#3498db" />
              <Text style={styles.exportOptionText}>Copy to Clipboard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowExportModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  wheelContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  schemeSection: { marginHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50', marginBottom: 15 },
  schemeScroll: { flexDirection: 'row' },
  schemeButton: {
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#ecf0f1',
  },
  selectedScheme: { backgroundColor: '#3498db', borderColor: '#3498db' },
  schemeText: { fontSize: 14, fontWeight: '600', color: '#7f8c8d' },
  selectedSchemeText: { color: 'white' },
  colorsPreview: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginHorizontal: 20, marginTop: 20 },
  colorPreviewItem: { alignItems: 'center', marginHorizontal: 10, marginBottom: 15 },
  previewColor: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: 'white',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  colorValue: { fontSize: 14, color: '#7f8c8d', marginTop: 8, fontFamily: 'monospace', fontWeight: '600' },
  copyHint: { fontSize: 10, color: '#bdc3c7', marginTop: 2, textAlign: 'center' },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 20, marginTop: 20, marginBottom: 30 },
  saveButton: {
    backgroundColor: '#e74c3c', flexDirection: 'row', alignItems: 'center',
    paddingVertical: 15, paddingHorizontal: 25, borderRadius: 25, flex: 0.45, justifyContent: 'center',
  },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  exportButton: {
    backgroundColor: '#3498db', flexDirection: 'row', alignItems: 'center',
    paddingVertical: 15, paddingHorizontal: 25, borderRadius: 25, flex: 0.45, justifyContent: 'center',
  },
  exportButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', padding: 25, borderRadius: 20, width: '80%', alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#2c3e50' },
  exportOption: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20,
    backgroundColor: '#f8f9fa', borderRadius: 15, marginBottom: 15, width: '100%',
  },
  exportOptionText: { fontSize: 16, color: '#2c3e50', marginLeft: 15, fontWeight: '600' },
  cancelButton: { backgroundColor: '#95a5a6', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 10, marginTop: 10 },
  cancelText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
