import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Svg, Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  runOnJS,
  withSpring,
} from 'react-native-reanimated';
import AdvancedColorWheel from '../components/AdvancedColorWheel';
import CoolorsColorExtractor from '../components/CoolorsColorExtractor';
import ColorCollageCreator from '../components/ColorCollageCreator';
import ApiService from '../services/api';
import { 
  hslToHex, 
  hexToHsl, 
  hexToRgb, 
  getColorScheme, 
  calculateMarkerPositions, 
  normalizeAngle, 
  validateHexColor, 
  blendColors 
} from '../utils/color';

const { width: screenWidth } = Dimensions.get('window');
const WHEEL_SIZE = screenWidth * 0.8;
const WHEEL_RADIUS = WHEEL_SIZE / 2;
const WHEEL_STROKE_WIDTH = 40;

export default function ColorWheelScreen({ navigation, currentUser, onSaveColorMatch, onLogout }) {
  const [selectedColor, setSelectedColor] = useState('#FF6B6B');
  const [angle, setAngle] = useState(0);
  const [selectedScheme, setSelectedScheme] = useState('complementary');
  const [isColorLocked, setIsColorLocked] = useState(false);
  const [lockedColor, setLockedColor] = useState(null);
  const [showCoolorsExtractor, setShowCoolorsExtractor] = useState(false);
  const [showCollageCreator, setShowCollageCreator] = useState(false);
  const [collageImage, setCollageImage] = useState(null);
  const [collageBaseColor, setCollageBaseColor] = useState(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualColorInput, setManualColorInput] = useState('');
  const [useAdvancedMode, setUseAdvancedMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Contrast calculation utilities for accessibility
  const getLuminance = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    
    const sRGB = [rNorm, gNorm, bNorm].map(c => {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  };

  const calculateContrastRatio = (color1, color2) => {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  };

  const getContrastLevel = (ratio) => {
    if (ratio >= 7) return 'AAA';
    if (ratio >= 4.5) return 'AA';
    if (ratio >= 3) return 'A';
    return null;
  };
  
  // Freestyle colors state (only state-based markers for freestyle mode)
  const [freestyleColors, setFreestyleColors] = useState(['#FF6B6B', '#4ECDC4']);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeMarkerId, setActiveMarkerId] = useState(1);

  // Shared values for gesture handling
  const gestureX = useSharedValue(0);
  const gestureY = useSharedValue(0);
  const isGestureActive = useSharedValue(false);

  // Helper function to calculate angle and color from coordinates
  const calculateAngleFromCoordinates = (x, y) => {
    'worklet';
    const centerX = WHEEL_SIZE / 2;
    const centerY = WHEEL_SIZE / 2;
    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    
    if (distance >= WHEEL_RADIUS - WHEEL_STROKE_WIDTH && distance <= WHEEL_RADIUS) {
      let newAngle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
      if (newAngle < 0) newAngle += 360;
      return newAngle;
    }
    return null;
  };

  // Update color state from gesture (runs on JS thread)
  const updateColorFromGesture = (newAngle) => {
    if (isColorLocked || newAngle === null) return;
    
    const newColor = hslToHex(newAngle, 100, 50);
    // updateColorState already handles all necessary state updates
    updateColorState(newAngle, newColor, activeMarkerId);
  };

  // Enhanced gesture handler with reanimated for better performance
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (event) => {
      if (isColorLocked) return;
      
      isGestureActive.value = true;
      gestureX.value = event.x;
      gestureY.value = event.y;
      
      const newAngle = calculateAngleFromCoordinates(event.x, event.y);
      if (newAngle !== null) {
        runOnJS(updateColorFromGesture)(newAngle);
      }
    },
    onActive: (event) => {
      if (isColorLocked) return;
      
      gestureX.value = event.x;
      gestureY.value = event.y;
      
      const newAngle = calculateAngleFromCoordinates(event.x, event.y);
      if (newAngle !== null) {
        runOnJS(updateColorFromGesture)(newAngle);
      }
    },
    onEnd: () => {
      isGestureActive.value = false;
      gestureX.value = withSpring(0);
      gestureY.value = withSpring(0);
    },
  });

  // Memoized color scheme generation for performance
  const memoizedColorScheme = useMemo(() => {
    if (selectedScheme === 'freestyle') {
      return freestyleColors;
    }
    return getColorScheme(selectedColor, selectedScheme, angle);
  }, [selectedColor, selectedScheme, angle, freestyleColors]);

  // Memoized marker positions - single source of truth
  const memoizedMarkers = useMemo(() => {
    if (selectedScheme === 'freestyle') {
      // Generate freestyle markers with adaptive spacing
      return freestyleColors.map((color, index) => ({
        id: index + 1,
        color,
        angle: index * (360 / freestyleColors.length), // Adaptive spacing
        isActive: index + 1 === activeMarkerId
      }));
    }
    // For schemes, derive markers from driving state
    return calculateMarkerPositions(selectedScheme, angle, activeMarkerId);
  }, [selectedScheme, angle, activeMarkerId, freestyleColors]);

  // Update driving state only - markers derived via useMemo
  const updateColorState = (newAngle, newColor, activeId = 1) => {
    if (selectedScheme === 'freestyle') {
      // In freestyle mode, update the specific color in the array
      setFreestyleColors(prev => 
        prev.map((color, index) => 
          index + 1 === activeId ? newColor : color
        )
      );
      setActiveMarkerId(activeId);
      return;
    }

    // For schemes, update driving state only
    setAngle(newAngle);
    setSelectedColor(newColor);
    setActiveMarkerId(activeId);
  };

  // Add color to freestyle palette
  const addFreestyleColor = () => {
    if (freestyleColors.length < 4) {
      const newColor = hslToHex(Math.random() * 360, 100, 50);
      setFreestyleColors(prev => [...prev, newColor]);
      // Auto-select the new color
      setActiveMarkerId(freestyleColors.length + 1);
    }
  };

  // Remove color from freestyle palette
  const removeFreestyleColor = (index) => {
    if (freestyleColors.length > 2) {
      setFreestyleColors(prev => prev.filter((_, i) => i !== index));
      // Adjust active marker if needed
      if (activeMarkerId > freestyleColors.length - 1) {
        setActiveMarkerId(1);
      }
    }
  };

  // Update freestyle color
  const updateFreestyleColor = (index, newColor) => {
    setFreestyleColors(prev => 
      prev.map((color, i) => i === index ? newColor : color)
    );
  };

  const handleColorExtracted = (extractedColor) => {
    // Convert extracted color to HSL to get the angle for the wheel
    const { h: hue } = hexToHsl(extractedColor);
    
    setSelectedColor(extractedColor);
    setLockedColor(extractedColor);
    setAngle(hue);
    setIsColorLocked(true);
    setSelectedScheme('complementary'); // Default to complementary
    setShowCoolorsExtractor(false);
    
    // Update markers with the new color
    updateColorMarkers(hue, extractedColor, activeMarkerId);
  };

  const handleCreateCollage = (image, baseColor) => {
    setCollageImage(image);
    setCollageBaseColor(baseColor);
    setShowCoolorsExtractor(false);
    setShowCollageCreator(true);
  };

  const handleCollageExport = (collageUri) => {
    console.log('Collage exported:', collageUri);
    setShowCollageCreator(false);
    // Optionally save to user's color matches or boards
  };

  const handleCollageClose = () => {
    setShowCollageCreator(false);
    setCollageImage(null);
    setCollageBaseColor(null);
  };

  const toggleColorLock = async () => {
    // Add haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (isColorLocked) {
      setIsColorLocked(false);
      setLockedColor(null);
    } else {
      setIsColorLocked(true);
      setLockedColor(selectedColor);
    }
  };

  const handleSaveColorMatch = async () => {
    if (!selectedBoard) {
      Alert.alert('No Board Selected', 'Please select a board to save your color match.');
      return;
    }

    setIsSaving(true);
    
    try {
      await ApiService.createColorMatch({
        color: selectedColor,
        scheme: selectedScheme,
        colors: memoizedColorScheme,
        boardId: selectedBoard.id,
      });
      
      // Success haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Color combination saved successfully!');
      
      if (onSaveColorMatch) {
        onSaveColorMatch({
          baseColor: isColorLocked ? lockedColor : selectedColor,
          scheme: selectedScheme,
          colors: memoizedColorScheme,
          timestamp: new Date().toISOString(),
          isLocked: isColorLocked,
          lockedColor: isColorLocked ? lockedColor : null,
        });
      }
    } catch (error) {
      console.error('Error saving color match:', error);
      // Error haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGalleryColorExtraction = () => {
    setShowCoolorsExtractor(true);
  };

  const renderColorWheel = () => {
    // Render multiple markers for different schemes
    const renderMarkers = () => {
      if (selectedScheme === 'freestyle') {
        // In freestyle mode, show markers for each freestyle color
        return freestyleColors.map((color, index) => {
          const markerAngle = (index * 90) * (Math.PI / 180); // Spread them around
          const markerRadius = WHEEL_RADIUS - (WHEEL_STROKE_WIDTH / 2);
          const markerX = WHEEL_RADIUS + markerRadius * Math.cos(markerAngle);
          const markerY = WHEEL_RADIUS + markerRadius * Math.sin(markerAngle);
          
          return (
            <Circle
              key={`freestyle-${index}`}
              cx={markerX}
              cy={markerY}
              r="8"
              fill={color}
              stroke="white"
              strokeWidth="3"
              opacity={0.9}
            />
          );
        });
      }
      
      // Render markers using memoized positions
      return memoizedMarkers.map((marker) => {
        const markerAngle = marker.angle * (Math.PI / 180);
        const markerRadius = WHEEL_RADIUS - (WHEEL_STROKE_WIDTH / 2);
        const markerX = WHEEL_RADIUS + markerRadius * Math.cos(markerAngle);
        const markerY = WHEEL_RADIUS + markerRadius * Math.sin(markerAngle);
        
        return (
          <Circle
            key={marker.id}
            cx={markerX}
            cy={markerY}
            r={marker.isActive ? "10" : "8"}
            fill={marker.color}
            stroke={marker.isActive ? "#333" : "white"}
            strokeWidth={marker.isActive ? "4" : "3"}
            opacity={marker.isActive ? 1 : 0.8}
          />
        );
      });
    };

    return (
      <PanGestureHandler onGestureEvent={gestureHandler} enabled={!isColorLocked}>
        <Animated.View style={styles.wheelContainer}>
          <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
            <Defs>
              <RadialGradient id="colorWheel" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="white" />
                <Stop offset="100%" stopColor="transparent" />
              </RadialGradient>
            </Defs>
            
            {/* Color wheel segments */}
            {Array.from({ length: 360 }, (_, i) => {
              const startAngle = i * (Math.PI / 180);
              const endAngle = (i + 1) * (Math.PI / 180);
              const color = hslToHex(i, 100, 50);
              
              const x1 = WHEEL_RADIUS + (WHEEL_RADIUS - WHEEL_STROKE_WIDTH) * Math.cos(startAngle);
              const y1 = WHEEL_RADIUS + (WHEEL_RADIUS - WHEEL_STROKE_WIDTH) * Math.sin(startAngle);
              const x2 = WHEEL_RADIUS + WHEEL_RADIUS * Math.cos(startAngle);
              const y2 = WHEEL_RADIUS + WHEEL_RADIUS * Math.sin(startAngle);
              const x3 = WHEEL_RADIUS + WHEEL_RADIUS * Math.cos(endAngle);
              const y3 = WHEEL_RADIUS + WHEEL_RADIUS * Math.sin(endAngle);
              const x4 = WHEEL_RADIUS + (WHEEL_RADIUS - WHEEL_STROKE_WIDTH) * Math.cos(endAngle);
              const y4 = WHEEL_RADIUS + (WHEEL_RADIUS - WHEEL_STROKE_WIDTH) * Math.sin(endAngle);
              
              return (
                <Path
                  key={i}
                  d={`M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`}
                  fill={color}
                />
              );
            })}
            
            {/* Multi-marker color selectors */}
            {renderMarkers()}
          </Svg>
        </Animated.View>
      </PanGestureHandler>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fashion Color Wheel</Text>
        <Text style={styles.subtitle}>Discover perfect color combinations</Text>
        
        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity 
            style={[styles.toggleButton, !useAdvancedMode && styles.activeToggle]}
            onPress={() => setUseAdvancedMode(false)}
          >
            <Text style={[styles.toggleText, !useAdvancedMode && styles.activeToggleText]}>Basic</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, useAdvancedMode && styles.activeToggle]}
            onPress={() => setUseAdvancedMode(true)}
          >
            <Text style={[styles.toggleText, useAdvancedMode && styles.activeToggleText]}>Advanced</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Conditional Rendering: Advanced vs Basic Color Wheel */}
      {useAdvancedMode ? (
        <AdvancedColorWheel 
          currentUser={currentUser}
          onSaveColorMatch={onSaveColorMatch}
        />
      ) : (
        <>
          {renderColorWheel()}

          <View style={styles.colorDisplay}>
        <View style={[styles.colorBox, { backgroundColor: selectedColor }]} />
        <View style={styles.colorInfo}>
          <Text style={styles.colorText}>Selected Color</Text>
          <Text style={styles.colorValue}>{selectedColor}</Text>
        </View>
      </View>

      <View style={styles.inputButtons}>
        <TouchableOpacity style={styles.inputButton} onPress={() => {}}>
          <Text style={styles.inputButtonText}>📷 Camera</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.inputButton} onPress={handleGalleryColorExtraction}>
          <Text style={styles.inputButtonText}>🖼️ Gallery</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.inputButton} onPress={() => setShowManualInput(true)}>
          <Text style={styles.inputButtonText}>✏️ Manual</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.schemeSection}>
        <Text style={styles.sectionTitle}>Color Schemes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.schemeScroll}>
          {['complementary', 'analogous', 'triadic', 'tetradic', 'monochromatic'].map((scheme) => (
            <TouchableOpacity
              key={scheme}
              style={[styles.schemeButton, selectedScheme === scheme && styles.selectedScheme]}
              onPress={() => setSelectedScheme(scheme)}
            >
              <Text style={[styles.schemeText, selectedScheme === scheme && styles.selectedSchemeText]}>
                {scheme.charAt(0).toUpperCase() + scheme.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.colorsPreview}>
        {memoizedColorScheme.map((color, index) => {
          // Calculate contrast ratio with base color for accessibility
          const contrastRatio = calculateContrastRatio(selectedColor, color);
          const contrastLevel = getContrastLevel(contrastRatio);
          
          return (
            <View key={index} style={styles.previewColorContainer}>
              <View style={[styles.previewColor, { backgroundColor: color }]} />
              {contrastLevel && (
                <Text style={styles.contrastBadge}>{contrastLevel}</Text>
              )}
            </View>
          );
        })}
      </View>

      <TouchableOpacity 
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={handleSaveColorMatch}
        disabled={isSaving}
      >
        {isSaving ? (
          <View style={styles.savingContainer}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.saveButtonText}>Saving...</Text>
          </View>
        ) : (
          <Text style={styles.saveButtonText}>💾 Save Color Match</Text>
        )}
      </TouchableOpacity>

      {/* Manual Input Modal */}
      <Modal visible={showManualInput} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Hex Color</Text>
            <TextInput
              style={styles.hexInput}
              value={manualColorInput}
              onChangeText={setManualColorInput}
              placeholder="#FF6B6B"
              placeholderTextColor="#999"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowManualInput(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={async () => {
                  // Allow both #RGB and #RRGGBB formats
                  let processedColor = manualColorInput.trim();
                  
                  // Convert #RGB to #RRGGBB
                  if (processedColor.match(/^#[0-9A-F]{3}$/i)) {
                    const r = processedColor[1];
                    const g = processedColor[2];
                    const b = processedColor[3];
                    processedColor = `#${r}${r}${g}${g}${b}${b}`;
                  }
                  
                  if (validateHexColor(processedColor)) {
                    // Compute angle from hex color
                    const hsl = hexToHsl(processedColor);
                    const newAngle = hsl.h;
                    
                    // Use centralized update function for proper marker sync
                    updateColorState(newAngle, processedColor, activeMarkerId);
                    
                    // Update main color state for non-freestyle modes
                    if (selectedScheme !== 'freestyle') {
                      setSelectedColor(processedColor);
                      setAngle(newAngle);
                    }
                    
                    setShowManualInput(false);
                    setManualColorInput('');
                    
                    // Success haptic feedback
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } else {
                    Alert.alert('Invalid Color', 'Please enter a valid hex color (e.g., #FF5733 or #F73)');
                    // Error haptic feedback
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  }
                }}
              >
                <Text style={styles.confirmText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Color Lock Status */}
      {isColorLocked && (
        <View style={styles.colorLockStatus}>
          <Text style={styles.lockStatusText}>🔒 Color Locked: {lockedColor}</Text>
          <TouchableOpacity 
          style={[styles.lockButton, isColorLocked && styles.lockButtonActive]}
          onPress={toggleColorLock}
        >
          <Text style={[styles.lockButtonText, isColorLocked && styles.lockButtonTextActive]}>
            {isColorLocked ? '🔓 Unlock' : '🔒 Lock'} Color
          </Text>
        </TouchableOpacity>
        </View>
      )}

          {/* Coolors Color Extractor Modal */}
          {showCoolorsExtractor && (
            <Modal
              animationType="slide"
              transparent={false}
              visible={showCoolorsExtractor}
              onRequestClose={() => setShowCoolorsExtractor(false)}
            >
              <CoolorsColorExtractor
                onColorExtracted={handleColorExtracted}
                onClose={() => setShowCoolorsExtractor(false)}
                onCreateCollage={handleCreateCollage}
              />
            </Modal>
          )}

          {/* Color Collage Creator Modal */}
          {showCollageCreator && collageImage && (
            <ColorCollageCreator
              image={collageImage}
              colors={memoizedColorScheme}
              onClose={handleCollageClose}
              onExport={handleCollageExport}
            />
          )}
        </>
      )}
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  wheelContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  colorDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 20,
    padding: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  colorBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  colorInfo: {
    flex: 1,
  },
  colorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 5,
  },
  colorValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3498db',
    fontFamily: 'monospace',
  },
  inputButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  inputButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  inputButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  schemeSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  schemeScroll: {
    flexDirection: 'row',
  },
  schemeButton: {
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#ecf0f1',
  },
  selectedScheme: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  schemeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  selectedSchemeText: {
    color: 'white',
  },
  colorsPreview: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 30,
  },
  previewColorContainer: {
    alignItems: 'center',
    marginHorizontal: 5,
  },
  previewColor: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  contrastBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  saveButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  saveButtonDisabled: {
    backgroundColor: '#bdc3c7',
    shadowOpacity: 0.1,
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
  },
  hexInput: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 10,
    padding: 15,
    fontSize: 18,
    fontFamily: 'monospace',
    width: '100%',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  cancelText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  confirmText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  demoText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 20,
  },
  colorLockStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  lockStatusText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '600',
    flex: 1,
  },
  unlockButton: {
    backgroundColor: '#ffc107',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 15,
  },
  unlockButtonText: {
    color: '#212529',
    fontSize: 12,
    fontWeight: '600',
  },
  // Mode Toggle Styles
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#e9ecef',
    borderRadius: 25,
    padding: 4,
    marginTop: 15,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  activeToggle: {
    backgroundColor: '#007bff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  activeToggleText: {
    color: '#ffffff',
  },
});
