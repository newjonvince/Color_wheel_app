// utils/colorPerformanceTest.js - Simple performance testing (SYNTAX FIXED)
// Basic performance comparison functions

import * as OriginalColor from './color';

/**
 * Generate test color palette
 */
function generateTestPalette(size = 10) {
  const colors = [];
  for (let i = 0; i < size; i++) {
    const hue = (i * 360) / size;
    const saturation = 50 + Math.random() * 50;
    const lightness = 30 + Math.random() * 40;
    colors.push(OriginalColor.hslToHex(hue, saturation, lightness));
  }
  return colors;
}

/**
 * Simple performance test class (SYNTAX FIXED)
 */
export class ColorPerformanceTest {
  constructor() {
    this.results = {};
  }

  /**
   * Basic test function - no complex wrappers
   */
  testBasicPerformance() {
    if (!__DEV__) {
      console.warn('Performance tests only available in development');
      return { blocked: true };
    }

    console.log('Running basic performance test...');
    const testColor = '#FF6B35';
    
    // Simple timing test
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      // Basic color operation
      const rgb = OriginalColor.hexToRgb(testColor);
      const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    }
    const end = performance.now();
    
    const result = {
      iterations: 100,
      time: `${(end - start).toFixed(2)}ms`,
      avgTime: `${((end - start) / 100).toFixed(3)}ms per operation`
    };
    
    console.log('Test completed:', result);
    return result;
  }
}

/**
 * Simple performance test function
 */
export function quickPerformanceTest() {
  if (!__DEV__) {
    return { blocked: true, reason: 'Performance tests disabled in production' };
  }
  
  const tester = new ColorPerformanceTest();
  return tester.testBasicPerformance();
}

export default ColorPerformanceTest;
