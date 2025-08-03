import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, PanResponder, Dimensions, ScrollView, Image, Modal, ActivityIndicator, Alert, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import { Camera } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';

const { width } = Dimensions.get('window');
const WHEEL_SIZE = width * 0.8;
const WHEEL_STROKE_WIDTH = 50;
const WHEEL_RADIUS = WHEEL_SIZE / 2;
const SELECTOR_SIZE = 30;

export default function App() {
  const [selectedColor, setSelectedColor] = useState('#1ECBE1');
  const [complementaryColor, setComplementaryColor] = useState('#E1341E');
  const [colorScheme, setColorScheme] = useState('complementary');
  const [schemeColors, setSchemeColors] = useState([]);
  const [angle, setAngle] = useState(180);
  
  // Camera states
  const [hasPermission, setHasPermission] = useState(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [type, setType] = useState(Camera.Constants.Type.back);
  const [capturedImage, setCapturedImage] = useState(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [savedOutfits, setSavedOutfits] = useState([]);
  
  // Manual color input states
  const [manualColorInput, setManualColorInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  
  // Account management states
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ email: '', password: '', confirmPassword: '' });
  
  const cameraRef = useRef(null);
  
  const schemes = {
    complementary: 'Complementary',
    monochromatic: 'Monochromatic',
    analogous: 'Analogous',
    triadic: 'Triadic',
    tetradic: 'Tetradic'
  };

  useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(cameraStatus === 'granted' && mediaStatus === 'granted');
    })();
  }, []);

  useEffect(() => {
    updateSchemeColors();
  }, [selectedColor, colorScheme]);

  const updateSchemeColors = () => {
    const hsl = hexToHSL(selectedColor);
    let colors = [];

    switch(colorScheme) {
      case 'complementary':
        // Opposite on the color wheel (180 degrees apart)
        colors = [selectedColor, HSLToHex((hsl.h + 180) % 360, hsl.s, hsl.l)];
        setComplementaryColor(colors[1]);
        break;
      case 'monochromatic':
        // Same hue, different saturation/lightness
        colors = [
          selectedColor,
          HSLToHex(hsl.h, Math.max(0, hsl.s - 30), hsl.l),
          HSLToHex(hsl.h, Math.min(100, hsl.s + 30), hsl.l),
          HSLToHex(hsl.h, hsl.s, Math.max(0, hsl.l - 20)),
          HSLToHex(hsl.h, hsl.s, Math.min(100, hsl.l + 20))
        ];
        break;
      case 'analogous':
        // Adjacent colors (30 degrees apart)
        colors = [
          HSLToHex((hsl.h - 30 + 360) % 360, hsl.s, hsl.l),
          selectedColor,
          HSLToHex((hsl.h + 30) % 360, hsl.s, hsl.l)
        ];
        break;
      case 'triadic':
        // Three colors evenly spaced (120 degrees apart)
        colors = [
          selectedColor,
          HSLToHex((hsl.h + 120) % 360, hsl.s, hsl.l),
          HSLToHex((hsl.h + 240) % 360, hsl.s, hsl.l)
        ];
        break;
      case 'tetradic':
        // Four colors evenly spaced (90 degrees apart)
        colors = [
          selectedColor,
          HSLToHex((hsl.h + 90) % 360, hsl.s, hsl.l),
          HSLToHex((hsl.h + 180) % 360, hsl.s, hsl.l),
          HSLToHex((hsl.h + 270) % 360, hsl.s, hsl.l)
        ];
        break;
    }
    
    setSchemeColors(colors);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        const centerX = WHEEL_SIZE / 2;
        const centerY = WHEEL_SIZE / 2;
        
        // Calculate angle from center
        let angle = Math.atan2(locationY - centerY, locationX - centerX) * (180 / Math.PI);
        angle = (angle + 360) % 360; // Convert to 0-360 range
        
        // Calculate distance from center
        const distance = Math.sqrt(
          Math.pow(locationX - centerX, 2) + Math.pow(locationY - centerY, 2)
        );
        
        // Only update if within the color wheel ring
        const innerRadius = WHEEL_RADIUS - WHEEL_STROKE_WIDTH;
        const outerRadius = WHEEL_RADIUS;
        
        if (distance >= innerRadius && distance <= outerRadius) {
          setAngle(angle);
          
          // Convert angle to hue (0-360)
          const hue = angle;
          
          // Create color with full saturation and 50% lightness
          const color = HSLToHex(hue, 100, 50);
          setSelectedColor(color);
        }
      },
    })
  ).current;

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      setCapturedImage(photo.uri);
      
      try {
        // Extract dominant color from the captured image
        const result = await extractDominantColor(photo.uri);
        
        if (result) {
          // Update the color wheel with the extracted color
          setAngle(result.angle);
          setSelectedColor(result.color);
          
          // Close camera after successful processing
          setCameraVisible(false);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to process image: ' + error.message);
      }
    }
  };

  const extractDominantColor = async (imageUri) => {
    try {
      setProcessingImage(true);
      
      // Resize image for faster processing while maintaining quality for color analysis
      const resizedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 200, height: 200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.PNG }
      );

      // Enhanced color extraction simulation with more realistic fashion colors
      // In production, you would implement actual pixel analysis using libraries like:
      // - react-native-image-colors
      // - Custom native modules for color quantization
      // - Server-side color analysis APIs
      
      const fashionColors = {
        // Common clothing colors with their hex values
        neutrals: ['#000000', '#FFFFFF', '#808080', '#C0C0C0', '#696969', '#2F4F4F', '#708090'],
        blues: ['#000080', '#4169E1', '#1E90FF', '#87CEEB', '#B0C4DE', '#4682B4', '#6495ED'],
        reds: ['#8B0000', '#DC143C', '#B22222', '#CD5C5C', '#F08080', '#FA8072', '#E9967A'],
        greens: ['#006400', '#228B22', '#32CD32', '#90EE90', '#98FB98', '#8FBC8F', '#9ACD32'],
        browns: ['#8B4513', '#A0522D', '#D2691E', '#CD853F', '#F4A460', '#DEB887', '#D2B48C'],
        purples: ['#4B0082', '#8B008B', '#9932CC', '#BA55D3', '#DA70D6', '#DDA0DD', '#E6E6FA'],
        yellows: ['#FFD700', '#FFFF00', '#FFFFE0', '#F0E68C', '#BDB76B', '#DAA520', '#B8860B'],
        pinks: ['#FF1493', '#FF69B4', '#FFB6C1', '#FFC0CB', '#FFCCCB', '#F08080', '#FA8072']
      };
      
      // Simulate more realistic color analysis based on common fashion items
      const allColors = Object.values(fashionColors).flat();
      
      // Add some processing delay to simulate real analysis
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate extracting the most prominent color
      // In reality, this would analyze pixel clusters and return the dominant non-background color
      let extractedColor;
      
      // Simulate different scenarios based on random factors
      const scenario = Math.random();
      
      if (scenario < 0.3) {
        // Neutral colors (common in fashion)
        extractedColor = fashionColors.neutrals[Math.floor(Math.random() * fashionColors.neutrals.length)];
      } else if (scenario < 0.5) {
        // Blue tones (very common in clothing)
        extractedColor = fashionColors.blues[Math.floor(Math.random() * fashionColors.blues.length)];
      } else if (scenario < 0.65) {
        // Earth tones and browns
        extractedColor = fashionColors.browns[Math.floor(Math.random() * fashionColors.browns.length)];
      } else {
        // Other vibrant colors
        extractedColor = allColors[Math.floor(Math.random() * allColors.length)];
      }
      
      // Convert the extracted color to HSL and find the corresponding angle on the color wheel
      const hsl = hexToHSL(extractedColor);
      const newAngle = hsl.h;
      
      setProcessingImage(false);
      return { color: extractedColor, angle: newAngle };
      
    } catch (error) {
      console.error('Error extracting color:', error);
      setProcessingImage(false);
    }
  };

  const saveOutfit = () => {
    // Check if user is logged in before saving
    if (!user) {
      Alert.alert(
        'Account Required', 
        'You need to create an account to save color combinations. Would you like to sign up?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Up', onPress: () => setShowSignup(true) },
          { text: 'Log In', onPress: () => setShowLogin(true) }
        ]
      );
      return;
    }
    
    const outfit = {
      id: Date.now().toString(),
      selectedColor,
      colorScheme,
      schemeColors: [...schemeColors],
      capturedImage,
      timestamp: new Date().toISOString(),
      userId: user.id
    };
    
    setSavedOutfits(prev => [...prev, outfit]);
    Alert.alert('Success', 'Outfit saved successfully!');
  };

  // Manual color input function
  const handleManualColorInput = (inputColor) => {
    let color = inputColor.trim();
    
    // Add # if not present
    if (!color.startsWith('#')) {
      color = '#' + color;
    }
    
    // Validate hex color format
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexRegex.test(color)) {
      Alert.alert('Invalid Color', 'Please enter a valid hex color code (e.g., #FF5733 or #F53)');
      return;
    }
    
    // Convert 3-digit hex to 6-digit
    if (color.length === 4) {
      color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    
    // Convert to HSL and update the wheel
    const hsl = hexToHSL(color);
    setAngle(hsl.h);
    setSelectedColor(color);
    setManualColorInput('');
    setShowManualInput(false);
  };

  // Account management functions
  const handleLogin = () => {
    // Simple validation
    if (!loginForm.email || !loginForm.password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    // In a real app, you would authenticate with a backend
    // For demo purposes, we'll simulate a successful login
    const mockUser = {
      id: Date.now().toString(),
      email: loginForm.email,
      name: loginForm.email.split('@')[0]
    };
    
    setUser(mockUser);
    setShowLogin(false);
    setLoginForm({ email: '', password: '' });
    Alert.alert('Success', `Welcome back, ${mockUser.name}!`);
  };

  const handleSignup = () => {
    // Simple validation
    if (!signupForm.email || !signupForm.password || !signupForm.confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    if (signupForm.password !== signupForm.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    
    if (signupForm.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }
    
    // In a real app, you would create account with a backend
    // For demo purposes, we'll simulate a successful signup
    const newUser = {
      id: Date.now().toString(),
      email: signupForm.email,
      name: signupForm.email.split('@')[0]
    };
    
    setUser(newUser);
    setShowSignup(false);
    setSignupForm({ email: '', password: '', confirmPassword: '' });
    Alert.alert('Success', `Account created! Welcome, ${newUser.name}!`);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          onPress: () => {
            setUser(null);
            setSavedOutfits([]);
            Alert.alert('Success', 'You have been logged out');
          }
        }
      ]
    );
  };

  const renderColorWheel = () => {
    // Calculate position of primary selector based on angle
    const selectorAngle = angle * (Math.PI / 180);
    const selectorRadius = WHEEL_RADIUS - (WHEEL_STROKE_WIDTH / 2);
    const selectorX = WHEEL_RADIUS + selectorRadius * Math.cos(selectorAngle);
    const selectorY = WHEEL_RADIUS + selectorRadius * Math.sin(selectorAngle);

    // Function to calculate selector positions for different schemes
    const getSchemeSelectors = () => {
      const hsl = hexToHSL(selectedColor);
      const selectors = [];
      
      switch(colorScheme) {
        case 'complementary':
          const compAngle = ((angle + 180) % 360) * (Math.PI / 180);
          selectors.push({
            x: WHEEL_RADIUS + selectorRadius * Math.cos(compAngle),
            y: WHEEL_RADIUS + selectorRadius * Math.sin(compAngle),
            color: schemeColors[1],
            type: 'complementary'
          });
          break;
          
        case 'analogous':
          [-30, 30].forEach((offset, index) => {
            const analogAngle = ((angle + offset + 360) % 360) * (Math.PI / 180);
            selectors.push({
              x: WHEEL_RADIUS + selectorRadius * Math.cos(analogAngle),
              y: WHEEL_RADIUS + selectorRadius * Math.sin(analogAngle),
              color: schemeColors[index === 0 ? 0 : 2],
              type: 'analogous'
            });
          });
          break;
          
        case 'triadic':
          [120, 240].forEach((offset, index) => {
            const triadicAngle = ((angle + offset) % 360) * (Math.PI / 180);
            selectors.push({
              x: WHEEL_RADIUS + selectorRadius * Math.cos(triadicAngle),
              y: WHEEL_RADIUS + selectorRadius * Math.sin(triadicAngle),
              color: schemeColors[index + 1],
              type: 'triadic'
            });
          });
          break;
          
        case 'tetradic':
          [90, 180, 270].forEach((offset, index) => {
            const tetradicAngle = ((angle + offset) % 360) * (Math.PI / 180);
            selectors.push({
              x: WHEEL_RADIUS + selectorRadius * Math.cos(tetradicAngle),
              y: WHEEL_RADIUS + selectorRadius * Math.sin(tetradicAngle),
              color: schemeColors[index + 1],
              type: 'tetradic'
            });
          });
          break;
      }
      
      return selectors;
    };

    const schemeSelectors = getSchemeSelectors();

    return (
      <View style={styles.wheelContainer}>
        <View
          style={styles.colorWheel}
          {...panResponder.panHandlers}
        >
          <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
            {/* Create color wheel with smoother gradients */}
            {Array.from({ length: 360 }, (_, i) => {
              const startAngle = i * Math.PI / 180;
              const endAngle = (i + 1) * Math.PI / 180;
              
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
                  d={`M ${x1} ${y1} L ${x2} ${y2} A ${WHEEL_RADIUS} ${WHEEL_RADIUS} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${WHEEL_RADIUS - WHEEL_STROKE_WIDTH} ${WHEEL_RADIUS - WHEEL_STROKE_WIDTH} 0 0 0 ${x1} ${y1} Z`}
                  fill={HSLToHex(i, 85, 60)}
                />
              );
            })}
            
            {/* Draw connecting lines for color schemes */}
            {colorScheme === 'complementary' && schemeSelectors.length > 0 && (
              <Line
                x1={selectorX}
                y1={selectorY}
                x2={schemeSelectors[0].x}
                y2={schemeSelectors[0].y}
                stroke="rgba(0,0,0,0.3)"
                strokeWidth={1.5}
                strokeDasharray="4,4"
              />
            )}
            
            {colorScheme === 'triadic' && schemeSelectors.length >= 2 && (
              <>
                <Line
                  x1={selectorX}
                  y1={selectorY}
                  x2={schemeSelectors[0].x}
                  y2={schemeSelectors[0].y}
                  stroke="rgba(0,0,0,0.2)"
                  strokeWidth={1}
                />
                <Line
                  x1={schemeSelectors[0].x}
                  y1={schemeSelectors[0].y}
                  x2={schemeSelectors[1].x}
                  y2={schemeSelectors[1].y}
                  stroke="rgba(0,0,0,0.2)"
                  strokeWidth={1}
                />
                <Line
                  x1={schemeSelectors[1].x}
                  y1={schemeSelectors[1].y}
                  x2={selectorX}
                  y2={selectorY}
                  stroke="rgba(0,0,0,0.2)"
                  strokeWidth={1}
                />
              </>
            )}
            
            {/* Primary color selector */}
            <Circle
              cx={selectorX}
              cy={selectorY}
              r={SELECTOR_SIZE / 2}
              fill={selectedColor}
              stroke="white"
              strokeWidth={3}
            />
            <Circle
              cx={selectorX}
              cy={selectorY}
              r={SELECTOR_SIZE / 2 - 3}
              fill="none"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth={1}
            />
            
            {/* Scheme color selectors */}
            {schemeSelectors.map((selector, index) => (
              <Circle
                key={index}
                cx={selector.x}
                cy={selector.y}
                r={(SELECTOR_SIZE / 2) - 2}
                fill={selector.color}
                stroke="white"
                strokeWidth={2}
              />
            ))}
          </Svg>
        </View>
        
        {/* Color scheme legend */}
        <View style={styles.schemeLegend}>
          <Text style={styles.schemeLegendTitle}>{schemes[colorScheme]} Colors</Text>
          <View style={styles.schemeLegendColors}>
            {schemeColors.map((color, index) => (
              <View key={index} style={styles.legendColorItem}>
                <View style={[styles.legendColorSwatch, { backgroundColor: color }]} />
                <Text style={styles.legendColorText}>{color.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderCamera = () => {
    if (hasPermission === null) {
      return <View style={styles.cameraContainer}><Text>Requesting camera permission...</Text></View>;
    }
    if (hasPermission === false) {
      return <View style={styles.cameraContainer}><Text>No access to camera</Text></View>;
    }
    
    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={cameraVisible}
        onRequestClose={() => setCameraVisible(false)}
      >
        <View style={styles.cameraContainer}>
          {processingImage ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text style={styles.processingText}>Extracting color...</Text>
            </View>
          ) : (
            <>
              <Camera
                style={styles.camera}
                type={type}
                ref={cameraRef}
              >
                <View style={styles.cameraButtonContainer}>
                  <TouchableOpacity
                    style={styles.flipButton}
                    onPress={() => {
                      setType(
                        type === Camera.Constants.Type.back
                          ? Camera.Constants.Type.front
                          : Camera.Constants.Type.back
                      );
                    }}>
                    <Text style={styles.flipText}>Flip</Text>
                  </TouchableOpacity>
                </View>
              </Camera>
              
              <View style={styles.cameraControls}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setCameraVisible(false)}>
                  <Text style={styles.controlText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                  <View style={styles.captureCircle} />
                </TouchableOpacity>
                
                <View style={styles.spacer} />
              </View>
            </>
          )}
        </View>
      </Modal>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Account Management Header */}
      <View style={styles.accountHeader}>
        <Text style={styles.title}>Fashion Color Wheel</Text>
        {user ? (
          <View style={styles.userInfo}>
            <Text style={styles.welcomeText}>Welcome, {user.name}!</Text>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.authButtons}>
            <TouchableOpacity onPress={() => setShowLogin(true)} style={styles.authButton}>
              <Text style={styles.authButtonText}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSignup(true)} style={styles.authButton}>
              <Text style={styles.authButtonText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {renderColorWheel()}
      
      <View style={styles.colorInfo}>
        <Text style={styles.subtitle}>1. Pick a color</Text>
        <View style={styles.colorActions}>
          <View style={styles.colorDisplay}>
            <View style={[styles.colorBox, { backgroundColor: selectedColor }]} />
            <Text style={styles.colorCode}>{selectedColor.toUpperCase()}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.cameraButton}
            onPress={() => setCameraVisible(true)}
          >
            <Text style={styles.cameraButtonText}>📷</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.manualInputButton}
            onPress={() => setShowManualInput(true)}
          >
            <Text style={styles.cameraButtonText}>✏️</Text>
          </TouchableOpacity>
        </View>
        
        {/* Manual Color Input Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showManualInput}
          onRequestClose={() => setShowManualInput(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Enter Color Code</Text>
              <Text style={styles.modalSubtitle}>Enter a hex color code (e.g., #FF5733 or FF5733)</Text>
              
              <TextInput
                style={styles.colorInput}
                value={manualColorInput}
                onChangeText={setManualColorInput}
                placeholder="#FF5733"
                placeholderTextColor="#999"
                autoCapitalize="characters"
                maxLength={7}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowManualInput(false);
                    setManualColorInput('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.modalConfirmButton}
                  onPress={() => handleManualColorInput(manualColorInput)}
                >
                  <Text style={styles.modalConfirmText}>Apply Color</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
      
      <View style={styles.schemeContainer}>
        <Text style={styles.subtitle}>2. Choose a color combination</Text>
        <View style={styles.schemeSelector}>
          {Object.entries(schemes).map(([key, name]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.schemeButton,
                colorScheme === key && styles.activeScheme
              ]}
              onPress={() => setColorScheme(key)}
            >
              <Text 
                style={[
                  styles.schemeButtonText,
                  colorScheme === key && styles.activeSchemeText
                ]}
              >
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.resultContainer}>
        <View style={styles.colorResults}>
          {schemeColors.map((color, index) => (
            <View key={index} style={[
              styles.resultColorWrapper,
              // Adjust width based on number of colors
              { width: `${100 / Math.min(schemeColors.length, 2)}%` }
            ]}>
              <View 
                style={[styles.resultColorBox, { backgroundColor: color }]} 
              />
              <Text style={styles.resultColorCode}>{color.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </View>
      
      <Text style={styles.subtitle}>3. Use this color combination</Text>
      
      {capturedImage && (
        <View style={styles.capturedImageContainer}>
          <Image source={{ uri: capturedImage }} style={styles.capturedImage} />
        </View>
      )}
      
      <TouchableOpacity 
        style={styles.saveButton}
        onPress={saveOutfit}
      >
        <Text style={styles.saveButtonText}>Save This Outfit</Text>
      </TouchableOpacity>
      
      <View style={styles.legend}>
        {colorScheme === 'complementary' && (
          <View style={styles.legendItem}>
            <View style={styles.legendColorBox}>
              <View style={[styles.legendDot, {backgroundColor: selectedColor}]} />
            </View>
            <Text style={styles.legendText}>Primary</Text>
            
            <View style={[styles.legendColorBox, {marginLeft: 20}]}>
              <View style={[styles.legendDot, {backgroundColor: complementaryColor}]} />
            </View>
            <Text style={styles.legendText}>Secondary</Text>
          </View>
        )}
      </View>
      
      {/* Login Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showLogin}
        onRequestClose={() => setShowLogin(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Login</Text>
            
            <TextInput
              style={styles.authInput}
              value={loginForm.email}
              onChangeText={(text) => setLoginForm({...loginForm, email: text})}
              placeholder="Email"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <TextInput
              style={styles.authInput}
              value={loginForm.password}
              onChangeText={(text) => setLoginForm({...loginForm, password: text})}
              placeholder="Password"
              placeholderTextColor="#999"
              secureTextEntry
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowLogin(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={handleLogin}
              >
                <Text style={styles.modalConfirmText}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Signup Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSignup}
        onRequestClose={() => setShowSignup(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sign Up</Text>
            
            <TextInput
              style={styles.authInput}
              value={signupForm.email}
              onChangeText={(text) => setSignupForm({...signupForm, email: text})}
              placeholder="Email"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <TextInput
              style={styles.authInput}
              value={signupForm.password}
              onChangeText={(text) => setSignupForm({...signupForm, password: text})}
              placeholder="Password (min 6 characters)"
              placeholderTextColor="#999"
              secureTextEntry
            />
            
            <TextInput
              style={styles.authInput}
              value={signupForm.confirmPassword}
              onChangeText={(text) => setSignupForm({...signupForm, confirmPassword: text})}
              placeholder="Confirm Password"
              placeholderTextColor="#999"
              secureTextEntry
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowSignup(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={handleSignup}
              >
                <Text style={styles.modalConfirmText}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {renderCamera()}
    </ScrollView>
  );
}

// Color conversion utilities
function hexToHSL(hex) {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Convert to RGB
  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Find min and max
  let max = Math.max(r, g, b);
  let min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    // Achromatic
    h = s = 0;
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    
    h = Math.round(h * 60);
  }
  
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  
  return { h, s, l };
}

function HSLToHex(h, s, l) {
  s /= 100;
  l /= 100;
  
  let c = (1 - Math.abs(2 * l - 1)) * s;
  let x = c * (1 - Math.abs((h / 60) % 2 - 1));
  let m = l - c / 2;
  let r, g, b;
  
  if (h >= 0 && h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (h >= 60 && h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (h >= 120 && h < 180) {
    [r, g, b] = [0, c, x];
  } else if (h >= 180 && h < 240) {
    [r, g, b] = [0, x, c];
  } else if (h >= 240 && h < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }
  
  r = Math.round((r + m) * 255).toString(16).padStart(2, '0');
  g = Math.round((g + m) * 255).toString(16).padStart(2, '0');
  b = Math.round((b + m) * 255).toString(16).padStart(2, '0');
  
  return `#${r}${g}${b}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  wheelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  colorWheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    overflow: 'hidden',
  },
  colorInfo: {
    marginBottom: 20,
  },
  colorActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
  },
  colorBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  colorCode: {
    fontSize: 18,
    fontFamily: 'monospace',
  },
  cameraButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  cameraButtonText: {
    fontSize: 24,
  },
  schemeContainer: {
    marginBottom: 20,
  },
  schemeSelector: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    overflow: 'hidden',
  },
  schemeButton: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  schemeButtonText: {
    fontSize: 16,
  },
  activeScheme: {
    backgroundColor: '#007AFF',
  },
  activeSchemeText: {
    color: 'white',
  },
  resultContainer: {
    marginVertical: 20,
  },
  colorResults: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  resultColorWrapper: {
    marginBottom: 10,
  },
  resultColorBox: {
    height: 80,
    borderRadius: 5,
    marginBottom: 5,
  },
  resultColorCode: {
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  capturedImageContainer: {
    marginVertical: 15,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  capturedImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 15,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  legend: {
    marginTop: 10,
    marginBottom: 30,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  legendColorBox: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  legendText: {
    marginLeft: 5,
    fontSize: 14,
  },
  // Enhanced color wheel legend styles
  schemeLegend: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  schemeLegendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#495057',
  },
  schemeLegendColors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  legendColorItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 5,
  },
  legendColorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  legendColorText: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 5,
    color: '#6c757d',
  },
  // Account management styles
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  userInfo: {
    alignItems: 'flex-end',
  },
  welcomeText: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 5,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#dc3545',
    borderRadius: 5,
  },
  logoutText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  authButtons: {
    flexDirection: 'row',
  },
  authButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 5,
    marginLeft: 10,
  },
  authButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Manual color input styles
  manualInputButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#1e7e34',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 25,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  colorInput: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 10,
    padding: 15,
    fontSize: 18,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
  },
  authInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#6c757d',
    borderRadius: 8,
    marginRight: 10,
  },
  modalConfirmButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    marginLeft: 10,
  },
  modalCancelText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalConfirmText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Camera styles
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraButtonContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    margin: 20,
  },
  flipButton: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 10,
    borderRadius: 5,
  },
  flipText: {
    fontSize: 18,
    color: 'white',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'black',
  },
  cancelButton: {
    padding: 15,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 5,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'white',
  },
  controlText: {
    color: 'white',
    fontSize: 16,
  },
  spacer: {
    width: 60,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: 'white',
    fontSize: 18,
    marginTop: 20,
  },
});
