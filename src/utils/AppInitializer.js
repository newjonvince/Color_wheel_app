// utils/AppInitializer.js - Centralized initialization manager
// Replaces mixed initialization strategies with predictable, sequential initialization

import { logger } from './AppLogger';
import { reportError, ERROR_EVENTS } from './errorTelemetry';
import { validateEnv } from '../config/env';
import { initializeAppConfig } from '../config/app';
import { safeStorage } from './safeStorage';
import safeApiService from '../services/safeApiService';

// Initialization step interface
class InitializationStep {
  constructor(name, fn, options = {}) {
    this.name = name;
    this.fn = fn;
    this.critical = options.critical ?? true;
    this.timeout = options.timeout ?? 10000;
    this.retries = options.retries ?? 0;
    this.dependencies = options.dependencies ?? [];
  }
}

// Centralized initialization manager
class AppInitializer {
  constructor() {
    this.isInitialized = false;
    this.isInitializing = false;
    this.initializationPromise = null;
    this.completedSteps = new Set();
    this.failedSteps = new Set();
    this.startTime = null;
    
    // Define initialization steps with dependencies
    this.steps = [
      new InitializationStep('env', validateEnv, {
        critical: true,
        timeout: 1000,
        retries: 0
      }),
      
      new InitializationStep('config', initializeAppConfig, {
        critical: true,
        timeout: 5000,
        retries: 1,
        dependencies: ['env']
      }),
      
      new InitializationStep('storage', () => safeStorage.init(), {
        critical: true,
        timeout: 10000,
        retries: 2,
        dependencies: ['config']
      }),
      
      new InitializationStep('api', () => safeApiService.ready, {
        critical: false,
        timeout: 15000,
        retries: 3,
        dependencies: ['storage']
      }),
      
      new InitializationStep('auth', null, { // Will be set dynamically
        critical: false,
        timeout: 10000,
        retries: 1,
        dependencies: ['storage', 'api']
      })
    ];
  }

  // Set auth initializer (injected from useAuth)
  setAuthInitializer(initializeAuth) {
    const authStep = this.steps.find(step => step.name === 'auth');
    if (authStep) {
      authStep.fn = initializeAuth;
    }
  }

  // Check if dependencies are satisfied
  areDependenciesSatisfied(step) {
    return step.dependencies.every(dep => this.completedSteps.has(dep));
  }

  // 🚨 CRITICAL FIX: Wait for dependencies with timeout mechanism
  async waitForDependencies(step, signal) {
    if (step.dependencies.length === 0) {
      return; // No dependencies to wait for
    }

    const DEPENDENCY_TIMEOUT = 30000; // 30 seconds max wait for dependencies
    const CHECK_INTERVAL = 100; // Check every 100ms
    const startTime = Date.now();
    
    logger.debug(`⏳ Waiting for dependencies for step '${step.name}': [${step.dependencies.join(', ')}]`);

    while (!this.areDependenciesSatisfied(step)) {
      const elapsed = Date.now() - startTime;
      
      // 🚨 TIMEOUT CHECK: Prevent infinite hangs
      if (elapsed > DEPENDENCY_TIMEOUT) {
        const pendingDeps = step.dependencies.filter(dep => !this.completedSteps.has(dep));
        const errorMsg = `Dependency timeout after ${DEPENDENCY_TIMEOUT}ms waiting for: ${pendingDeps.join(', ')}`;
        logger.error(`🚨 ${errorMsg}`);
        
        // Report timeout for monitoring
        reportError(ERROR_EVENTS.COMPONENT_MOUNT_FAILED, new Error(errorMsg), {
          step: step.name,
          pendingDependencies: pendingDeps,
          elapsedTime: elapsed,
          context: 'dependency_timeout'
        });
        
        throw new Error(errorMsg);
      }
      
      // Check if aborted
      if (signal?.aborted) {
        throw new Error('Initialization aborted while waiting for dependencies');
      }
      
      // Check if any critical dependency failed
      const failedCriticalDeps = step.dependencies.filter(dep => {
        const depStep = this.steps.find(s => s.name === dep);
        return depStep?.critical && this.failedSteps.has(dep);
      });
      
      if (failedCriticalDeps.length > 0) {
        const errorMsg = `Critical dependencies failed: ${failedCriticalDeps.join(', ')}`;
        logger.error(`🚨 ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // Check for circular dependencies (prevent infinite loops)
      const circularDep = this.detectCircularDependency(step.name, step.dependencies);
      if (circularDep) {
        const errorMsg = `Circular dependency detected: ${circularDep}`;
        logger.error(`🚨 ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // Log progress every 5 seconds to help with debugging
      if (elapsed > 0 && elapsed % 5000 < CHECK_INTERVAL) {
        const pendingDeps = step.dependencies.filter(dep => !this.completedSteps.has(dep));
        logger.warn(`⏳ Still waiting for dependencies (${elapsed}ms): ${pendingDeps.join(', ')}`);
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
    }
    
    const waitTime = Date.now() - startTime;
    logger.debug(`✅ Dependencies satisfied for '${step.name}' after ${waitTime}ms`);
  }

  // 🔧 Helper: Detect circular dependencies to prevent infinite loops
  detectCircularDependency(stepName, dependencies, visited = new Set()) {
    if (visited.has(stepName)) {
      return `${Array.from(visited).join(' -> ')} -> ${stepName}`;
    }
    
    visited.add(stepName);
    
    for (const dep of dependencies) {
      const depStep = this.steps.find(s => s.name === dep);
      if (depStep) {
        const circular = this.detectCircularDependency(dep, depStep.dependencies, new Set(visited));
        if (circular) {
          return circular;
        }
      }
    }
    
    return null;
  }

  // Execute a single step with timeout and retries
  async executeStep(step, signal) {
    if (!step.fn) {
      logger.warn(`Step ${step.name} has no function, skipping`);
      return;
    }

    let lastError = null;
    const maxAttempts = step.retries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info(`🔄 Executing step: ${step.name} (attempt ${attempt}/${maxAttempts})`);
        
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Step ${step.name} timed out after ${step.timeout}ms`));
          }, step.timeout);
          
          // Clear timeout if signal is aborted
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              reject(new Error(`Step ${step.name} was aborted`));
            });
          }
        });

        // Race between step execution and timeout
        await Promise.race([
          Promise.resolve(step.fn({ signal })),
          timeoutPromise
        ]);

        logger.info(`✅ Step completed: ${step.name}`);
        this.completedSteps.add(step.name);
        return;

      } catch (error) {
        lastError = error;
        logger.warn(`❌ Step ${step.name} failed (attempt ${attempt}/${maxAttempts}):`, error.message);
        
        // Don't retry if aborted
        if (signal?.aborted || error.message.includes('aborted')) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    this.failedSteps.add(step.name);
    
    if (step.critical) {
      throw lastError;
    } else {
      logger.warn(`⚠️ Non-critical step ${step.name} failed, continuing`);
      reportError(ERROR_EVENTS.COMPONENT_MOUNT_FAILED, lastError, {
        step: step.name,
        critical: step.critical,
        attempts: maxAttempts
      });
    }
  }

  // Main initialization method
  async initialize(options = {}) {
    // Return existing promise if already initializing
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Return immediately if already initialized
    if (this.isInitialized) {
      return Promise.resolve();
    }

    this.initializationPromise = this._performInitialization(options);
    return this.initializationPromise;
  }

  async _performInitialization(options = {}) {
    const { signal, onProgress } = options;
    
    try {
      this.isInitializing = true;
      this.startTime = Date.now();
      
      logger.info('🚀 Starting centralized app initialization...');
      
      // Reset state
      this.completedSteps.clear();
      this.failedSteps.clear();

      // Execute steps in dependency order
      const totalSteps = this.steps.length;
      let completedCount = 0;

      for (const step of this.steps) {
        // Check if aborted
        if (signal?.aborted) {
          throw new Error('Initialization aborted');
        }

        // 🚨 CRITICAL FIX: Wait for dependencies with timeout to prevent infinite hangs
        await this.waitForDependencies(step, signal);

        // Execute the step
        await this.executeStep(step, signal);
        
        completedCount++;
        
        // Report progress
        if (onProgress) {
          onProgress({
            step: step.name,
            completed: completedCount,
            total: totalSteps,
            progress: completedCount / totalSteps
          });
        }
      }

      const initTime = Date.now() - this.startTime;
      logger.info(`✅ App initialization completed in ${initTime}ms`);
      
      this.isInitialized = true;
      this.isInitializing = false;

      // Report successful initialization
      if (!__DEV__ && global.Analytics) {
        global.Analytics.track('app_initialization_success', {
          duration: initTime,
          completedSteps: Array.from(this.completedSteps),
          failedSteps: Array.from(this.failedSteps)
        });
      }

    } catch (error) {
      this.isInitializing = false;
      
      const initTime = this.startTime ? Date.now() - this.startTime : 0;
      logger.error('🚨 App initialization failed:', error);
      
      // Report failed initialization
      reportError(ERROR_EVENTS.COMPONENT_MOUNT_FAILED, error, {
        duration: initTime,
        completedSteps: Array.from(this.completedSteps),
        failedSteps: Array.from(this.failedSteps),
        context: 'app_initialization'
      });

      throw error;
    }
  }

  // Get initialization status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isInitializing: this.isInitializing,
      completedSteps: Array.from(this.completedSteps),
      failedSteps: Array.from(this.failedSteps),
      progress: this.completedSteps.size / this.steps.length
    };
  }

  // Reset initialization state (for testing or restart)
  reset() {
    this.isInitialized = false;
    this.isInitializing = false;
    this.initializationPromise = null;
    this.completedSteps.clear();
    this.failedSteps.clear();
    this.startTime = null;
  }

  // Add custom initialization step
  addStep(name, fn, options = {}) {
    const step = new InitializationStep(name, fn, options);
    this.steps.push(step);
    return step;
  }

  // Remove initialization step
  removeStep(name) {
    const index = this.steps.findIndex(step => step.name === name);
    if (index !== -1) {
      this.steps.splice(index, 1);
      return true;
    }
    return false;
  }
}

// Create singleton instance
const appInitializer = new AppInitializer();

// Export singleton and class for testing
export default appInitializer;
export { AppInitializer, InitializationStep };
