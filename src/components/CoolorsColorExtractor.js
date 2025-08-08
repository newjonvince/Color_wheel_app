import React, { useState, useRef, useEffect } from 'react';
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
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CoolorsColorExtractor({ onColorExtracted, onClose, onCreateCollage }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [magnifierPosition, setMagnifierPosition] = useState({ x: screenWidth / 2, y: screenHeight / 2 });
  const [extractedColor, setExtractedColor] = useState('#808080');
  const [isLoading, setIsLoading] = useState(false);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });

  const MAGNIFIER_SIZE = 120;
  const colorSamples = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
    '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
    '#10AC84', '#EE5A24', '#0984E3', '#A29BFE', '#6C5CE7'
  ];

  useEffect(() => {
    pickImage();
  }, []);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
        await processImageForColorExtraction(result.assets[0]);
      } else {
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image');
      onClose();
    }
  };

  const processImageForColorExtraction = async (imageAsset) => {
    setIsLoading(true);
    try {
      // For React Native, we'll simulate color extraction with predefined colors
      // In a real implementation, you'd use a native module or server-side processing
      setExtractedColor(colorSamples[0]);
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'Failed to process image');
    }
    setIsLoading(false);
  };

  const extractColorAtPosition = (relativeX, relativeY) => {
    // Simulate color extraction based on position
    // In a real implementation, this would analyze the actual pixel data
    const colorIndex = Math.floor((relativeX + relativeY) * colorSamples.length) % colorSamples.length;
    setExtractedColor(colorSamples[colorIndex]);
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      updateMagnifierPosition(locationX, locationY);
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      updateMagnifierPosition(locationX, locationY);
    },
  });

  const updateMagnifierPosition = (x, y) => {
    // Constrain magnifier within image bounds
    const constrainedX = Math.max(MAGNIFIER_SIZE / 2, Math.min(imageLayout.width - MAGNIFIER_SIZE / 2, x));
    const constrainedY = Math.max(MAGNIFIER_SIZE / 2, Math.min(imageLayout.height - MAGNIFIER_SIZE / 2, y));
    
    setMagnifierPosition({ x: constrainedX, y: constrainedY });
    
    // Calculate relative position for color extraction
    const relativeX = constrainedX / imageLayout.width;
    const relativeY = constrainedY / imageLayout.height;
    
    extractColorAtPosition(relativeX, relativeY);
  };

  const onImageLayout = (event) => {
    const { width, height, x, y } = event.nativeEvent.layout;
    setImageLayout({ width, height, x, y });
    // Set initial magnifier position at center
    setMagnifierPosition({ x: width / 2, y: height / 2 });
    extractColorAtPosition(0.5, 0.5);
  };

  const handleViewOnColorWheel = () => {
    onColorExtracted(extractedColor);
  };

  const handleCreateCollage = () => {
    if (onCreateCollage && selectedImage) {
      onCreateCollage(selectedImage, extractedColor);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Processing image...</Text>
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
        <TouchableOpacity onPress={handleViewOnColorWheel} style={styles.nextButton}>
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      </View>

      {/* Image Display */}
      {selectedImage && (
        <View style={styles.imageContainer}>
          <View style={styles.imageWrapper} {...panResponder.panHandlers}>
            <Image 
              source={{ uri: selectedImage.uri }} 
              style={styles.image}
              resizeMode="contain"
              onLayout={onImageLayout}
            />
            
            {/* Magnifier Circle */}
            <View 
              style={[
                styles.magnifier,
                {
                  left: magnifierPosition.x - MAGNIFIER_SIZE / 2,
                  top: magnifierPosition.y - MAGNIFIER_SIZE / 2,
                }
              ]}
            >
              <View style={styles.magnifierInner}>
                <View style={styles.crosshair}>
                  <View style={styles.crosshairHorizontal} />
                  <View style={styles.crosshairVertical} />
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Color Bar */}
      <View style={styles.colorBarContainer}>
        <View style={[styles.colorBar, { backgroundColor: extractedColor }]}>
          <View style={styles.colorDot} />
        </View>
        <Text style={styles.colorText}>{extractedColor.toUpperCase()}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.secondaryButton]} 
          onPress={handleCreateCollage}
        >
          <Text style={styles.secondaryButtonText}>Create Collage</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryButton]} 
          onPress={handleViewOnColorWheel}
        >
          <Text style={styles.primaryButtonText}>View on Color Wheel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  closeButton: {
    padding: 10,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#333',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  nextButton: {
    padding: 10,
  },
  nextButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  imageContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  imageWrapper: {
    flex: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  magnifier: {
    position: 'absolute',
    width: MAGNIFIER_SIZE,
    height: MAGNIFIER_SIZE,
    borderRadius: MAGNIFIER_SIZE / 2,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  magnifierInner: {
    flex: 1,
    borderRadius: (MAGNIFIER_SIZE - 8) / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshair: {
    position: 'absolute',
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairHorizontal: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: '#333',
  },
  crosshairVertical: {
    position: 'absolute',
    width: 2,
    height: 20,
    backgroundColor: '#333',
  },
  colorBarContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  colorBar: {
    width: screenWidth - 40,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  colorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 40,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});
