import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image as RNImage,
  Dimensions,
  Alert,
  ScrollView,
  Modal,
  Linking,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const LAYOUT_OPTIONS = [
  { id: 'bottom', name: 'Bottom', icon: 'albums-outline' },
  { id: 'top', name: 'Top', icon: 'albums-outline' },
  { id: 'left', name: 'Left', icon: 'albums-outline' },
  { id: 'right', name: 'Right', icon: 'albums-outline' },
  { id: 'grid-bottom', name: 'Grid Bottom', icon: 'grid-outline' },
  { id: 'circular', name: 'Circular', icon: 'radio-button-off-outline' },
];

const ASPECT_RATIOS = [
  { id: 'original', name: 'Original', ratio: null },
  { id: 'square', name: 'Square', ratio: 1 },
  { id: 'portrait', name: 'Portrait', ratio: 4 / 5 },
  { id: 'landscape', name: 'Landscape', ratio: 16 / 9 },
];

export default function ColorCollageCreator({
  image,        // { uri, width?, height? }
  colors = [],  // ['#RRGGBB', ...]
  onClose,
  onExport,
}) {
  const [selectedLayout, setSelectedLayout] = useState('bottom');
  const [selectedAspect, setSelectedAspect] = useState('original');
  const [isExporting, setIsExporting] = useState(false);
  const collageRef = useRef(null);

  // Robust image dimension handling
  const [imgWH, setImgWH] = useState({ w: image?.width || 0, h: image?.height || 0 });
  useEffect(() => {
    let isMounted = true;
    if (!image?.uri) return;
    if (image.width && image.height) {
      setImgWH({ w: image.width, h: image.height });
      return;
    }
    RNImage.getSize(
      image.uri,
      (w, h) => isMounted && setImgWH({ w, h }),
      () => isMounted && setImgWH({ w: screenWidth, h: screenWidth }) // safe default
    );
    return () => { isMounted = false; };
  }, [image?.uri]);

  const maxW = screenWidth - 40;
  const maxH = screenHeight * 0.6;

  const computedDims = useMemo(() => {
    const aspect = ASPECT_RATIOS.find(ar => ar.id === selectedAspect);
    if (!aspect?.ratio) {
      // Original aspect ratio (fallback safe)
      const iw = imgWH.w || maxW;
      const ih = imgWH.h || maxW;
      const imageAspect = iw / ih;
      if (imageAspect > 1) return { width: maxW, height: maxW / imageAspect };
      return { width: maxH * imageAspect, height: maxH };
    }
    // Fixed ratio
    if (aspect.ratio > 1) return { width: maxW, height: maxW / aspect.ratio };
    return { width: maxH * aspect.ratio, height: maxH };
  }, [selectedAspect, imgWH.w, imgWH.h]);

  // Adaptive swatch sizing (linear single row)
  const fitSwatchSize = (count, containerWidth, { min = 22, max = 44, gutter = 8 } = {}) => {
    if (!count || containerWidth <= 0) return min;
    const totalGutters = gutter * (count - 1);
    const raw = (containerWidth - totalGutters) / count;
    return Math.max(min, Math.min(max, Math.floor(raw)));
  };



  const renderColorSwatches = () => {
    if (!colors?.length) return null;
    const spacing = 8;
    const sw = 40; // base default (some layouts override adaptively)

    switch (selectedLayout) {
      case 'bottom': {
        const containerW = computedDims.width - 20; // side padding
        const size = fitSwatchSize(colors.length, containerW);
        return (
          <View style={styles.swatchContainer}>
            <View style={[styles.swatchRow, { justifyContent: 'center' }]}>
              {colors.map((color, index) => (
                <TouchableOpacity
                  key={`${color}-${index}`}
                  activeOpacity={0.85}
                  onLongPress={async () => {
                    await Clipboard.setStringAsync(color.toUpperCase());
                    Haptics.selectionAsync();
                    Alert.alert('Copied', color.toUpperCase());
                  }}
                  style={{ marginHorizontal: spacing / 2, alignItems: 'center' }}
                >
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color, width: size, height: size },
                    ]}
                  />
                  <Text style={styles.swatchHex}>{color.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      }

      case 'top': {
        const containerW = computedDims.width - 20;
        const size = fitSwatchSize(colors.length, containerW);
        return (
          <View style={[styles.swatchContainer, { position: 'absolute', top: 10, left: 10, right: 10 }]}>
            <View style={[styles.swatchRow, { justifyContent: 'center' }]}>
              {colors.map((color, index) => (
                <TouchableOpacity
                  key={`${color}-${index}`}
                  activeOpacity={0.85}
                  onLongPress={async () => {
                    await Clipboard.setStringAsync(color.toUpperCase());
                    Haptics.selectionAsync();
                    Alert.alert('Copied', color.toUpperCase());
                  }}
                  style={{ marginHorizontal: spacing / 2, alignItems: 'center' }}
                >
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color, width: size, height: size },
                    ]}
                  />
                  <Text style={styles.swatchHex}>{color.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      }

      case 'left': {
        return (
          <View
            style={[
              styles.swatchContainer,
              {
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: [{ translateY: -((colors.length * (sw + spacing)) / 2) }],
              },
            ]}
          >
            {colors.map((color, index) => (
              <TouchableOpacity
                key={`${color}-${index}`}
                activeOpacity={0.85}
                onLongPress={async () => {
                  await Clipboard.setStringAsync(color.toUpperCase());
                  Haptics.selectionAsync();
                  Alert.alert('Copied', color.toUpperCase());
                }}
              >
                <View
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color, width: sw, height: sw, marginVertical: spacing / 2 },
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        );
      }

      case 'right': {
        return (
          <View
            style={[
              styles.swatchContainer,
              {
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: [{ translateY: -((colors.length * (sw + spacing)) / 2) }],
              },
            ]}
          >
            {colors.map((color, index) => (
              <TouchableOpacity
                key={`${color}-${index}`}
                activeOpacity={0.85}
                onLongPress={async () => {
                  await Clipboard.setStringAsync(color.toUpperCase());
                  Haptics.selectionAsync();
                  Alert.alert('Copied', color.toUpperCase());
                }}
              >
                <View
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color, width: sw, height: sw, marginVertical: spacing / 2 },
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        );
      }

      case 'grid-bottom': {
        const cols = Math.ceil(Math.sqrt(colors.length));
        const rows = Math.ceil(colors.length / cols);
        return (
          <View style={styles.swatchContainer}>
            <View style={styles.swatchGrid}>
              {Array.from({ length: rows }).map((_, rowIndex) => (
                <View key={rowIndex} style={styles.swatchRow}>
                  {Array.from({ length: cols }).map((__, colIndex) => {
                    const colorIndex = rowIndex * cols + colIndex;
                    if (colorIndex >= colors.length) return <View key={colIndex} style={{ width: sw + spacing, height: sw + spacing }} />;
                    const color = colors[colorIndex];
                    return (
                      <TouchableOpacity
                        key={`${color}-${colorIndex}`}
                        activeOpacity={0.85}
                        onLongPress={async () => {
                          await Clipboard.setStringAsync(color.toUpperCase());
                          Haptics.selectionAsync();
                          Alert.alert('Copied', color.toUpperCase());
                        }}
                      >
                        <View
                          style={[
                            styles.colorSwatch,
                            { backgroundColor: color, width: sw, height: sw, margin: spacing / 2 },
                          ]}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        );
      }

      case 'circular': {
        const radius = 60;
        const size = 40;
        // Container sized to the full circle + swatch radius padding
        return (
          <View
            style={[
              styles.swatchContainer,
              {
                position: 'absolute',
                bottom: 20,
                right: 20,
                width: radius * 2 + size,
                height: radius * 2 + size,
              },
            ]}
          >
            {colors.map((color, index) => {
              const angle = (index / colors.length) * 2 * Math.PI;
              const cx = (radius + size / 2) + radius * Math.cos(angle);
              const cy = (radius + size / 2) + radius * Math.sin(angle);
              return (
                <TouchableOpacity
                  key={`${color}-${index}`}
                  activeOpacity={0.85}
                  onLongPress={async () => {
                    await Clipboard.setStringAsync(color.toUpperCase());
                    Haptics.selectionAsync();
                    Alert.alert('Copied', color.toUpperCase());
                  }}
                  style={{ position: 'absolute', left: cx - size / 2, top: cy - size / 2 }}
                >
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color, width: size, height: size },
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }

      default:
        return null;
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);

      // Photos permission
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Enable Photos to save collages.', [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsExporting(false) },
          { text: 'Open Settings', onPress: () => { setIsExporting(false); Linking.openSettings(); } },
        ]);
        return;
      }

      // Capture
      const uri = await captureRef(collageRef.current, {
        format: 'png',  // could be 'jpg'
        quality: 1,     // for jpg
      });

      // Save
      await MediaLibrary.saveToLibraryAsync(uri);

      // Optional share
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success!', 'Your color collage has been saved.');

      onExport?.(uri);
    } catch (error) {
      console.error('Export error:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to export collage. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

return (
  <Modal visible={true} animationType="slide" presentationStyle="fullScreen">
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Collage</Text>
        <TouchableOpacity onPress={handleExport} style={styles.headerButton} disabled={isExporting}>
          <Text style={[styles.exportText, isExporting && styles.exportTextDisabled]}>
            {isExporting ? 'Saving…' : 'Export'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Collage Preview */}
      <View style={styles.previewContainer}>
        <View
          ref={collageRef}
          style={[
            styles.collageContainer,
            { width: computedDims.width, height: computedDims.height },
          ]}
        >
          {!!image?.uri && (
            <RNImage
              source={{ uri: image.uri }}
              style={[styles.collageImage, { width: computedDims.width, height: computedDims.height }]}
              resizeMode="cover"
            />
          )}
          {renderColorSwatches()}
        </View>
      </View>

      {/* Controls */}
      <ScrollView style={styles.controlsContainer} showsVerticalScrollIndicator={false}>
          {/* Layout Options */}
          <View style={styles.controlSection}>
            <Text style={styles.controlTitle}>Layout</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScroll}>
              {LAYOUT_OPTIONS.map((layout) => (
                <TouchableOpacity
                  key={layout.id}
                  style={[
                    styles.optionButton,
                    selectedLayout === layout.id && styles.optionButtonSelected
                  ]}
                  onPress={() => setSelectedLayout(layout.id)}
                >
                  <Ionicons 
                    name={layout.icon} 
                    size={20} 
                    color={selectedLayout === layout.id ? '#007AFF' : '#666'} 
                  />
                  <Text style={[
                    styles.optionText,
                    selectedLayout === layout.id && styles.optionTextSelected
                  ]}>
                    {layout.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Aspect Ratio Options */}
          <View style={styles.controlSection}>
            <Text style={styles.controlTitle}>Aspect</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScroll}>
              {ASPECT_RATIOS.map((aspect) => (
                <TouchableOpacity
                  key={aspect.id}
                  style={[
                    styles.optionButton,
                    selectedAspect === aspect.id && styles.optionButtonSelected
                  ]}
                  onPress={() => setSelectedAspect(aspect.id)}
                >
                  <Text style={[
                    styles.optionText,
                    selectedAspect === aspect.id && styles.optionTextSelected
                  ]}>
                    {aspect.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Color Palette Preview */}
          <View style={styles.controlSection}>
            <Text style={styles.controlTitle}>Palette ({colors.length} colors)</Text>
            <View style={styles.palettePreview}>
              {colors.map((color, index) => (
                <View
                  key={index}
                  style={[styles.paletteColor, { backgroundColor: color }]}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  exportText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  exportTextDisabled: {
    color: '#999',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  collageContainer: {
    position: 'relative',
    backgroundColor: '#ffffff', // ensures a clean export (no transparent corners)
    borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5,
    overflow: 'hidden',
  },
  collageImage: {
    borderRadius: 12,
  },
  swatchContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swatchGrid: {
    alignItems: 'center',
  },
  colorSwatch: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  swatchHex: { fontSize: 10, color: '#333', textAlign: 'center', marginTop: 4 },
  controlsContainer: {
    maxHeight: 220,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  controlSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  controlTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  optionsScroll: {
    flexDirection: 'row',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  optionButtonSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#007AFF',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '500',
  },
  palettePreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  paletteColor: {
    width: 30,
    height: 30,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
});
