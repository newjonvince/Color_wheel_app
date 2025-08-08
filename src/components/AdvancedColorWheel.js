import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Modal, Alert, PanResponder, Dimensions, Share } from 'react-native';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as MailComposer from 'expo-mail-composer';
import ApiService from '../services/api';

const { width: screenWidth } = Dimensions.get('window');
const WHEEL_SIZE = screenWidth * 0.8;
const WHEEL_RADIUS = WHEEL_SIZE / 2;
const WHEEL_STROKE_WIDTH = 40;

export default function AdvancedColorWheel({ currentUser, onSaveColorMatch }) {
  const [selectedScheme, setSelectedScheme] = useState('triadic');
  const [colorMarkers, setColorMarkers] = useState([
    { id: 1, color: '#1ECBE1', angle: 180, isActive: true }
  ]);
  const [freestyleColors, setFreestyleColors] = useState(['#FF6B6B', '#4ECDC4']);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeMarkerId, setActiveMarkerId] = useState(1);

  // Color conversion utility
  const hslToHex = (h, s, l) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  // Update color markers based on scheme rules
  const updateColorMarkers = (newAngle, newColor, activeId = 1) => {
    if (selectedScheme === 'freestyle') {
      // In freestyle mode, only update the active marker
      setColorMarkers(prev => 
        prev.map(marker => 
          marker.id === activeId 
            ? { ...marker, angle: newAngle, color: newColor }
            : marker
        )
      );
      return;
    }

    // Calculate all marker positions based on color theory
    let newMarkers = [{ id: 1, color: newColor, angle: newAngle, isActive: true }];
    
    switch (selectedScheme) {
      case 'complementary':
        newMarkers.push({
          id: 2,
          color: hslToHex((newAngle + 180) % 360, 100, 50),
          angle: (newAngle + 180) % 360,
          isActive: false
        });
        break;
      case 'analogous':
        newMarkers.push(
          {
            id: 2,
            color: hslToHex((newAngle + 30) % 360, 100, 50),
            angle: (newAngle + 30) % 360,
            isActive: false
          },
          {
            id: 3,
            color: hslToHex((newAngle - 30 + 360) % 360, 100, 50),
            angle: (newAngle - 30 + 360) % 360,
            isActive: false
          }
        );
        break;
      case 'triadic':
        newMarkers.push(
          {
            id: 2,
            color: hslToHex((newAngle + 120) % 360, 100, 50),
            angle: (newAngle + 120) % 360,
            isActive: false
          },
          {
            id: 3,
            color: hslToHex((newAngle + 240) % 360, 100, 50),
            angle: (newAngle + 240) % 360,
            isActive: false
          }
        );
        break;
      case 'tetradic':
        newMarkers.push(
          {
            id: 2,
            color: hslToHex((newAngle + 90) % 360, 100, 50),
            angle: (newAngle + 90) % 360,
            isActive: false
          },
          {
            id: 3,
            color: hslToHex((newAngle + 180) % 360, 100, 50),
            angle: (newAngle + 180) % 360,
            isActive: false
          },
          {
            id: 4,
            color: hslToHex((newAngle + 270) % 360, 100, 50),
            angle: (newAngle + 270) % 360,
            isActive: false
          }
        );
        break;
      case 'monochromatic':
        newMarkers.push(
          {
            id: 2,
            color: hslToHex(newAngle, 100, 30),
            angle: newAngle,
            isActive: false
          },
          {
            id: 3,
            color: hslToHex(newAngle, 100, 70),
            angle: newAngle,
            isActive: false
          }
        );
        break;
    }
    
    setColorMarkers(newMarkers);
  };

  // Enhanced color wheel interaction
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const centerX = WHEEL_SIZE / 2;
      const centerY = WHEEL_SIZE / 2;
      const distance = Math.sqrt(Math.pow(locationX - centerX, 2) + Math.pow(locationY - centerY, 2));
      
      if (distance >= WHEEL_RADIUS - WHEEL_STROKE_WIDTH && distance <= WHEEL_RADIUS) {
        let newAngle = Math.atan2(locationY - centerY, locationX - centerX) * (180 / Math.PI);
        if (newAngle < 0) newAngle += 360;
        
        const newColor = hslToHex(newAngle, 100, 50);
        updateColorMarkers(newAngle, newColor, activeMarkerId);
      }
    },
    onPanResponderMove: (evt, gestureState) => {
      const { locationX, locationY } = evt.nativeEvent;
      const centerX = WHEEL_SIZE / 2;
      const centerY = WHEEL_SIZE / 2;
      const distance = Math.sqrt(Math.pow(locationX - centerX, 2) + Math.pow(locationY - centerY, 2));
      
      if (distance >= WHEEL_RADIUS - WHEEL_STROKE_WIDTH && distance <= WHEEL_RADIUS) {
        let newAngle = Math.atan2(locationY - centerY, locationX - centerX) * (180 / Math.PI);
        if (newAngle < 0) newAngle += 360;
        
        const newColor = hslToHex(newAngle, 100, 50);
        updateColorMarkers(newAngle, newColor, activeMarkerId);
      }
    },
  });

  // Add color to freestyle palette
  const addFreestyleColor = () => {
    if (freestyleColors.length < 4) {
      const newColor = hslToHex(Math.random() * 360, 100, 50);
      setFreestyleColors(prev => [...prev, newColor]);
    }
  };

  // Remove color from freestyle palette
  const removeFreestyleColor = (index) => {
    if (freestyleColors.length > 2) {
      setFreestyleColors(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Get current color palette
  const getCurrentColors = () => {
    if (selectedScheme === 'freestyle') {
      return freestyleColors;
    }
    return colorMarkers.map(marker => marker.color);
  };

  // Save color palette to boards
  const handleSaveColorMatch = async () => {
    try {
      const colors = getCurrentColors();
      const colorMatch = {
        baseColor: colors[0],
        scheme: selectedScheme,
        colors: colors,
        isPublic: false,
        metadata: {
          extractionMethod: 'advanced_wheel',
          markerCount: colors.length,
          timestamp: new Date().toISOString()
        }
      };
      
      const response = await ApiService.createColorMatch(colorMatch);
      
      if (response.success) {
        if (onSaveColorMatch) {
          onSaveColorMatch({
            ...colorMatch,
            id: response.colorMatch.id,
            timestamp: response.colorMatch.created_at
          });
        }
        Alert.alert('Saved!', 'Color palette saved to your boards!');
      } else {
        throw new Error(response.message || 'Failed to save color match');
      }
    } catch (error) {
      console.error('Error saving color match:', error);
      Alert.alert('Save Failed', error.message || 'Failed to save color palette. Please try again.');
    }
  };

  // Export/Share functionality
  const handleExport = async (method) => {
    const colors = getCurrentColors();
    const colorText = colors.join(', ');
    const message = `🎨 Fashion Color Palette (${selectedScheme})\n\nColors: ${colorText}\n\nCreated with Fashion Color Wheel`;

    try {
      if (method === 'text') {
        await Share.share({
          message: message,
          title: 'Fashion Color Palette'
        });
      } else if (method === 'email') {
        const isAvailable = await MailComposer.isAvailableAsync();
        if (isAvailable) {
          await MailComposer.composeAsync({
            subject: 'Fashion Color Palette',
            body: message,
            isHtml: false
          });
        } else {
          Alert.alert('Email Not Available', 'Email is not configured on this device');
        }
      }
      setShowExportModal(false);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'Failed to export color palette');
    }
  };

  // Render multiple markers
  const renderMarkers = () => {
    if (selectedScheme === 'freestyle') {
      return freestyleColors.map((color, index) => {
        const markerAngle = (index * 90) * (Math.PI / 180);
        const markerRadius = WHEEL_RADIUS - (WHEEL_STROKE_WIDTH / 2);
        const markerX = WHEEL_RADIUS + markerRadius * Math.cos(markerAngle);
        const markerY = WHEEL_RADIUS + markerRadius * Math.sin(markerAngle);
        
        return (
          <Circle
            key={`freestyle-${index}`}
            cx={markerX}
            cy={markerY}
            r="10"
            fill={color}
            stroke="white"
            strokeWidth="3"
            opacity={0.9}
          />
        );
      });
    }
    
    return colorMarkers.map((marker) => {
      const markerAngle = marker.angle * (Math.PI / 180);
      const markerRadius = WHEEL_RADIUS - (WHEEL_STROKE_WIDTH / 2);
      const markerX = WHEEL_RADIUS + markerRadius * Math.cos(markerAngle);
      const markerY = WHEEL_RADIUS + markerRadius * Math.sin(markerAngle);
      
      return (
        <Circle
          key={marker.id}
          cx={markerX}
          cy={markerY}
          r={marker.isActive ? "12" : "10"}
          fill={marker.color}
          stroke={marker.isActive ? "#333" : "white"}
          strokeWidth={marker.isActive ? "4" : "3"}
          opacity={marker.isActive ? 1 : 0.8}
        />
      );
    });
  };

  // Render color wheel
  const renderColorWheel = () => {
    return (
      <View style={styles.wheelContainer} {...panResponder.panHandlers}>
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
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Color Wheel */}
      {renderColorWheel()}

      {/* Scheme Selector */}
      <View style={styles.schemeSection}>
        <Text style={styles.sectionTitle}>Color Combination</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.schemeScroll}>
          {['complementary', 'analogous', 'triadic', 'tetradic', 'monochromatic', 'freestyle'].map((scheme) => (
            <TouchableOpacity
              key={scheme}
              style={[
                styles.schemeButton,
                selectedScheme === scheme && styles.selectedScheme
              ]}
              onPress={() => {
                setSelectedScheme(scheme);
                if (scheme !== 'freestyle') {
                  // Reset to single marker for scheme-based modes
                  const baseColor = colorMarkers[0]?.color || '#1ECBE1';
                  const baseAngle = colorMarkers[0]?.angle || 180;
                  updateColorMarkers(baseAngle, baseColor);
                }
              }}
            >
              <Text style={[
                styles.schemeText,
                selectedScheme === scheme && styles.selectedSchemeText
              ]}>
                {scheme.charAt(0).toUpperCase() + scheme.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Freestyle Color Management */}
      {selectedScheme === 'freestyle' && (
        <View style={styles.freestyleSection}>
          <Text style={styles.sectionTitle}>Freestyle Colors</Text>
          <View style={styles.freestyleColors}>
            {freestyleColors.map((color, index) => (
              <View key={index} style={styles.freestyleColorItem}>
                <View style={[styles.freestyleColorBox, { backgroundColor: color }]} />
                <Text style={styles.freestyleColorText}>{color}</Text>
                {freestyleColors.length > 2 && (
                  <TouchableOpacity
                    style={styles.removeColorButton}
                    onPress={() => removeFreestyleColor(index)}
                  >
                    <Ionicons name="close-circle" size={20} color="#e74c3c" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {freestyleColors.length < 4 && (
              <TouchableOpacity style={styles.addColorButton} onPress={addFreestyleColor}>
                <Ionicons name="add-circle" size={40} color="#3498db" />
                <Text style={styles.addColorText}>Add Color</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Color Preview */}
      <View style={styles.colorsPreview}>
        {getCurrentColors().map((color, index) => (
          <View key={index} style={styles.colorPreviewItem}>
            <View style={[styles.previewColor, { backgroundColor: color }]} />
            <Text style={styles.colorValue}>{color}</Text>
          </View>
        ))}
      </View>

      {/* Action Buttons */}
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
      <Modal visible={showExportModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Export Color Palette</Text>
            <TouchableOpacity 
              style={styles.exportOption}
              onPress={() => handleExport('text')}
            >
              <Ionicons name="chatbubble" size={24} color="#3498db" />
              <Text style={styles.exportOptionText}>Share as Text</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.exportOption}
              onPress={() => handleExport('email')}
            >
              <Ionicons name="mail" size={24} color="#3498db" />
              <Text style={styles.exportOptionText}>Send via Email</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowExportModal(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
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
  schemeSection: {
    marginHorizontal: 20,
    marginTop: 20,
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
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
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
  freestyleSection: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  freestyleColors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  freestyleColorItem: {
    alignItems: 'center',
    marginRight: 15,
    marginBottom: 10,
  },
  freestyleColorBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  freestyleColorText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 5,
    fontFamily: 'monospace',
  },
  removeColorButton: {
    position: 'absolute',
    top: -5,
    right: -5,
  },
  addColorButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  addColorText: {
    fontSize: 12,
    color: '#3498db',
    marginTop: 5,
    fontWeight: '600',
  },
  colorsPreview: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginHorizontal: 20,
    marginTop: 20,
  },
  colorPreviewItem: {
    alignItems: 'center',
    marginHorizontal: 10,
    marginBottom: 15,
  },
  previewColor: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  colorValue: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 8,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 30,
  },
  saveButton: {
    backgroundColor: '#e74c3c',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 25,
    flex: 0.45,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  exportButton: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 25,
    flex: 0.45,
    justifyContent: 'center',
  },
  exportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 25,
    borderRadius: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2c3e50',
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    marginBottom: 15,
    width: '100%',
  },
  exportOptionText: {
    fontSize: 16,
    color: '#2c3e50',
    marginLeft: 15,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    marginTop: 10,
  },
  cancelText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
