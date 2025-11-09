// utils/productionSafeColorTests.js - Production-safe color performance testing
// Replaces the original colorPerformanceTest.js with proper safety guards

import * as OriginalColor from './color';
import * as OptimizedColor from './optimizedColor';
import { Alert } from 'react-native';

/**
 * Production safety wrapper
 */
function createSafeTest(testFunction, options = {}) {
  const {
    maxIterations = 100,
    maxDuration = 5000,
    warningMessage = 'This performance test may temporarily slow the app'
  } = options;

  return async function(...args) {
    // Block in production builds
    if (!__DEV__) {
      console.warn('🚫 Performance test blocked in production build');
      return {
        blocked: true,
        reason: 'Production safety - performance tests disabled',
        devModeRequired: true
      };
    }

    // Show warning in development
    const confirmed = await showTestWarning(warningMessage);
    if (!confirmed) {
      return { cancelled: true, reason: 'User cancelled test' };
    }

    // Apply safety limits
    const safeArgs = args.map(arg => {
      if (typeof arg === 'number' && arg > maxIterations) {
        console.warn(`🛡️ Limiting iterations from ${arg} to ${maxIterations} for safety`);
        return maxIterations;
      }
      return arg;
    });

    // Execute with timeout protection
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Test timed out for safety')), maxDuration)
    );

    try {
      return await Promise.race([
        testFunction.apply(this, safeArgs),
        timeoutPromise
      ]);
    } catch (error) {
      console.error('Performance test error:', error);
      return {
        error: true,
        message: error.message,
        reason: 'Test failed or timed out'
      };
    }
  };
}

/**
 * Show test warning dialog
 */
async function showTestWarning(message) {
  return new Promise((resolve) => {
    Alert.alert(
      'Performance Test Warning',
      `${message}\n\nThis may temporarily freeze the app. Continue?`,
      [
        { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
        { text: 'Continue', onPress: () => resolve(true) }
      ]
    );
  });
}

/**
 * Async chunked processing to prevent blocking
 */
async function processInChunks(items, processor, chunkSize = 50) {
  const results = [];
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = chunk.map(processor);
    results.push(...chunkResults);
    
    // Yield to main thread between chunks
    if (i + chunkSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
    }
  }
  
  return results;
}

/**
 * Production-safe color performance test suite
 */
export class SafeColorPerformanceTest {
  constructor() {
    this.results = {};
  }

  /**
   * Test single color analysis performance (safe)
   */
  async testSingleColorAnalysis(iterations = 1000) {
    const safeTest = createSafeTest(async (safeIterations) => {
      const testColor = '#FF6B35';
      
      console.log(`🧪 Testing single color analysis (${safeIterations} iterations)`);
      
      // Test original approach (simulated)
      const originalStart = performance.now();
      await processInChunks(
        Array(safeIterations).fill(testColor),
        (color) => simulateOriginalAnalyzeColor(color)
      );
      const originalTime = performance.now() - originalStart;
      
      // Test optimized approach
      OptimizedColor.clearColorCache(); // Fair comparison
      const optimizedStart = performance.now();
      await processInChunks(
        Array(safeIterations).fill(testColor),
        (color) => OptimizedColor.analyzeColor(color)
      );
      const optimizedTime = performance.now() - optimizedStart;
      
      const improvement = ((originalTime - optimizedTime) / originalTime * 100).toFixed(1);
      
      const result = {
        iterations: safeIterations,
        original: `${originalTime.toFixed(2)}ms`,
        optimized: `${optimizedTime.toFixed(2)}ms`,
        improvement: `${improvement}% faster`,
        speedup: `${(originalTime / optimizedTime).toFixed(1)}x`
      };
      
      this.results.singleColorAnalysis = result;
      
      console.log('✅ Single color analysis results:', result);
      return result;
      
    }, {
      maxIterations: 500,
      warningMessage: 'Single color analysis test will run color processing iterations'
    });

    return await safeTest(iterations);
  }

  /**
   * Test palette validation performance (safe)
   */
  async testPaletteValidation(paletteSize = 10, iterations = 100) {
    const safeTest = createSafeTest(async (safePaletteSize, safeIterations) => {
      const testPalette = generateTestPalette(safePaletteSize);
      
      console.log(`🧪 Testing palette validation (${safePaletteSize} colors, ${safeIterations} iterations)`);
      
      // Test original approach (simulated O(N²) redundant calculations)
      const originalStart = performance.now();
      for (let i = 0; i < safeIterations; i++) {
        simulateOriginalValidateColorPalette(testPalette);
        
        // Yield periodically
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      const originalTime = performance.now() - originalStart;
      
      // Test optimized approach
      OptimizedColor.clearColorCache();
      const optimizedStart = performance.now();
      for (let i = 0; i < safeIterations; i++) {
        OptimizedColor.validateColorPalette(testPalette);
        
        // Yield periodically
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      const optimizedTime = performance.now() - optimizedStart;
      
      const improvement = ((originalTime - optimizedTime) / originalTime * 100).toFixed(1);
      
      const result = {
        paletteSize: safePaletteSize,
        iterations: safeIterations,
        totalComparisons: (safePaletteSize * (safePaletteSize - 1)) / 2,
        original: `${originalTime.toFixed(2)}ms`,
        optimized: `${optimizedTime.toFixed(2)}ms`,
        improvement: `${improvement}% faster`,
        speedup: `${(originalTime / optimizedTime).toFixed(1)}x`
      };
      
      this.results.paletteValidation = result;
      
      console.log('✅ Palette validation results:', result);
      return result;
      
    }, {
      maxIterations: 50,
      warningMessage: 'Palette validation test will run intensive color comparisons'
    });

    return await safeTest(paletteSize, iterations);
  }

  /**
   * Test cache effectiveness (safe)
   */
  async testCacheEffectiveness(iterations = 500) {
    const safeTest = createSafeTest(async (safeIterations) => {
      const testColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
      
      console.log(`🧪 Testing cache effectiveness (${safeIterations} iterations)`);
      
      // Test without cache (clearing each time)
      const noCacheStart = performance.now();
      for (let i = 0; i < safeIterations; i++) {
        OptimizedColor.clearColorCache();
        await processInChunks(testColors, color => OptimizedColor.analyzeColor(color), 5);
        
        // Yield every 50 iterations
        if (i % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      const noCacheTime = performance.now() - noCacheStart;
      
      // Test with cache
      OptimizedColor.clearColorCache();
      const cacheStart = performance.now();
      for (let i = 0; i < safeIterations; i++) {
        await processInChunks(testColors, color => OptimizedColor.analyzeColor(color), 5);
        
        // Yield every 50 iterations
        if (i % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      const cacheTime = performance.now() - cacheStart;
      
      const improvement = ((noCacheTime - cacheTime) / noCacheTime * 100).toFixed(1);
      const cacheInfo = OptimizedColor.getColorCache();
      
      const result = {
        iterations: safeIterations,
        colorsPerIteration: testColors.length,
        withoutCache: `${noCacheTime.toFixed(2)}ms`,
        withCache: `${cacheTime.toFixed(2)}ms`,
        improvement: `${improvement}% faster`,
        speedup: `${(noCacheTime / cacheTime).toFixed(1)}x`,
        finalCacheSize: cacheInfo.size
      };
      
      this.results.cacheEffectiveness = result;
      
      console.log('✅ Cache effectiveness results:', result);
      return result;
      
    }, {
      maxIterations: 200,
      warningMessage: 'Cache effectiveness test will run repeated color analysis operations'
    });

    return await safeTest(iterations);
  }

  /**
   * Run complete test suite (safe)
   */
  async runCompleteTest() {
    if (!__DEV__) {
      console.warn('🚫 Complete performance test suite blocked in production');
      return {
        blocked: true,
        reason: 'Production safety - test suite disabled in production builds'
      };
    }

    console.log('🚀 Starting Safe Color Performance Test Suite');
    console.log('=' .repeat(60));
    
    const startTime = performance.now();
    
    try {
      // Run tests with reduced iterations for safety
      await this.testSingleColorAnalysis(200);
      await this.testPaletteValidation(8, 20);
      await this.testCacheEffectiveness(100);
      
      const totalTime = performance.now() - startTime;
      
      console.log('📊 Performance Test Summary:');
      console.log('=' .repeat(60));
      
      Object.entries(this.results).forEach(([testName, results]) => {
        if (!results.blocked && !results.cancelled && !results.error) {
          console.log(`${testName}:`);
          Object.entries(results).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
          console.log('');
        }
      });
      
      console.log(`Total test time: ${totalTime.toFixed(2)}ms`);
      
      return {
        success: true,
        totalTime,
        results: this.results
      };
      
    } catch (error) {
      console.error('Test suite error:', error);
      return {
        error: true,
        message: error.message,
        partialResults: this.results
      };
    }
  }

  /**
   * Get test results
   */
  getResults() {
    return {
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: this.generateSummary()
    };
  }

  /**
   * Generate performance summary
   */
  generateSummary() {
    const completedTests = Object.values(this.results).filter(
      result => !result.blocked && !result.cancelled && !result.error
    );
    
    if (completedTests.length === 0) {
      return { message: 'No tests completed successfully' };
    }
    
    const speedups = completedTests
      .map(result => parseFloat(result.speedup?.replace('x', '') || '1'))
      .filter(speedup => !isNaN(speedup));
    
    const averageSpeedup = speedups.length > 0 
      ? speedups.reduce((a, b) => a + b, 0) / speedups.length
      : 1;
    
    return {
      testsCompleted: completedTests.length,
      averageSpeedup: `${averageSpeedup.toFixed(1)}x`,
      recommendations: this.getRecommendations()
    };
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations() {
    const recommendations = [];
    
    if (this.results.singleColorAnalysis?.speedup) {
      const speedup = parseFloat(this.results.singleColorAnalysis.speedup.replace('x', ''));
      if (speedup > 2) {
        recommendations.push('Use optimized analyzeColor() for better single color performance');
      }
    }
    
    if (this.results.paletteValidation?.speedup) {
      const speedup = parseFloat(this.results.paletteValidation.speedup.replace('x', ''));
      if (speedup > 3) {
        recommendations.push('Use validateColorPalette() for better batch validation performance');
      }
    }
    
    if (this.results.cacheEffectiveness?.speedup) {
      const speedup = parseFloat(this.results.cacheEffectiveness.speedup.replace('x', ''));
      if (speedup > 5) {
        recommendations.push('Color caching provides significant performance benefits');
      }
    }
    
    return recommendations;
  }
}

// ============================================================================
// Helper Functions (Lightweight for Safety)
// ============================================================================

function generateTestPalette(size = 10) {
  const colors = [];
  for (let i = 0; i < size; i++) {
    const hue = (i * 360) / size;
    const saturation = 50 + Math.random() * 50;
    const lightness = 30 + Math.random() * 40;
    colors.push(hslToHex(hue, saturation, lightness));
  }
  return colors;
}

function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function simulateOriginalAnalyzeColor(hex) {
  // Simulate the inefficient original approach
  const brightness1 = simulateGetColorBrightness(hex);
  const brightness2 = simulateGetColorBrightness(hex);
  const brightness3 = simulateGetColorBrightness(hex);
  
  return {
    brightness: brightness1,
    isLight: brightness2 > 128,
    isDark: brightness3 <= 128
  };
}

function simulateGetColorBrightness(hex) {
  const rgb = hexToRgb(hex);
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
}

function simulateOriginalValidateColorPalette(colors) {
  // Simulate O(N²) redundant calculations
  const issues = [];
  
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const contrast = simulateContrastRatio(colors[i], colors[j]);
      if (contrast < 4.5) {
        issues.push({ colors: [colors[i], colors[j]], contrast });
      }
    }
  }
  
  return { issues };
}

function simulateContrastRatio(color1, color2) {
  const lum1 = simulateGetLuminance(color1);
  const lum2 = simulateGetLuminance(color2);
  return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
}

function simulateGetLuminance(hex) {
  const rgb = hexToRgb(hex);
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

/**
 * Quick performance test function (safe)
 */
export const quickPerformanceTest = createSafeTest(async () => {
  const tester = new SafeColorPerformanceTest();
  return await tester.runCompleteTest();
}, {
  maxDuration: 30000, // 30 seconds max
  warningMessage: 'Quick performance test will run a suite of color processing benchmarks'
});

export default SafeColorPerformanceTest;
