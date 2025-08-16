// Test file to verify contrast calculation is working properly
import { contrastRatio } from './src/utils/color.js';

// Test the contrast calculation functions
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

// Test cases
console.log('Testing contrast calculations:');
console.log('hexToRgb("#FF6B6B"):', hexToRgb('#FF6B6B'));
console.log('getLuminance("#FF6B6B"):', getLuminance('#FF6B6B'));
console.log('getLuminance("#FFFFFF"):', getLuminance('#FFFFFF'));
console.log('getLuminance("#000000"):', getLuminance('#000000'));
console.log('Contrast ratio (red vs white):', calculateContrastRatio('#FF6B6B', '#FFFFFF'));
console.log('Contrast ratio (black vs white):', calculateContrastRatio('#000000', '#FFFFFF'));
console.log('Contrast ratio (red vs black):', calculateContrastRatio('#FF6B6B', '#000000'));
