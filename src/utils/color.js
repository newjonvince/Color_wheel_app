
// utils/color.js
// Color utility functions for the Fashion Color Wheel app

/**
 * Convert HSL to Hex
 */
export function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Convert Hex to HSL
 */
export function hexToHsl(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };

  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
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

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Get color scheme colors based on base color and scheme type
 */
export function getColorScheme(baseColor, scheme) {
  const { h, s, l } = hexToHsl(baseColor);
  
  switch (scheme) {
    case 'analogous':
      return [
        baseColor,
        hslToHex((h + 30) % 360, s, l),
        hslToHex((h - 30 + 360) % 360, s, l)
      ];
    
    case 'complementary':
      return [
        baseColor,
        hslToHex((h + 180) % 360, s, l)
      ];
    
    case 'split-complementary':
      return [
        baseColor,
        hslToHex((h + 150) % 360, s, l),
        hslToHex((h + 210) % 360, s, l)
      ];
    
    case 'triadic':
      return [
        baseColor,
        hslToHex((h + 120) % 360, s, l),
        hslToHex((h + 240) % 360, s, l)
      ];
    
    case 'tetradic':
      return [
        baseColor,
        hslToHex((h + 90) % 360, s, l),
        hslToHex((h + 180) % 360, s, l),
        hslToHex((h + 270) % 360, s, l)
      ];
    
    case 'monochromatic':
      return [
        hslToHex(h, s, Math.max(10, l - 30)),
        hslToHex(h, s, Math.max(10, l - 15)),
        baseColor,
        hslToHex(h, s, Math.min(90, l + 15)),
        hslToHex(h, s, Math.min(90, l + 30))
      ];
    
    case 'compound':
      return [
        baseColor,
        hslToHex((h + 150) % 360, s, l),
        hslToHex((h + 180) % 360, s, l),
        hslToHex((h + 210) % 360, s, l)
      ];
    
    case 'shades':
      return [
        hslToHex(h, s, Math.max(5, l - 40)),
        hslToHex(h, s, Math.max(10, l - 25)),
        baseColor,
        hslToHex(h, s, Math.max(15, l - 10)),
        hslToHex(h, s, Math.max(20, l - 5))
      ];
    
    case 'tints':
      return [
        hslToHex(h, s, Math.min(95, l + 40)),
        hslToHex(h, s, Math.min(90, l + 25)),
        baseColor,
        hslToHex(h, s, Math.min(85, l + 10)),
        hslToHex(h, s, Math.min(80, l + 5))
      ];
    
    default:
      return [baseColor];
  }
}

/**
 * Calculate contrast ratio between two colors
 */
export function contrastRatio(color1, color2) {
  const getLuminance = (hex) => {
    const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!rgb) return 0;
    
    const [r, g, b] = [
      parseInt(rgb[1], 16) / 255,
      parseInt(rgb[2], 16) / 255,
      parseInt(rgb[3], 16) / 255
    ].map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Convert Hex to RGB
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

/**
 * Find nearest accessible color with sufficient contrast
 */
export function nearestAccessible(background, target, minRatio = 4.5) {
  const ratio = contrastRatio(background, target);
  if (ratio >= minRatio) return target;
  
  // Simple fallback - return high contrast color
  const bgLum = contrastRatio(background, '#000000');
  return bgLum > 3 ? '#000000' : '#FFFFFF';
}
