// components/SafeColorWheel.js - Fallback color wheel without Skia
import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, Dimensions } from 'react-native';
import { getColorScheme } from '../utils/optimizedColor';

const { width } = Dimensions.get('window');
const WHEEL_SIZE = Math.min(width * 0.8, 300);

const SafeColorWheel = ({ 
  scheme = 'complementary', 
  initialHex = '#ff0000',
  onColorsChange,
  onHexChange,
  onActiveHandleChange
}) => {
  const [baseColor, setBaseColor] = useState(initialHex);
  const [colors, setColors] = useState([]);

  useEffect(() => {
    try {
      const schemeColors = getColorScheme(baseColor, scheme);
      setColors(schemeColors);
      onColorsChange?.(schemeColors);
    } catch (error) {
      console.error('Color scheme generation error:', error);
      setColors([baseColor]);
      onColorsChange?.([baseColor]);
    }
  }, [baseColor, scheme, onColorsChange]);

  const colorOptions = [
    '#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80',
    '#00ffff', '#0080ff', '#0000ff', '#8000ff', '#ff00ff', '#ff0080'
  ];

  const handleColorSelect = (color) => {
    setBaseColor(color);
    onHexChange?.(color);
    onActiveHandleChange?.(0);
  };

  return (
    <View style={{ 
      width: WHEEL_SIZE, 
      height: WHEEL_SIZE, 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      borderRadius: WHEEL_SIZE / 2,
      padding: 20
    }}>
      <Text style={{ 
        fontSize: 16, 
        fontWeight: 'bold', 
        marginBottom: 20,
        textAlign: 'center',
        color: '#333'
      }}>
        Safe Color Picker
      </Text>
      
      <View style={{ 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        justifyContent: 'center',
        maxWidth: WHEEL_SIZE - 40
      }}>
        {colorOptions.map((color, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleColorSelect(color)}
            style={{
              width: 40,
              height: 40,
              backgroundColor: color,
              borderRadius: 20,
              margin: 5,
              borderWidth: baseColor === color ? 3 : 1,
              borderColor: baseColor === color ? '#333' : '#ccc'
            }}
          />
        ))}
      </View>

      <Text style={{ 
        fontSize: 12, 
        color: '#666', 
        textAlign: 'center',
        marginTop: 15
      }}>
        Current: {baseColor}
      </Text>
      
      <Text style={{ 
        fontSize: 10, 
        color: '#999', 
        textAlign: 'center',
        marginTop: 5
      }}>
        Scheme: {scheme}
      </Text>
    </View>
  );
};

export default SafeColorWheel;
