// utils/colorTesting.js - Color system testing utilities
import { 
  validateHexColor, 
  normalizeHexColor, 
  hexToRgb, 
  hexToHsl, 
  hslToHex,
  generateColorScheme,
  getContrastRatio,
  COLOR_SCHEMES
} from './colorUtils';
import { validateSingleColor, validateColorPalette } from './colorValidation';

/**
 * Test suite for color utilities
 */
export const runColorTests = () => {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  const test = (name, testFn) => {
    try {
      const result = testFn();
      if (result) {
        results.passed++;
        results.tests.push({ name, status: 'PASS', error: null });
      } else {
        results.failed++;
        results.tests.push({ name, status: 'FAIL', error: 'Test returned false' });
      }
    } catch (error) {
      results.failed++;
      results.tests.push({ name, status: 'FAIL', error: error.message });
    }
  };
  
  // Color validation tests
  test('Validate valid hex colors', () => {
    return validateHexColor('#FF0000') &&
           validateHexColor('#f00') &&
           validateHexColor('FF0000') &&
           validateHexColor('f00');
  });
  
  test('Reject invalid hex colors', () => {
    return !validateHexColor('') &&
           !validateHexColor(null) &&
           !validateHexColor('#GG0000') &&
           !validateHexColor('#FF00');
  });
  
  // Color normalization tests
  test('Normalize hex colors correctly', () => {
    return normalizeHexColor('#f00') === '#FF0000' &&
           normalizeHexColor('f00') === '#FF0000' &&
           normalizeHexColor('#FF0000') === '#FF0000';
  });
  
  // Color conversion tests
  test('Hex to RGB conversion', () => {
    const rgb = hexToRgb('#FF0000');
    return rgb.r === 255 && rgb.g === 0 && rgb.b === 0;
  });
  
  test('Hex to HSL conversion', () => {
    const hsl = hexToHsl('#FF0000');
    return hsl.h === 0 && hsl.s === 100 && hsl.l === 50;
  });
  
  test('HSL to Hex conversion', () => {
    return hslToHex(0, 100, 50) === '#FF0000';
  });
  
  // Color scheme generation tests
  test('Generate complementary scheme', () => {
    const scheme = generateColorScheme('#FF0000', COLOR_SCHEMES.COMPLEMENTARY);
    return scheme.length === 2 && scheme[0] === '#FF0000';
  });
  
  test('Generate triadic scheme', () => {
    const scheme = generateColorScheme('#FF0000', COLOR_SCHEMES.TRIADIC);
    return scheme.length === 3 && scheme[0] === '#FF0000';
  });
  
  // Contrast ratio tests
  test('Calculate contrast ratio', () => {
    const ratio = getContrastRatio('#000000', '#FFFFFF');
    return Math.abs(ratio - 21) < 0.1; // Should be 21:1
  });
  
  // Validation tests
  test('Single color validation', () => {
    const validation = validateSingleColor('#FF0000');
    return validation.isValid && !validation.hasErrors;
  });
  
  test('Color palette validation', () => {
    const validation = validateColorPalette(['#FF0000', '#00FF00', '#0000FF']);
    return validation.isValid;
  });
  
  return results;
};

/**
 * Performance benchmarks for color operations
 */
export const runColorBenchmarks = () => {
  const benchmarks = {};
  
  const benchmark = (name, fn, iterations = 1000) => {
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    
    const end = performance.now();
    const totalTime = end - start;
    const avgTime = totalTime / iterations;
    
    benchmarks[name] = {
      totalTime: Math.round(totalTime * 100) / 100,
      avgTime: Math.round(avgTime * 1000) / 1000,
      iterations
    };
  };
  
  // Benchmark color conversions
  benchmark('Hex to RGB', () => hexToRgb('#FF0000'));
  benchmark('Hex to HSL', () => hexToHsl('#FF0000'));
  benchmark('HSL to Hex', () => hslToHex(0, 100, 50));
  
  // Benchmark color validation
  benchmark('Validate hex color', () => validateHexColor('#FF0000'));
  benchmark('Normalize hex color', () => normalizeHexColor('#f00'));
  
  // Benchmark color scheme generation
  benchmark('Generate complementary', () => generateColorScheme('#FF0000', COLOR_SCHEMES.COMPLEMENTARY));
  benchmark('Generate triadic', () => generateColorScheme('#FF0000', COLOR_SCHEMES.TRIADIC));
  
  // Benchmark contrast calculation
  benchmark('Calculate contrast', () => getContrastRatio('#000000', '#FFFFFF'));
  
  return benchmarks;
};

/**
 * Color accessibility test suite
 */
export const runAccessibilityTests = () => {
  const testCases = [
    // High contrast pairs
    { fg: '#000000', bg: '#FFFFFF', expected: 'AAA' },
    { fg: '#FFFFFF', bg: '#000000', expected: 'AAA' },
    
    // Medium contrast pairs
    { fg: '#767676', bg: '#FFFFFF', expected: 'AA' },
    { fg: '#FFFFFF', bg: '#767676', expected: 'AA' },
    
    // Low contrast pairs
    { fg: '#CCCCCC', bg: '#FFFFFF', expected: 'FAIL' },
    { fg: '#FFFFFF', bg: '#CCCCCC', expected: 'FAIL' },
    
    // Color combinations
    { fg: '#0066CC', bg: '#FFFFFF', expected: 'AA' },
    { fg: '#FF0000', bg: '#FFFFFF', expected: 'AA' },
    { fg: '#00AA00', bg: '#FFFFFF', expected: 'AA' }
  ];
  
  const results = testCases.map(testCase => {
    const ratio = getContrastRatio(testCase.fg, testCase.bg);
    
    let actualLevel = 'FAIL';
    if (ratio >= 7) {
      actualLevel = 'AAA';
    } else if (ratio >= 4.5) {
      actualLevel = 'AA';
    } else if (ratio >= 3) {
      actualLevel = 'AA_LARGE';
    }
    
    return {
      ...testCase,
      ratio: Math.round(ratio * 100) / 100,
      actualLevel,
      passed: actualLevel === testCase.expected || 
              (testCase.expected === 'AA' && actualLevel === 'AAA')
    };
  });
  
  return {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results
  };
};

/**
 * Color harmony analysis
 */
export const analyzeColorHarmony = (colors) => {
  if (!Array.isArray(colors) || colors.length < 2) {
    return { error: 'Need at least 2 colors for harmony analysis' };
  }
  
  const hslColors = colors.map(color => hexToHsl(color));
  const analysis = {
    colors: colors.length,
    hueRange: 0,
    saturationRange: 0,
    lightnessRange: 0,
    averageHue: 0,
    averageSaturation: 0,
    averageLightness: 0,
    harmonyScore: 0,
    recommendations: []
  };
  
  // Calculate ranges and averages
  const hues = hslColors.map(hsl => hsl.h);
  const saturations = hslColors.map(hsl => hsl.s);
  const lightnesses = hslColors.map(hsl => hsl.l);
  
  analysis.hueRange = Math.max(...hues) - Math.min(...hues);
  analysis.saturationRange = Math.max(...saturations) - Math.min(...saturations);
  analysis.lightnessRange = Math.max(...lightnesses) - Math.min(...lightnesses);
  
  analysis.averageHue = hues.reduce((a, b) => a + b, 0) / hues.length;
  analysis.averageSaturation = saturations.reduce((a, b) => a + b, 0) / saturations.length;
  analysis.averageLightness = lightnesses.reduce((a, b) => a + b, 0) / lightnesses.length;
  
  // Calculate harmony score (0-100)
  let score = 100;
  
  // Penalize extreme ranges
  if (analysis.saturationRange > 70) score -= 20;
  if (analysis.lightnessRange > 80) score -= 20;
  
  // Reward balanced distributions
  if (analysis.saturationRange > 20 && analysis.saturationRange < 50) score += 10;
  if (analysis.lightnessRange > 30 && analysis.lightnessRange < 60) score += 10;
  
  // Check for muddy colors
  const muddyColors = hslColors.filter(hsl => 
    hsl.s < 30 && hsl.l > 30 && hsl.l < 70
  ).length;
  
  if (muddyColors > colors.length / 2) {
    score -= 15;
    analysis.recommendations.push('Reduce muddy middle tones');
  }
  
  analysis.harmonyScore = Math.max(0, Math.min(100, score));
  
  // Generate recommendations
  if (analysis.saturationRange > 70) {
    analysis.recommendations.push('Consider reducing saturation range for better harmony');
  }
  
  if (analysis.lightnessRange > 80) {
    analysis.recommendations.push('Consider moderating lightness differences');
  }
  
  if (analysis.averageSaturation < 20) {
    analysis.recommendations.push('Add more vibrant colors for visual interest');
  }
  
  return analysis;
};

/**
 * Generate test color palettes
 */
export const generateTestPalettes = () => {
  return {
    // High contrast palette
    highContrast: ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF'],
    
    // Monochromatic palette
    monochromatic: ['#330066', '#4D0099', '#6600CC', '#8000FF', '#9933FF'],
    
    // Analogous palette
    analogous: ['#FF0000', '#FF8000', '#FFFF00', '#80FF00', '#00FF00'],
    
    // Complementary palette
    complementary: ['#FF0000', '#00FFFF', '#FF8080', '#80FFFF'],
    
    // Triadic palette
    triadic: ['#FF0000', '#00FF00', '#0000FF'],
    
    // Pastel palette
    pastel: ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF'],
    
    // Earth tones
    earthTones: ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#F4A460'],
    
    // Fashion neutrals
    fashionNeutrals: ['#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF'],
    
    // Problematic palette (for testing validation)
    problematic: ['#808080', '#7F7F7F', '#818181', '#7E7E7E'] // Very similar grays
  };
};

/**
 * Comprehensive color system health check
 */
export const runHealthCheck = () => {
  console.log('🎨 Running Color System Health Check...');
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: {},
    benchmarks: {},
    accessibility: {},
    overall: 'UNKNOWN'
  };
  
  try {
    // Run unit tests
    console.log('Running unit tests...');
    results.tests = runColorTests();
    
    // Run benchmarks
    console.log('Running performance benchmarks...');
    results.benchmarks = runColorBenchmarks();
    
    // Run accessibility tests
    console.log('Running accessibility tests...');
    results.accessibility = runAccessibilityTests();
    
    // Determine overall health
    const testsPassed = results.tests.passed / (results.tests.passed + results.tests.failed);
    const accessibilityPassed = results.accessibility.passed / results.accessibility.total;
    
    if (testsPassed >= 0.9 && accessibilityPassed >= 0.8) {
      results.overall = 'HEALTHY';
    } else if (testsPassed >= 0.7 && accessibilityPassed >= 0.6) {
      results.overall = 'WARNING';
    } else {
      results.overall = 'CRITICAL';
    }
    
    console.log(`✅ Health check complete. Status: ${results.overall}`);
    console.log(`📊 Tests: ${results.tests.passed}/${results.tests.passed + results.tests.failed} passed`);
    console.log(`♿ Accessibility: ${results.accessibility.passed}/${results.accessibility.total} passed`);
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    results.overall = 'ERROR';
    results.error = error.message;
  }
  
  return results;
};

export default {
  runColorTests,
  runColorBenchmarks,
  runAccessibilityTests,
  analyzeColorHarmony,
  generateTestPalettes,
  runHealthCheck
};
