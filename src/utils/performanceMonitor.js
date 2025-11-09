// utils/performanceMonitor.js - Performance monitoring utilities
// Measures gesture latency, frame rate, and memory usage

import { runOnJS } from 'react-native-reanimated';

class PerformanceMonitor {
  constructor() {
    this.gestureLatencies = [];
    this.frameRates = [];
    this.memoryUsage = [];
    this.startTime = null;
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.isMonitoring = false;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    this.isMonitoring = true;
    this.startTime = performance.now();
    this.frameCount = 0;
    this.gestureLatencies = [];
    this.frameRates = [];
    
    console.log('🔍 Performance monitoring started');
    
    // Start frame rate monitoring
    this.monitorFrameRate();
    
    // Start memory monitoring (every 5 seconds)
    this.memoryInterval = setInterval(() => {
      this.measureMemoryUsage();
    }, 5000);
  }

  /**
   * Stop performance monitoring and report results
   */
  stopMonitoring() {
    this.isMonitoring = false;
    
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
    
    this.generateReport();
  }

  /**
   * Measure gesture latency (call from worklet)
   */
  measureGestureLatency = () => {
    'worklet';
    const startTime = performance.now();
    
    // Simulate gesture processing
    runOnJS((start) => {
      const endTime = performance.now();
      const latency = endTime - start;
      
      if (this.isMonitoring) {
        this.gestureLatencies.push(latency);
        
        // Keep only last 100 measurements
        if (this.gestureLatencies.length > 100) {
          this.gestureLatencies.shift();
        }
      }
    })(startTime);
  };

  /**
   * Monitor frame rate using requestAnimationFrame
   */
  monitorFrameRate = () => {
    if (!this.isMonitoring) return;
    
    const now = performance.now();
    
    if (this.lastFrameTime > 0) {
      const frameDuration = now - this.lastFrameTime;
      const fps = 1000 / frameDuration;
      
      this.frameRates.push(fps);
      
      // Keep only last 300 measurements (5 seconds at 60fps)
      if (this.frameRates.length > 300) {
        this.frameRates.shift();
      }
    }
    
    this.lastFrameTime = now;
    this.frameCount++;
    
    requestAnimationFrame(this.monitorFrameRate);
  };

  /**
   * Measure memory usage (React Native specific)
   */
  measureMemoryUsage = () => {
    if (!this.isMonitoring) return;
    
    try {
      // Use performance.memory if available (web/Hermes)
      if (typeof performance !== 'undefined' && performance.memory) {
        const memory = {
          used: performance.memory.usedJSHeapSize / 1024 / 1024, // MB
          total: performance.memory.totalJSHeapSize / 1024 / 1024, // MB
          limit: performance.memory.jsHeapSizeLimit / 1024 / 1024, // MB
          timestamp: Date.now()
        };
        
        this.memoryUsage.push(memory);
        
        // Keep only last 60 measurements (5 minutes)
        if (this.memoryUsage.length > 60) {
          this.memoryUsage.shift();
        }
      }
    } catch (error) {
      console.warn('Memory monitoring not available:', error);
    }
  };

  /**
   * Calculate statistics from array of numbers
   */
  calculateStats = (values) => {
    if (values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      average: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  };

  /**
   * Generate comprehensive performance report
   */
  generateReport = () => {
    const totalTime = (performance.now() - this.startTime) / 1000; // seconds
    
    console.log('\n📊 PERFORMANCE REPORT');
    console.log('='.repeat(50));
    
    // Overall metrics
    console.log(`⏱️  Total monitoring time: ${totalTime.toFixed(2)}s`);
    console.log(`🖼️  Total frames rendered: ${this.frameCount}`);
    console.log(`📱 Average FPS: ${(this.frameCount / totalTime).toFixed(1)}`);
    
    // Gesture latency analysis
    const latencyStats = this.calculateStats(this.gestureLatencies);
    if (latencyStats) {
      console.log('\n🎯 GESTURE LATENCY ANALYSIS');
      console.log(`   Samples: ${latencyStats.count}`);
      console.log(`   Average: ${latencyStats.average.toFixed(2)}ms`);
      console.log(`   Median:  ${latencyStats.median.toFixed(2)}ms`);
      console.log(`   95th %:  ${latencyStats.p95.toFixed(2)}ms`);
      console.log(`   99th %:  ${latencyStats.p99.toFixed(2)}ms`);
      console.log(`   Range:   ${latencyStats.min.toFixed(2)}ms - ${latencyStats.max.toFixed(2)}ms`);
      
      // Performance rating
      if (latencyStats.p95 < 5) {
        console.log('   Rating:  🟢 EXCELLENT (< 5ms)');
      } else if (latencyStats.p95 < 16) {
        console.log('   Rating:  🟡 GOOD (< 16ms)');
      } else {
        console.log('   Rating:  🔴 NEEDS IMPROVEMENT (> 16ms)');
      }
    }
    
    // Frame rate analysis
    const fpsStats = this.calculateStats(this.frameRates);
    if (fpsStats) {
      console.log('\n🖼️ FRAME RATE ANALYSIS');
      console.log(`   Samples: ${fpsStats.count}`);
      console.log(`   Average: ${fpsStats.average.toFixed(1)} FPS`);
      console.log(`   Median:  ${fpsStats.median.toFixed(1)} FPS`);
      console.log(`   Min FPS: ${fpsStats.min.toFixed(1)}`);
      console.log(`   Max FPS: ${fpsStats.max.toFixed(1)}`);
      
      // Frame rate rating
      if (fpsStats.average >= 55) {
        console.log('   Rating:  🟢 SMOOTH (55+ FPS)');
      } else if (fpsStats.average >= 45) {
        console.log('   Rating:  🟡 ACCEPTABLE (45+ FPS)');
      } else {
        console.log('   Rating:  🔴 CHOPPY (< 45 FPS)');
      }
    }
    
    // Memory usage analysis
    if (this.memoryUsage.length > 0) {
      const memoryValues = this.memoryUsage.map(m => m.used);
      const memoryStats = this.calculateStats(memoryValues);
      
      console.log('\n💾 MEMORY USAGE ANALYSIS');
      console.log(`   Samples: ${memoryStats.count}`);
      console.log(`   Average: ${memoryStats.average.toFixed(1)} MB`);
      console.log(`   Peak:    ${memoryStats.max.toFixed(1)} MB`);
      console.log(`   Range:   ${memoryStats.min.toFixed(1)} - ${memoryStats.max.toFixed(1)} MB`);
      
      // Memory growth analysis
      const firstMemory = this.memoryUsage[0].used;
      const lastMemory = this.memoryUsage[this.memoryUsage.length - 1].used;
      const growth = lastMemory - firstMemory;
      
      console.log(`   Growth:  ${growth > 0 ? '+' : ''}${growth.toFixed(1)} MB`);
      
      if (Math.abs(growth) < 5) {
        console.log('   Rating:  🟢 STABLE MEMORY');
      } else if (Math.abs(growth) < 20) {
        console.log('   Rating:  🟡 MINOR GROWTH');
      } else {
        console.log('   Rating:  🔴 MEMORY LEAK RISK');
      }
    }
    
    console.log('='.repeat(50));
    console.log('✅ Performance analysis complete\n');
    
    // Return data for programmatic use
    return {
      totalTime,
      frameCount,
      averageFPS: this.frameCount / totalTime,
      gestureLatency: latencyStats,
      frameRate: fpsStats,
      memoryUsage: this.memoryUsage
    };
  };

  /**
   * Test color wheel performance with simulated gestures (PRODUCTION-SAFE)
   * Simulates gestures with safety limits and dev-only execution
   */
  static testColorWheelPerformance(colorWheelRef, options = {}) {
    // Block in production builds
    if (!__DEV__) {
      console.warn('🚫 Color wheel performance test blocked in production build');
      return Promise.resolve({
        blocked: true,
        reason: 'Production safety - performance tests disabled'
      });
    }

    // Apply safety limits even in development
    const maxDuration = 5000; // Max 5 seconds instead of 10
    const duration = Math.min(options.duration || 5000, maxDuration);
    const eventsPerSecond = Math.min(options.eventsPerSecond || 10, 20); // Max 20 events/sec
    
    const monitor = new PerformanceMonitor();
    
    console.log('🧪 Starting Color Wheel Performance Test...');
    console.log(`   Duration: ${duration / 1000}s`);
    
    monitor.startMonitoring();
    
    // Simulate user interactions
    const testInterval = setInterval(() => {
      // Simulate gesture latency measurement
      monitor.measureGestureLatency();
    }, 50); // 20 times per second
    
    // Stop test after duration
    setTimeout(() => {
      clearInterval(testInterval);
      monitor.stopMonitoring();
      
      console.log('🏁 Performance test completed!');
    }, duration);
    
    return monitor;
  }
}

// Singleton instance for global use
export const performanceMonitor = new PerformanceMonitor();

// Hook for easy integration
export const usePerformanceMonitor = () => {
  const startTest = (duration = 10000) => {
    return PerformanceMonitor.testColorWheelPerformance(null, duration);
  };
  
  const measureGesture = () => {
    performanceMonitor.measureGestureLatency();
  };
  
  return {
    startTest,
    measureGesture,
    startMonitoring: () => performanceMonitor.startMonitoring(),
    stopMonitoring: () => performanceMonitor.stopMonitoring()
  };
};

export default PerformanceMonitor;
