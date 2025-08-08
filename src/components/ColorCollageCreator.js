import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
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
  { id: 'portrait', name: 'Portrait', ratio: 4/5 },
  { id: 'landscape', name: 'Landscape', ratio: 16/9 },
];

export default function ColorCollageCreator({ 
  image, 
  colors, 
  onClose, 
  onExport 
}) {
  const [selectedLayout, setSelectedLayout] = useState('bottom');
  const [selectedAspect, setSelectedAspect] = useState('original');
  const [isExporting, setIsExporting] = useState(false);
  const collageRef = useRef();

  const getImageDimensions = () => {
    const aspectRatio = ASPECT_RATIOS.find(ar => ar.id === selectedAspect);
    const maxWidth = screenWidth - 40;
    const maxHeight = screenHeight * 0.6;

    if (!aspectRatio.ratio) {
      // Original aspect ratio
      if (image.width && image.height) {
        const imageAspect = image.width / image.height;
        if (imageAspect > 1) {
          return { width: maxWidth, height: maxWidth / imageAspect };
        } else {
          return { width: maxHeight * imageAspect, height: maxHeight };
        }
      }
      return { width: maxWidth, height: maxWidth };
    }

    // Fixed aspect ratio
    if (aspectRatio.ratio > 1) {
      return { width: maxWidth, height: maxWidth / aspectRatio.ratio };
    } else {
      return { width: maxHeight * aspectRatio.ratio, height: maxHeight };
    }
  };

  const renderColorSwatches = () => {
    const swatchSize = 40;
    const spacing = 8;

    switch (selectedLayout) {
      case 'bottom':
        return (
          <View style={styles.swatchContainer}>
            <View style={[styles.swatchRow, { justifyContent: 'center' }]}>
              {colors.map((color, index) => (
                <View
                  key={index}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: color,
                      width: swatchSize,
                      height: swatchSize,
                      marginHorizontal: spacing / 2,
                    }
                  ]}
                />
              ))}
            </View>
          </View>
        );

      case 'top':
        return (
          <View style={[styles.swatchContainer, { position: 'absolute', top: 10, left: 10, right: 10 }]}>
            <View style={[styles.swatchRow, { justifyContent: 'center' }]}>
              {colors.map((color, index) => (
                <View
                  key={index}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: color,
                      width: swatchSize,
                      height: swatchSize,
                      marginHorizontal: spacing / 2,
                    }
                  ]}
                />
              ))}
            </View>
          </View>
        );

      case 'left':
        return (
          <View style={[styles.swatchContainer, { position: 'absolute', left: 10, top: '50%', transform: [{ translateY: -((colors.length * (swatchSize + spacing)) / 2) }] }]}>
            {colors.map((color, index) => (
              <View
                key={index}
                style={[
                  styles.colorSwatch,
                  {
                    backgroundColor: color,
                    width: swatchSize,
                    height: swatchSize,
                    marginVertical: spacing / 2,
                  }
                ]}
              />
            ))}
          </View>
        );

      case 'right':
        return (
          <View style={[styles.swatchContainer, { position: 'absolute', right: 10, top: '50%', transform: [{ translateY: -((colors.length * (swatchSize + spacing)) / 2) }] }]}>
            {colors.map((color, index) => (
              <View
                key={index}
                style={[
                  styles.colorSwatch,
                  {
                    backgroundColor: color,
                    width: swatchSize,
                    height: swatchSize,
                    marginVertical: spacing / 2,
                  }
                ]}
              />
            ))}
          </View>
        );

      case 'grid-bottom':
        const cols = Math.ceil(Math.sqrt(colors.length));
        const rows = Math.ceil(colors.length / cols);
        return (
          <View style={styles.swatchContainer}>
            <View style={styles.swatchGrid}>
              {Array.from({ length: rows }).map((_, rowIndex) => (
                <View key={rowIndex} style={styles.swatchRow}>
                  {Array.from({ length: cols }).map((_, colIndex) => {
                    const colorIndex = rowIndex * cols + colIndex;
                    if (colorIndex >= colors.length) return null;
                    return (
                      <View
                        key={colIndex}
                        style={[
                          styles.colorSwatch,
                          {
                            backgroundColor: colors[colorIndex],
                            width: swatchSize,
                            height: swatchSize,
                            margin: spacing / 2,
                          }
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        );

      case 'circular':
        const radius = 60;
        const centerX = 0;
        const centerY = 0;
        return (
          <View style={[styles.swatchContainer, { position: 'absolute', bottom: 20, right: 20, width: radius * 2, height: radius * 2 }]}>
            {colors.map((color, index) => {
              const angle = (index / colors.length) * 2 * Math.PI;
              const x = centerX + radius * Math.cos(angle);
              const y = centerY + radius * Math.sin(angle);
              return (
                <View
                  key={index}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: color,
                      width: swatchSize,
                      height: swatchSize,
                      position: 'absolute',
                      left: radius + x - swatchSize / 2,
                      top: radius + y - swatchSize / 2,
                    }
                  ]}
                />
              );
            })}
          </View>
        );

      default:
        return null;
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to save images to your photo library.');
        setIsExporting(false);
        return;
      }

      // Capture the collage
      const uri = await captureRef(collageRef, {
        format: 'png',
        quality: 1,
      });

      // Save to media library
      await MediaLibrary.saveToLibraryAsync(uri);

      // Share the image
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }

      Alert.alert('Success!', 'Your color collage has been saved and shared!');
      
      if (onExport) {
        onExport(uri);
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export collage. Please try again.');
    }
    setIsExporting(false);
  };

  const imageDimensions = getImageDimensions();

  return (
    <Modal visible={true} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Collage</Text>
          <TouchableOpacity 
            onPress={handleExport} 
            style={styles.headerButton}
            disabled={isExporting}
          >
            <Text style={[styles.exportText, isExporting && styles.exportTextDisabled]}>
              {isExporting ? 'Saving...' : 'Export'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Collage Preview */}
        <View style={styles.previewContainer}>
          <View 
            ref={collageRef}
            style={[
              styles.collageContainer,
              {
                width: imageDimensions.width,
                height: imageDimensions.height,
              }
            ]}
          >
            <Image
              source={{ uri: image.uri }}
              style={[
                styles.collageImage,
                {
                  width: imageDimensions.width,
                  height: imageDimensions.height,
                }
              ]}
              resizeMode="cover"
            />
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
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
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
  controlsContainer: {
    maxHeight: 200,
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
