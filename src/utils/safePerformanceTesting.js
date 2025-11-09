// utils/safePerformanceTesting.js - Production-safe performance testing
// Guards expensive operations behind dev checks and provides async alternatives

import { Alert } from 'react-native';

/**
 * Production safety configuration
 */
const SAFETY_CONFIG = {
  // Maximum iterations allowed in production (if accidentally enabled)
  MAX_PROD_ITERATIONS: 10,
  // Maximum test duration in production (milliseconds)
  MAX_PROD_DURATION: 100,
  // Chunk size for async processing
  ASYNC_CHUNK_SIZE: 50,
  // Delay between chunks (milliseconds)
  ASYNC_CHUNK_DELAY: 16, // ~60fps
};

/**
 * Development-only guard decorator
 */
function devOnly(fn, fallbackMessage = 'Performance testing is only available in development mode') {
  return function(...args) {
    if (!__DEV__) {
      console.warn('🚫 Performance Test Blocked:', fallbackMessage);
      return Promise.resolve({
        blocked: true,
        reason: 'Production build - performance testing disabled',
        message: fallbackMessage
      });
    }
    return fn.apply(this, args);
  };
}

/**
 * Production-safe wrapper for expensive operations
 */
function productionSafe(fn, options = {}) {
  const {
    maxIterations = SAFETY_CONFIG.MAX_PROD_ITERATIONS,
    maxDuration = SAFETY_CONFIG.MAX_PROD_DURATION,
    warningMessage = 'This operation may impact performance',
    requireConfirmation = true
  } = options;

  return async function(...args) {
    // Always block in production unless explicitly overridden
    if (!__DEV__ && !options.allowInProduction) {
      console.warn('🚫 Expensive operation blocked in production');
      return {
        blocked: true,
        reason: 'Production safety - expensive operation disabled'
      };
    }

    // In development, show warning for expensive operations
    if (__DEV__ && requireConfirmation) {
      const confirmed = await showPerformanceWarning(warningMessage);
      if (!confirmed) {
        return { cancelled: true, reason: 'User cancelled operation' };
      }
    }

    // Apply safety limits even in development
    const safeArgs = args.map(arg => {
      if (typeof arg === 'number' && arg > maxIterations) {
        console.warn(`🛡️ Limiting iterations from ${arg} to ${maxIterations} for safety`);
        return maxIterations;
      }
      return arg;
    });

    // Execute with timeout protection
    return Promise.race([
      fn.apply(this, safeArgs),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out for safety')), maxDuration * 10)
      )
    ]);
  };
}

/**
 * Show performance warning dialog
 */
async function showPerformanceWarning(message) {
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
 * Async chunked processing for expensive operations
 */
async function processInChunks(items, processor, options = {}) {
  const {
    chunkSize = SAFETY_CONFIG.ASYNC_CHUNK_SIZE,
    delay = SAFETY_CONFIG.ASYNC_CHUNK_DELAY,
    onProgress = null,
    onChunkComplete = null
  } = options;

  const results = [];
  const totalChunks = Math.ceil(items.length / chunkSize);

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkIndex = Math.floor(i / chunkSize);
    
    // Process chunk synchronously
    const chunkResults = chunk.map(processor);
    results.push(...chunkResults);
    
    // Report progress
    if (onProgress) {
      onProgress({
        completed: chunkIndex + 1,
        total: totalChunks,
        percentage: Math.round(((chunkIndex + 1) / totalChunks) * 100),
        processedItems: results.length,
        totalItems: items.length
      });
    }
    
    if (onChunkComplete) {
      onChunkComplete(chunkResults, chunkIndex);
    }
    
    // Yield to main thread between chunks
    if (i + chunkSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return results;
}

/**
 * Safe color benchmark runner
 */
export const runSafeColorBenchmarks = devOnly(
  productionSafe(
    async function(iterations = 1000, options = {}) {
      const {
        includeAsync = true,
        onProgress = null,
        testFunctions = []
      } = options;

      console.log(`🧪 Starting safe color benchmarks (${iterations} iterations)`);
      
      const results = {
        timestamp: new Date().toISOString(),
        iterations,
        tests: {},
        performance: {
          totalTime: 0,
          averageTimePerTest: 0,
          memoryUsage: getMemoryUsage()
        }
      };

      const startTime = performance.now();

      // Test 1: Single color analysis (chunked)
      if (includeAsync) {
        console.log('📊 Testing single color analysis (async)...');
        const testColors = generateTestColors(Math.min(iterations, 100));
        
        const analysisResults = await processInChunks(
          testColors,
          (color) => {
            const start = performance.now();
            // Simulate color analysis
            analyzeColorSafe(color);
            return performance.now() - start;
          },
          {
            onProgress: (progress) => {
              if (onProgress) {
                onProgress({
                  test: 'Single Color Analysis',
                  ...progress
                });
              }
            }
          }
        );

        results.tests.singleColorAnalysis = {
          totalTime: analysisResults.reduce((sum, time) => sum + time, 0),
          averageTime: analysisResults.reduce((sum, time) => sum + time, 0) / analysisResults.length,
          iterations: analysisResults.length,
          async: true
        };
      }

      // Test 2: Palette operations (limited iterations)
      console.log('📊 Testing palette operations (limited)...');
      const paletteIterations = Math.min(iterations / 10, 50);
      const paletteStart = performance.now();
      
      for (let i = 0; i < paletteIterations; i++) {
        const testPalette = generateTestColors(5);
        analyzePaletteSafe(testPalette);
        
        // Yield periodically
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      
      const paletteTime = performance.now() - paletteStart;
      results.tests.paletteOperations = {
        totalTime: paletteTime,
        averageTime: paletteTime / paletteIterations,
        iterations: paletteIterations,
        async: false
      };

      const totalTime = performance.now() - startTime;
      results.performance.totalTime = totalTime;
      results.performance.averageTimePerTest = totalTime / Object.keys(results.tests).length;
      results.performance.finalMemoryUsage = getMemoryUsage();

      console.log('✅ Safe benchmarks completed:', results);
      return results;
    },
    {
      maxIterations: 100,
      warningMessage: 'Color benchmarks will run performance tests that may temporarily slow the app'
    }
  )
);

/**
 * Safe color wheel performance test
 */
export const testColorWheelPerformanceSafe = devOnly(
  productionSafe(
    async function(duration = 5000, eventsPerSecond = 20, options = {}) {
      const {
        onProgress = null,
        onGestureSimulated = null,
        includeValidation = false
      } = options;

      console.log(`🎯 Starting safe color wheel test (${duration}ms, ${eventsPerSecond} events/sec)`);
      
      const results = {
        timestamp: new Date().toISOString(),
        duration,
        eventsPerSecond,
        totalEvents: 0,
        performance: {
          averageEventTime: 0,
          maxEventTime: 0,
          minEventTime: Infinity,
          memoryStart: getMemoryUsage(),
          memoryEnd: 0
        },
        events: []
      };

      const startTime = performance.now();
      const eventInterval = 1000 / eventsPerSecond;
      const totalEvents = Math.floor(duration / eventInterval);
      
      let eventCount = 0;
      const eventTimes = [];

      // Process events in chunks to prevent blocking
      const eventsPerChunk = Math.min(eventsPerSecond, 20); // Max 20 events per chunk
      const chunkDuration = eventsPerChunk * eventInterval;

      while (eventCount < totalEvents && (performance.now() - startTime) < duration) {
        const chunkStart = performance.now();
        
        // Process a chunk of events
        for (let i = 0; i < eventsPerChunk && eventCount < totalEvents; i++) {
          const eventStart = performance.now();
          
          // Simulate gesture event
          const gestureData = simulateGestureEvent(eventCount, totalEvents);
          
          if (onGestureSimulated) {
            onGestureSimulated(gestureData, eventCount);
          }
          
          // Optional palette validation (expensive)
          if (includeValidation && eventCount % 10 === 0) {
            analyzePaletteSafe(gestureData.colors);
          }
          
          const eventTime = performance.now() - eventStart;
          eventTimes.push(eventTime);
          
          results.performance.maxEventTime = Math.max(results.performance.maxEventTime, eventTime);
          results.performance.minEventTime = Math.min(results.performance.minEventTime, eventTime);
          
          eventCount++;
        }
        
        // Report progress
        if (onProgress) {
          onProgress({
            completed: eventCount,
            total: totalEvents,
            percentage: Math.round((eventCount / totalEvents) * 100),
            elapsedTime: performance.now() - startTime,
            estimatedRemaining: ((totalEvents - eventCount) / eventsPerSecond) * 1000
          });
        }
        
        // Yield to main thread between chunks
        const chunkTime = performance.now() - chunkStart;
        const remainingChunkTime = chunkDuration - chunkTime;
        
        if (remainingChunkTime > 0) {
          await new Promise(resolve => setTimeout(resolve, Math.max(1, remainingChunkTime)));
        }
      }

      results.totalEvents = eventCount;
      results.performance.averageEventTime = eventTimes.reduce((sum, time) => sum + time, 0) / eventTimes.length;
      results.performance.memoryEnd = getMemoryUsage();
      results.performance.totalTime = performance.now() - startTime;

      console.log('✅ Safe color wheel test completed:', results);
      return results;
    },
    {
      maxDuration: 10000, // Max 10 seconds
      warningMessage: 'Color wheel performance test will simulate intensive gesture events'
    }
  )
);

/**
 * Safe memory profiler
 */
export const profileMemoryUsageSafe = devOnly(
  async function(testFunction, options = {}) {
    const {
      iterations = 100,
      measureInterval = 100,
      onMeasurement = null
    } = options;

    console.log('📊 Starting safe memory profiling...');
    
    const measurements = [];
    const startMemory = getMemoryUsage();
    let measurementCount = 0;

    // Take initial measurement
    measurements.push({
      iteration: 0,
      memory: startMemory,
      timestamp: performance.now()
    });

    // Run test function with periodic memory measurements
    for (let i = 0; i < iterations; i++) {
      await testFunction(i);
      
      // Take memory measurement at intervals
      if (i % measureInterval === 0) {
        const currentMemory = getMemoryUsage();
        const measurement = {
          iteration: i,
          memory: currentMemory,
          memoryDelta: currentMemory - startMemory,
          timestamp: performance.now()
        };
        
        measurements.push(measurement);
        measurementCount++;
        
        if (onMeasurement) {
          onMeasurement(measurement, measurementCount);
        }
      }
      
      // Yield periodically
      if (i % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    const finalMemory = getMemoryUsage();
    const results = {
      startMemory,
      finalMemory,
      memoryDelta: finalMemory - startMemory,
      measurements,
      iterations,
      averageMemoryPerIteration: (finalMemory - startMemory) / iterations
    };

    console.log('✅ Memory profiling completed:', results);
    return results;
  }
);

/**
 * Background performance monitor (non-blocking)
 */
export class BackgroundPerformanceMonitor {
  constructor(options = {}) {
    this.options = {
      measureInterval: 1000, // 1 second
      maxMeasurements: 100,
      autoStart: false,
      ...options
    };
    
    this.measurements = [];
    this.isRunning = false;
    this.intervalId = null;
  }

  start() {
    if (!__DEV__) {
      console.warn('🚫 Background performance monitoring disabled in production');
      return false;
    }

    if (this.isRunning) {
      console.warn('⚠️ Performance monitor already running');
      return false;
    }

    console.log('🎯 Starting background performance monitoring...');
    this.isRunning = true;
    
    this.intervalId = setInterval(() => {
      this.takeMeasurement();
    }, this.options.measureInterval);

    return true;
  }

  stop() {
    if (!this.isRunning) return false;

    console.log('🛑 Stopping background performance monitoring...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    return true;
  }

  takeMeasurement() {
    const measurement = {
      timestamp: Date.now(),
      memory: getMemoryUsage(),
      performance: {
        now: performance.now(),
        timing: performance.timing ? {
          loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart,
          domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
        } : null
      }
    };

    this.measurements.push(measurement);

    // Keep only recent measurements
    if (this.measurements.length > this.options.maxMeasurements) {
      this.measurements.shift();
    }

    return measurement;
  }

  getReport() {
    if (this.measurements.length === 0) {
      return { error: 'No measurements available' };
    }

    const memoryValues = this.measurements.map(m => m.memory);
    const timespan = this.measurements[this.measurements.length - 1].timestamp - this.measurements[0].timestamp;

    return {
      timespan,
      measurementCount: this.measurements.length,
      memory: {
        current: memoryValues[memoryValues.length - 1],
        average: memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length,
        min: Math.min(...memoryValues),
        max: Math.max(...memoryValues),
        trend: memoryValues[memoryValues.length - 1] - memoryValues[0]
      },
      measurements: this.measurements
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getMemoryUsage() {
  if (typeof performance !== 'undefined' && performance.memory) {
    return Math.round(performance.memory.usedJSHeapSize / (1024 * 1024) * 100) / 100;
  }
  return 0;
}

function generateTestColors(count) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 360) / count;
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

function analyzeColorSafe(hex) {
  // Lightweight color analysis for testing
  const rgb = hexToRgb(hex);
  return {
    brightness: (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000,
    isLight: (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 128
  };
}

function analyzePaletteSafe(colors) {
  // Lightweight palette analysis for testing
  return colors.map(color => analyzeColorSafe(color));
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function simulateGestureEvent(eventIndex, totalEvents) {
  const progress = eventIndex / totalEvents;
  const angle = progress * 360;
  
  return {
    angle,
    colors: generateTestColors(3),
    timestamp: performance.now(),
    eventIndex
  };
}

// Export safe alternatives
export {
  productionSafe,
  devOnly,
  processInChunks,
  BackgroundPerformanceMonitor
};

export default {
  runSafeColorBenchmarks,
  testColorWheelPerformanceSafe,
  profileMemoryUsageSafe,
  BackgroundPerformanceMonitor,
  productionSafe,
  devOnly,
  processInChunks
};
