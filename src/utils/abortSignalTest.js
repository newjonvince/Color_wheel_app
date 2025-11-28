// utils/abortSignalTest.js - Test abort signal propagation through initialization chain

import { checkAborted, isAbortError } from './abortUtils';

/**
 * Test the complete abort signal propagation chain
 * This simulates the App.js → AppInitializer → Services flow
 */
export const testAbortSignalPropagation = async () => {
  console.log('🧪 Testing abort signal propagation...');
  
  // Test 1: Normal completion without abort
  try {
    const controller1 = new AbortController();
    const result1 = await simulateInitializationChain(controller1.signal);
    console.log('✅ Test 1 passed: Normal completion', result1);
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }
  
  // Test 2: Abort during storage initialization
  try {
    const controller2 = new AbortController();
    
    // Abort after 100ms (during storage init)
    setTimeout(() => {
      console.log('🚫 Aborting during storage initialization...');
      controller2.abort();
    }, 100);
    
    const result2 = await simulateInitializationChain(controller2.signal);
    console.error('❌ Test 2 failed: Should have been aborted');
  } catch (error) {
    if (isAbortError(error)) {
      console.log('✅ Test 2 passed: Properly aborted during storage init');
    } else {
      console.error('❌ Test 2 failed with unexpected error:', error.message);
    }
  }
  
  // Test 3: Abort during API initialization
  try {
    const controller3 = new AbortController();
    
    // Abort after 250ms (during API init)
    setTimeout(() => {
      console.log('🚫 Aborting during API initialization...');
      controller3.abort();
    }, 250);
    
    const result3 = await simulateInitializationChain(controller3.signal);
    console.error('❌ Test 3 failed: Should have been aborted');
  } catch (error) {
    if (isAbortError(error)) {
      console.log('✅ Test 3 passed: Properly aborted during API init');
    } else {
      console.error('❌ Test 3 failed with unexpected error:', error.message);
    }
  }
  
  // Test 4: Pre-aborted signal
  try {
    const controller4 = new AbortController();
    controller4.abort(); // Abort immediately
    
    const result4 = await simulateInitializationChain(controller4.signal);
    console.error('❌ Test 4 failed: Should have been aborted immediately');
  } catch (error) {
    if (isAbortError(error)) {
      console.log('✅ Test 4 passed: Pre-aborted signal handled correctly');
    } else {
      console.error('❌ Test 4 failed with unexpected error:', error.message);
    }
  }
  
  console.log('🧪 Abort signal propagation tests completed');
};

/**
 * Simulate the initialization chain with abort signal support
 */
const simulateInitializationChain = async (signal) => {
  console.log('🚀 Starting simulated initialization chain...');
  
  // Simulate App.js initialization
  checkAborted(signal, 'App initialization');
  
  // Simulate AppInitializer steps
  const steps = [
    { name: 'env', delay: 50 },
    { name: 'config', delay: 50 },
    { name: 'storage', delay: 150 },
    { name: 'api', delay: 100 },
    { name: 'auth', delay: 100 }
  ];
  
  const results = [];
  
  for (const step of steps) {
    console.log(`📋 Executing step: ${step.name}`);
    
    // Check abort before step
    checkAborted(signal, `Step ${step.name}`);
    
    // Simulate step execution with delay
    await simulateAsyncOperation(step.delay, signal, step.name);
    
    // Check abort after step
    checkAborted(signal, `Step ${step.name}`);
    
    results.push(`${step.name} completed`);
    console.log(`✅ Step ${step.name} completed`);
  }
  
  return results;
};

/**
 * Simulate an async operation that can be aborted
 */
const simulateAsyncOperation = async (delay, signal, operation) => {
  return new Promise((resolve, reject) => {
    // Check if already aborted
    if (signal?.aborted) {
      reject(new Error(`${operation} aborted`));
      return;
    }
    
    const timeoutId = setTimeout(() => {
      if (signal?.aborted) {
        reject(new Error(`${operation} aborted`));
      } else {
        resolve();
      }
    }, delay);
    
    // Listen for abort signal
    if (signal?.addEventListener) {
      const abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new Error(`${operation} aborted`));
      };
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  });
};

/**
 * Test abort signal integration with actual services (development only)
 */
export const testRealServiceAbortIntegration = async () => {
  if (!__DEV__) {
    console.warn('Real service abort tests only available in development mode');
    return;
  }
  
  console.log('🧪 Testing real service abort integration...');
  
  try {
    // Import services dynamically to avoid circular dependencies
    const { default: appInitializer } = await import('./AppInitializer');
    
    const controller = new AbortController();
    
    // Start initialization
    const initPromise = appInitializer.initialize({
      signal: controller.signal,
      onProgress: (progress) => {
        console.log(`📊 Progress: ${progress.step} - ${progress.message}`);
      }
    });
    
    // Abort after 200ms
    setTimeout(() => {
      console.log('🚫 Aborting real initialization...');
      controller.abort();
    }, 200);
    
    await initPromise;
    console.error('❌ Real service test failed: Should have been aborted');
  } catch (error) {
    if (isAbortError(error)) {
      console.log('✅ Real service test passed: Initialization properly aborted');
    } else {
      console.error('❌ Real service test failed with unexpected error:', error.message);
    }
  }
};

// Export test runner for development
export const runAbortSignalTests = async () => {
  if (!__DEV__) {
    console.warn('Abort signal tests only available in development mode');
    return;
  }
  
  console.log('🧪 Running abort signal tests...');
  
  await testAbortSignalPropagation();
  await testRealServiceAbortIntegration();
  
  console.log('🧪 All abort signal tests completed');
};
