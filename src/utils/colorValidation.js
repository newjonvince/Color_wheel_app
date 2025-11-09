// utils/colorValidation.js - Comprehensive color validation system
import { validateHexColor, normalizeHexColor, hexToHsl, getContrastRatio } from './colorUtils';

/**
 * Color validation rules and constraints
 */
export const COLOR_CONSTRAINTS = {
  HEX_PATTERN: /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/,
  MIN_LIGHTNESS: 5,
  MAX_LIGHTNESS: 95,
  MIN_SATURATION: 0,
  MAX_SATURATION: 100,
  MIN_HUE: 0,
  MAX_HUE: 359,
  MIN_CONTRAST_RATIO: 3.0,
  RECOMMENDED_CONTRAST_RATIO: 4.5,
  MAX_PALETTE_SIZE: 10,
  MIN_PALETTE_SIZE: 2
};

/**
 * Validation result structure
 */
export const createValidationResult = (isValid, errors = [], warnings = [], suggestions = []) => ({
  isValid,
  errors,
  warnings,
  suggestions,
  hasErrors: errors.length > 0,
  hasWarnings: warnings.length > 0,
  hasSuggestions: suggestions.length > 0
});

/**
 * Single color validation
 */
export const validateSingleColor = (color, options = {}) => {
  const errors = [];
  const warnings = [];
  const suggestions = [];
  
  // Basic format validation
  if (!color || typeof color !== 'string') {
    errors.push('Color must be a valid string');
    return createValidationResult(false, errors, warnings, suggestions);
  }
  
  // Hex format validation
  if (!validateHexColor(color)) {
    errors.push('Color must be a valid hex color (e.g., #FF0000 or #F00)');
    return createValidationResult(false, errors, warnings, suggestions);
  }
  
  const normalizedColor = normalizeHexColor(color);
  const { h, s, l } = hexToHsl(normalizedColor);
  
  // HSL range validation
  if (h < COLOR_CONSTRAINTS.MIN_HUE || h > COLOR_CONSTRAINTS.MAX_HUE) {
    errors.push(`Hue must be between ${COLOR_CONSTRAINTS.MIN_HUE} and ${COLOR_CONSTRAINTS.MAX_HUE}`);
  }
  
  if (s < COLOR_CONSTRAINTS.MIN_SATURATION || s > COLOR_CONSTRAINTS.MAX_SATURATION) {
    errors.push(`Saturation must be between ${COLOR_CONSTRAINTS.MIN_SATURATION}% and ${COLOR_CONSTRAINTS.MAX_SATURATION}%`);
  }
  
  if (l < COLOR_CONSTRAINTS.MIN_LIGHTNESS || l > COLOR_CONSTRAINTS.MAX_LIGHTNESS) {
    errors.push(`Lightness must be between ${COLOR_CONSTRAINTS.MIN_LIGHTNESS}% and ${COLOR_CONSTRAINTS.MAX_LIGHTNESS}%`);
  }
  
  // Accessibility warnings
  if (options.checkAccessibility) {
    const backgroundColor = options.backgroundColor || '#FFFFFF';
    const contrastRatio = getContrastRatio(normalizedColor, backgroundColor);
    
    if (contrastRatio < COLOR_CONSTRAINTS.MIN_CONTRAST_RATIO) {
      warnings.push(`Low contrast ratio (${contrastRatio.toFixed(2)}). Consider a darker or lighter shade.`);
    }
    
    if (contrastRatio < COLOR_CONSTRAINTS.RECOMMENDED_CONTRAST_RATIO) {
      suggestions.push('For better accessibility, aim for a contrast ratio of 4.5 or higher');
    }
  }
  
  // Fashion-specific warnings
  if (options.fashionContext) {
    if (s < 10 && l > 20 && l < 80) {
      warnings.push('Very low saturation colors may appear dull in fashion contexts');
    }
    
    if (l < 15) {
      warnings.push('Very dark colors may not show details well in fashion photography');
    }
    
    if (l > 90) {
      warnings.push('Very light colors may appear washed out in certain lighting conditions');
    }
  }
  
  return createValidationResult(errors.length === 0, errors, warnings, suggestions);
};

/**
 * Color palette validation
 */
export const validateColorPalette = (colors, options = {}) => {
  const errors = [];
  const warnings = [];
  const suggestions = [];
  
  // Basic array validation
  if (!Array.isArray(colors)) {
    errors.push('Color palette must be an array');
    return createValidationResult(false, errors, warnings, suggestions);
  }
  
  // Size validation
  if (colors.length < COLOR_CONSTRAINTS.MIN_PALETTE_SIZE) {
    errors.push(`Palette must contain at least ${COLOR_CONSTRAINTS.MIN_PALETTE_SIZE} colors`);
  }
  
  if (colors.length > COLOR_CONSTRAINTS.MAX_PALETTE_SIZE) {
    warnings.push(`Large palettes (${colors.length} colors) may be overwhelming. Consider reducing to ${COLOR_CONSTRAINTS.MAX_PALETTE_SIZE} or fewer.`);
  }
  
  // Validate each color
  const colorValidations = colors.map((color, index) => {
    const validation = validateSingleColor(color, options);
    if (!validation.isValid) {
      errors.push(`Color ${index + 1}: ${validation.errors.join(', ')}`);
    }
    validation.warnings.forEach(warning => {
      warnings.push(`Color ${index + 1}: ${warning}`);
    });
    return validation;
  });
  
  // Check for duplicates
  const normalizedColors = colors.map(color => normalizeHexColor(color));
  const uniqueColors = [...new Set(normalizedColors)];
  
  if (uniqueColors.length < colors.length) {
    warnings.push('Palette contains duplicate colors');
    suggestions.push('Remove duplicate colors for a more diverse palette');
  }
  
  // Color harmony validation
  if (options.checkHarmony && uniqueColors.length >= 2) {
    const harmonyResult = validateColorHarmony(uniqueColors);
    warnings.push(...harmonyResult.warnings);
    suggestions.push(...harmonyResult.suggestions);
  }
  
  // Contrast validation within palette
  if (options.checkContrast && uniqueColors.length >= 2) {
    const contrastIssues = [];
    
    for (let i = 0; i < uniqueColors.length; i++) {
      for (let j = i + 1; j < uniqueColors.length; j++) {
        const ratio = getContrastRatio(uniqueColors[i], uniqueColors[j]);
        if (ratio < 2.0) {
          contrastIssues.push(`Colors ${i + 1} and ${j + 1} have very low contrast (${ratio.toFixed(2)})`);
        }
      }
    }
    
    if (contrastIssues.length > 0) {
      warnings.push(...contrastIssues);
      suggestions.push('Consider adjusting lightness values to improve contrast between colors');
    }
  }
  
  return createValidationResult(errors.length === 0, errors, warnings, suggestions);
};

/**
 * Color harmony validation
 */
export const validateColorHarmony = (colors) => {
  const warnings = [];
  const suggestions = [];
  
  if (colors.length < 2) {
    return { warnings, suggestions };
  }
  
  const hslColors = colors.map(color => hexToHsl(color));
  const hues = hslColors.map(hsl => hsl.h);
  const saturations = hslColors.map(hsl => hsl.s);
  const lightnesses = hslColors.map(hsl => hsl.l);
  
  // Check for extreme saturation differences
  const maxSaturation = Math.max(...saturations);
  const minSaturation = Math.min(...saturations);
  
  if (maxSaturation - minSaturation > 70) {
    warnings.push('Large saturation differences may create visual discord');
    suggestions.push('Try to keep saturation values within a 70% range for better harmony');
  }
  
  // Check for extreme lightness differences
  const maxLightness = Math.max(...lightnesses);
  const minLightness = Math.min(...lightnesses);
  
  if (maxLightness - minLightness > 80) {
    warnings.push('Extreme lightness differences may reduce readability');
    suggestions.push('Consider moderating the lightness range for better balance');
  }
  
  // Check for muddy middle tones
  const middleTones = lightnesses.filter(l => l > 30 && l < 70 && saturations[lightnesses.indexOf(l)] < 30);
  
  if (middleTones.length > colors.length / 2) {
    warnings.push('Too many muddy middle tones may create a dull palette');
    suggestions.push('Add some vibrant colors or adjust saturation for more visual interest');
  }
  
  return { warnings, suggestions };
};

/**
 * Color scheme validation
 */
export const validateColorScheme = (baseColor, scheme, generatedColors) => {
  const errors = [];
  const warnings = [];
  const suggestions = [];
  
  // Validate base color
  const baseValidation = validateSingleColor(baseColor);
  if (!baseValidation.isValid) {
    errors.push(`Base color invalid: ${baseValidation.errors.join(', ')}`);
    return createValidationResult(false, errors, warnings, suggestions);
  }
  
  // Validate scheme type
  const validSchemes = [
    'complementary', 'analogous', 'split-complementary', 
    'triadic', 'tetradic', 'monochromatic', 'compound'
  ];
  
  if (!validSchemes.includes(scheme)) {
    errors.push(`Invalid color scheme: ${scheme}. Must be one of: ${validSchemes.join(', ')}`);
  }
  
  // Validate generated colors
  if (generatedColors && generatedColors.length > 0) {
    const paletteValidation = validateColorPalette(generatedColors, {
      checkHarmony: true,
      fashionContext: true
    });
    
    warnings.push(...paletteValidation.warnings);
    suggestions.push(...paletteValidation.suggestions);
  }
  
  return createValidationResult(errors.length === 0, errors, warnings, suggestions);
};

/**
 * Batch color validation
 */
export const validateColorBatch = (colorData, options = {}) => {
  const results = [];
  const overallErrors = [];
  const overallWarnings = [];
  const overallSuggestions = [];
  
  if (!Array.isArray(colorData)) {
    return createValidationResult(false, ['Color data must be an array'], [], []);
  }
  
  colorData.forEach((item, index) => {
    let result;
    
    if (typeof item === 'string') {
      // Single color
      result = validateSingleColor(item, options);
    } else if (Array.isArray(item)) {
      // Color palette
      result = validateColorPalette(item, options);
    } else if (item && typeof item === 'object') {
      // Color scheme object
      if (item.baseColor && item.scheme && item.colors) {
        result = validateColorScheme(item.baseColor, item.scheme, item.colors);
      } else {
        result = createValidationResult(false, ['Invalid color object structure'], [], []);
      }
    } else {
      result = createValidationResult(false, ['Invalid color data type'], [], []);
    }
    
    results.push({ index, result });
    
    if (result.hasErrors) {
      overallErrors.push(`Item ${index + 1}: ${result.errors.join(', ')}`);
    }
    
    if (result.hasWarnings) {
      overallWarnings.push(`Item ${index + 1}: ${result.warnings.join(', ')}`);
    }
    
    if (result.hasSuggestions) {
      overallSuggestions.push(`Item ${index + 1}: ${result.suggestions.join(', ')}`);
    }
  });
  
  const isValid = results.every(r => r.result.isValid);
  
  return {
    ...createValidationResult(isValid, overallErrors, overallWarnings, overallSuggestions),
    results,
    summary: {
      total: colorData.length,
      valid: results.filter(r => r.result.isValid).length,
      invalid: results.filter(r => !r.result.isValid).length,
      withWarnings: results.filter(r => r.result.hasWarnings).length,
      withSuggestions: results.filter(r => r.result.hasSuggestions).length
    }
  };
};

/**
 * Color accessibility validator
 */
export const validateAccessibility = (foregroundColor, backgroundColor, options = {}) => {
  const { level = 'AA', fontSize = 'normal' } = options;
  const errors = [];
  const warnings = [];
  const suggestions = [];
  
  // Validate both colors
  const fgValidation = validateSingleColor(foregroundColor);
  const bgValidation = validateSingleColor(backgroundColor);
  
  if (!fgValidation.isValid) {
    errors.push(`Foreground color invalid: ${fgValidation.errors.join(', ')}`);
  }
  
  if (!bgValidation.isValid) {
    errors.push(`Background color invalid: ${bgValidation.errors.join(', ')}`);
  }
  
  if (errors.length > 0) {
    return createValidationResult(false, errors, warnings, suggestions);
  }
  
  // Calculate contrast ratio
  const contrastRatio = getContrastRatio(foregroundColor, backgroundColor);
  
  // Determine required ratio based on level and font size
  let requiredRatio;
  if (level === 'AAA') {
    requiredRatio = fontSize === 'large' ? 4.5 : 7;
  } else { // AA
    requiredRatio = fontSize === 'large' ? 3 : 4.5;
  }
  
  const isAccessible = contrastRatio >= requiredRatio;
  
  if (!isAccessible) {
    errors.push(`Insufficient contrast ratio: ${contrastRatio.toFixed(2)} (required: ${requiredRatio})`);
    suggestions.push('Try making the foreground darker or the background lighter');
    suggestions.push('Consider using a different color combination');
  } else if (contrastRatio < requiredRatio + 1) {
    warnings.push(`Contrast ratio is close to minimum: ${contrastRatio.toFixed(2)}`);
    suggestions.push('Consider increasing contrast for better readability');
  }
  
  return createValidationResult(isAccessible, errors, warnings, suggestions);
};

export default {
  COLOR_CONSTRAINTS,
  createValidationResult,
  validateSingleColor,
  validateColorPalette,
  validateColorHarmony,
  validateColorScheme,
  validateColorBatch,
  validateAccessibility
};
