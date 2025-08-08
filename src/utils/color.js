/**
 * Color Utility Functions
 * Pure helper functions for color conversion, harmony calculations, and marker positioning
 */

/**
 * Convert HSL to Hex color format
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} Hex color string (e.g., "#FF6B6B")
 */
export const hslToHex = (h, s, l) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/**
 * Convert Hex to RGB color format
 * @param {string} hex - Hex color string (e.g., "#FF6B6B")
 * @returns {object} RGB object with r, g, b properties (0-255)
 */
export const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
};

/**
 * Convert Hex to HSL color format
 * @param {string} hex - Hex color string (e.g., "#FF6B6B")
 * @returns {object} HSL object with h, s, l properties
 */
export const hexToHsl = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

/**
 * Normalize angle to 0-360 range
 * @param {number} angle - Angle in degrees
 * @returns {number} Normalized angle (0-360)
 */
export const normalizeAngle = (angle) => {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
};

/**
 * Convert angle to color wheel position
 * @param {number} angle - Angle in degrees (0-360)
 * @param {number} radius - Wheel radius
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @returns {object} Position object with x, y coordinates
 */
export const angleToPosition = (angle, radius, centerX, centerY) => {
  const radians = (angle - 90) * (Math.PI / 180); // -90 to start from top
  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians)
  };
};

/**
 * Convert position to angle on color wheel
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @returns {number} Angle in degrees (0-360)
 */
export const positionToAngle = (x, y, centerX, centerY) => {
  let angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
  angle += 90; // Adjust to start from top
  return normalizeAngle(angle);
};

/**
 * Calculate distance between two points
 * @param {number} x1 - First point X coordinate
 * @param {number} y1 - First point Y coordinate
 * @param {number} x2 - Second point X coordinate
 * @param {number} y2 - Second point Y coordinate
 * @returns {number} Distance between points
 */
export const calculateDistance = (x1, y1, x2, y2) => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

/**
 * Generate color harmony based on base color and scheme type
 * @param {string} baseColor - Base hex color
 * @param {string} scheme - Color scheme type
 * @param {number} baseAngle - Base angle on color wheel
 * @returns {array} Array of hex colors for the scheme
 */
export const getColorScheme = (baseColor, scheme, baseAngle) => {
  const colors = [baseColor];
  
  switch (scheme) {
    case 'complementary':
      colors.push(hslToHex(normalizeAngle(baseAngle + 180), 100, 50));
      break;
      
    case 'analogous':
      colors.push(hslToHex(normalizeAngle(baseAngle + 30), 100, 50));
      colors.push(hslToHex(normalizeAngle(baseAngle - 30), 100, 50));
      break;
      
    case 'triadic':
      colors.push(hslToHex(normalizeAngle(baseAngle + 120), 100, 50));
      colors.push(hslToHex(normalizeAngle(baseAngle + 240), 100, 50));
      break;
      
    case 'tetradic':
      colors.push(hslToHex(normalizeAngle(baseAngle + 90), 100, 50));
      colors.push(hslToHex(normalizeAngle(baseAngle + 180), 100, 50));
      colors.push(hslToHex(normalizeAngle(baseAngle + 270), 100, 50));
      break;
      
    case 'monochromatic':
      colors.push(hslToHex(baseAngle, 100, 30)); // Darker
      colors.push(hslToHex(baseAngle, 100, 70)); // Lighter
      colors.push(hslToHex(baseAngle, 60, 50));  // Less saturated
      break;
      
    default:
      break;
  }
  
  return colors;
};

/**
 * Calculate marker positions for multi-marker color schemes
 * @param {string} scheme - Color scheme type
 * @param {number} baseAngle - Base angle on color wheel
 * @param {number} activeMarkerId - ID of the active marker
 * @returns {array} Array of marker objects with id, angle, and color
 */
export const calculateMarkerPositions = (scheme, baseAngle, activeMarkerId = 1) => {
  const markers = [];
  
  switch (scheme) {
    case 'complementary':
      markers.push(
        { id: 1, angle: baseAngle, color: hslToHex(baseAngle, 100, 50), isActive: activeMarkerId === 1 },
        { id: 2, angle: normalizeAngle(baseAngle + 180), color: hslToHex(normalizeAngle(baseAngle + 180), 100, 50), isActive: activeMarkerId === 2 }
      );
      break;
      
    case 'analogous':
      markers.push(
        { id: 1, angle: baseAngle, color: hslToHex(baseAngle, 100, 50), isActive: activeMarkerId === 1 },
        { id: 2, angle: normalizeAngle(baseAngle + 30), color: hslToHex(normalizeAngle(baseAngle + 30), 100, 50), isActive: activeMarkerId === 2 },
        { id: 3, angle: normalizeAngle(baseAngle - 30), color: hslToHex(normalizeAngle(baseAngle - 30), 100, 50), isActive: activeMarkerId === 3 }
      );
      break;
      
    case 'triadic':
      markers.push(
        { id: 1, angle: baseAngle, color: hslToHex(baseAngle, 100, 50), isActive: activeMarkerId === 1 },
        { id: 2, angle: normalizeAngle(baseAngle + 120), color: hslToHex(normalizeAngle(baseAngle + 120), 100, 50), isActive: activeMarkerId === 2 },
        { id: 3, angle: normalizeAngle(baseAngle + 240), color: hslToHex(normalizeAngle(baseAngle + 240), 100, 50), isActive: activeMarkerId === 3 }
      );
      break;
      
    case 'tetradic':
      markers.push(
        { id: 1, angle: baseAngle, color: hslToHex(baseAngle, 100, 50), isActive: activeMarkerId === 1 },
        { id: 2, angle: normalizeAngle(baseAngle + 90), color: hslToHex(normalizeAngle(baseAngle + 90), 100, 50), isActive: activeMarkerId === 2 },
        { id: 3, angle: normalizeAngle(baseAngle + 180), color: hslToHex(normalizeAngle(baseAngle + 180), 100, 50), isActive: activeMarkerId === 3 },
        { id: 4, angle: normalizeAngle(baseAngle + 270), color: hslToHex(normalizeAngle(baseAngle + 270), 100, 50), isActive: activeMarkerId === 4 }
      );
      break;
      
    case 'monochromatic':
      markers.push(
        { id: 1, angle: baseAngle, color: hslToHex(baseAngle, 100, 50), isActive: activeMarkerId === 1 },
        { id: 2, angle: baseAngle, color: hslToHex(baseAngle, 100, 30), isActive: activeMarkerId === 2 },
        { id: 3, angle: baseAngle, color: hslToHex(baseAngle, 100, 70), isActive: activeMarkerId === 3 },
        { id: 4, angle: baseAngle, color: hslToHex(baseAngle, 60, 50), isActive: activeMarkerId === 4 }
      );
      break;
      
    default:
      markers.push({ id: 1, angle: baseAngle, color: hslToHex(baseAngle, 100, 50), isActive: true });
      break;
  }
  
  return markers;
};

/**
 * Update marker positions when one marker is moved
 * @param {array} currentMarkers - Current marker array
 * @param {number} activeMarkerId - ID of the moved marker
 * @param {number} newAngle - New angle for the active marker
 * @param {string} scheme - Color scheme type
 * @returns {array} Updated marker array
 */
export const updateMarkerPositions = (currentMarkers, activeMarkerId, newAngle, scheme) => {
  if (scheme === 'freestyle') {
    // In freestyle mode, only update the active marker
    return currentMarkers.map(marker => 
      marker.id === activeMarkerId 
        ? { ...marker, angle: newAngle, color: hslToHex(newAngle, 100, 50) }
        : marker
    );
  }
  
  // For harmony-based schemes, recalculate all positions based on the active marker
  const activeMarker = currentMarkers.find(m => m.id === activeMarkerId);
  if (!activeMarker) return currentMarkers;
  
  // Calculate the base angle (always from marker 1's perspective)
  let baseAngle = newAngle;
  
  if (activeMarkerId !== 1) {
    // Calculate what the base angle should be based on the moved marker
    switch (scheme) {
      case 'complementary':
        baseAngle = activeMarkerId === 2 ? normalizeAngle(newAngle - 180) : newAngle;
        break;
      case 'analogous':
        if (activeMarkerId === 2) baseAngle = normalizeAngle(newAngle - 30);
        else if (activeMarkerId === 3) baseAngle = normalizeAngle(newAngle + 30);
        break;
      case 'triadic':
        if (activeMarkerId === 2) baseAngle = normalizeAngle(newAngle - 120);
        else if (activeMarkerId === 3) baseAngle = normalizeAngle(newAngle - 240);
        break;
      case 'tetradic':
        if (activeMarkerId === 2) baseAngle = normalizeAngle(newAngle - 90);
        else if (activeMarkerId === 3) baseAngle = normalizeAngle(newAngle - 180);
        else if (activeMarkerId === 4) baseAngle = normalizeAngle(newAngle - 270);
        break;
    }
  }
  
  return calculateMarkerPositions(scheme, baseAngle, activeMarkerId);
};

/**
 * Check if a point is within the color wheel ring
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @param {number} outerRadius - Outer radius of the ring
 * @param {number} innerRadius - Inner radius of the ring
 * @returns {boolean} True if point is within the ring
 */
export const isPointInColorWheelRing = (x, y, centerX, centerY, outerRadius, innerRadius) => {
  const distance = calculateDistance(x, y, centerX, centerY);
  return distance >= innerRadius && distance <= outerRadius;
};

/**
 * Generate SVG path for color wheel gradient
 * @param {number} radius - Wheel radius
 * @param {number} strokeWidth - Width of the color ring
 * @returns {string} SVG path string
 */
export const generateColorWheelPath = (radius, strokeWidth) => {
  const outerRadius = radius;
  const innerRadius = radius - strokeWidth;
  
  return `
    M ${outerRadius} 0
    A ${outerRadius} ${outerRadius} 0 1 1 ${outerRadius - 0.01} 0
    L ${innerRadius - 0.01} 0
    A ${innerRadius} ${innerRadius} 0 1 0 ${innerRadius} 0
    Z
  `;
};

/**
 * Validate hex color format
 * @param {string} hex - Hex color string
 * @returns {boolean} True if valid hex color
 */
export const isValidHexColor = (hex) => {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
};

/**
 * Get contrasting text color (black or white) for a given background color
 * @param {string} hexColor - Background hex color
 * @returns {string} '#000000' or '#FFFFFF'
 */
export const getContrastingTextColor = (hexColor) => {
  const { h, s, l } = hexToHsl(hexColor);
  return l > 50 ? '#000000' : '#FFFFFF';
};

/**
 * Blend two colors together
 * @param {string} color1 - First hex color
 * @param {string} color2 - Second hex color
 * @param {number} ratio - Blend ratio (0-1, 0 = all color1, 1 = all color2)
 * @returns {string} Blended hex color
 */
export const blendColors = (color1, color2, ratio) => {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);
  
  const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
  const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
  const b = Math.round(b1 * (1 - ratio) + b2 * ratio);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};
