// utils/AppInitializer.js - Centralized initialization manager
// Replaces mixed initialization strategies with predictable, sequential initialization

// Lazy loaders to break circular deps and avoid early crashes
let loggerInstance = null;
const getLogger = () => {
  if (loggerInstance) return loggerInstance;
  try {
    const mod = require('./AppLogger');
    loggerInstance = mod?.logger || mod?.default || console;
  } catch (error) {
    console.warn('AppInitializer: logger load failed, using console', error?.message || error);
    loggerInstance = console;
  }

  return loggerInstance;
};

let telemetry = null;
const getTelemetry = () => {
  if (telemetry) return telemetry;
  try {
    telemetry = require('./errorTelemetry');
  } catch (error) {
    getLogger().warn?.('AppInitializer: errorTelemetry load failed', error?.message || error);
    telemetry = { reportError: () => {}, ERROR_EVENTS: {} };
  }
  return telemetry;
};

const getValidateEnv = () => {
  try {
    return require('../config/env').validateEnv;
  } catch (error) {
    getLogger().warn?.('AppInitializer: validateEnv load failed', error?.message || error);
    return () => ({ isValid: true, warnings: [], errors: [] });
  }
};

const getInitializeAppConfig = () => {
  try {
    return require('../config/app').initializeAppConfig;
  } catch (error) {
    getLogger().warn?.('AppInitializer: initializeAppConfig load failed', error?.message || error);
    return async () => ({ ok: true, error: null });
  }
};

const getSafeStorage = () => {
  try {
    return require('./safeStorage').safeStorage;
  } catch (error) {
    getLogger().warn?.('AppInitializer: safeStorage load failed', error?.message || error);
    return { init: async () => {} };
  }
};

const getSafeApiService = () => {
  try {
    return require('../services/safeApiService').default;
  } catch (error) {
    getLogger().warn?.('AppInitializer: safeApiService load failed', error?.message || error);
    return { ready: Promise.resolve() };
  }
};

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
      new InitializationStep('env', () => getValidateEnv()(), {
        critical: true,
        timeout: 1000,
        retries: 0
      }),
      
      new InitializationStep('config', () => getInitializeAppConfig()(), {
        critical: true,
        timeout: 3000,
        retries: 1,
        dependencies: ['env']
      }),
      
      new InitializationStep('storage', ({ signal }) => getSafeStorage().init({ signal }), {
        critical: true,
        timeout: 4000,
        retries: 2,
        dependencies: ['config']
      }),
      
      new InitializationStep('api', ({ signal }) => getSafeApiService().initialize({ signal }), {
        critical: true,
        timeout: 3000,
        retries: 3,
        dependencies: ['storage']
      }),
      
      new InitializationStep('auth', null, { // Will be set dynamically
        critical: false,
        timeout: 2000,
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
    return step.dependencies.every(dep => {
      if (this.completedSteps.has(dep)) return true;
      if (this.failedSteps.has(dep)) {
        const depStep = this.steps.find(s => s.name === dep);
        if (depStep && !depStep.critical) {
          return true;
        }
      }
      return false;
    });
  }

  // Wait for dependencies with timeout mechanism
  async waitForDependencies(step, signal) {
    if (!step.dependencies || step.dependencies.length === 0) {
      return;
    }

    const DEPENDENCY_TIMEOUT = 10000;
    const CHECK_INTERVAL = 100;
    const startTime = Date.now();
    
    getLogger().debug(`Waiting for dependencies for step '${step.name}': [${step.dependencies.join(', ')}]`);

    while (!this.areDependenciesSatisfied(step)) {
      const elapsed = Date.now() - startTime;
      
      if (elapsed > DEPENDENCY_TIMEOUT) {
        const pendingDeps = step.dependencies.filter(dep => !this.completedSteps.has(dep));
        const errorMsg = `Dependency timeout after ${DEPENDENCY_TIMEOUT}ms waiting for: ${pendingDeps.join(', ')}`;
        getLogger().error(errorMsg);
        
        const { reportError, ERROR_EVENTS } = getTelemetry();
        reportError?.(ERROR_EVENTS.COMPONENT_MOUNT_FAILED, new Error(errorMsg), {
          step: step.name,
          pendingDependencies: pendingDeps,
          elapsedTime: elapsed,
          context: 'dependency_timeout'
        });
        
        throw new Error(errorMsg);
      }
      
      if (signal?.aborted) {
        throw new Error('Initialization aborted while waiting for dependencies');
      }
      
      const failedCriticalDeps = step.dependencies.filter(dep => {
        const depStep = this.steps.find(s => s.name === dep);
        return depStep?.critical && this.failedSteps.has(dep);
      });
      
      if (failedCriticalDeps.length > 0) {
        const errorMsg = `Critical dependencies failed: ${failedCriticalDeps.join(', ')}`;
        getLogger().error(errorMsg);
        throw new Error(errorMsg);
      }
      
      const circularDep = this.detectCircularDependency(step.name, step.dependencies);
      if (circularDep) {
        const errorMsg = `Circular dependency detected: ${circularDep}`;
        getLogger().error(errorMsg);
        throw new Error(errorMsg);
      }
      
      if (elapsed > 0 && elapsed % 5000 < CHECK_INTERVAL) {
        const pendingDeps = step.dependencies.filter(dep => !this.completedSteps.has(dep));
        getLogger().warn(`Still waiting for dependencies (${elapsed}ms): ${pendingDeps.join(', ')}`);
      }
      
      await new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error('Initialization aborted while waiting for dependencies'));
          return;
        }
        
        let settled = false;
        
        const abortHandler = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            reject(new Error('Initialization aborted while waiting for dependencies'));
          }
        };
        
        const timeoutId = setTimeout(() => {
          if (!settled) {
            settled = true;
            // ✅ CRITICAL: Remove listener!
            if (signal?.removeEventListener) {
              signal.removeEventListener('abort', abortHandler);
            }
            if (signal?.aborted) {
              reject(new Error('Initialization aborted while waiting for dependencies'));
            } else {
              resolve();
            }
          }
        }, CHECK_INTERVAL);
        
        if (signal?.addEventListener) {
          signal.addEventListener('abort', abortHandler, { once: true });
        }
      });
    }
    
    const waitTime = Date.now() - startTime;
    getLogger().debug(`Dependencies satisfied for '${step.name}' after ${waitTime}ms`);
  }

  // Detect circular dependencies to prevent infinite loops
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

  // Execute a single step with timeout and retry logic
  async executeStep(step, signal, onProgress) {
    const startTime = Date.now();
    let lastError = null;
    
    for (let attempt = 1; attempt <= step.retries + 1; attempt++) {
      if (signal?.aborted) {
        throw new Error(`Initialization aborted during step '${step.name}'`);
      }
      
      try {
        console.log(`🔧 Executing initialization step '${step.name}' (attempt ${attempt}/${step.retries + 1})`);
        getLogger().debug(`Executing step '${step.name}' (attempt ${attempt}/${step.retries + 1})`);
        
        // Pass signal to step function
        const stepPromise = typeof step.fn === 'function' 
          ? step.fn({ signal }) 
          : Promise.resolve(step.fn);
        
        // ✅ CRITICAL FIX: Manual timeout/cancellation management to prevent uncaught promise rejections
        const result = await new Promise((resolve, reject) => {
          let settled = false;
          let timeoutId = null;
          let abortHandler = null;
          
          const cleanup = () => {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            if (abortHandler && signal?.removeEventListener) {
              signal.removeEventListener('abort', abortHandler);
              abortHandler = null;
            }
          };
          
          // Set up abort handler
          if (signal?.addEventListener) {
            abortHandler = () => {
              if (!settled) {
                settled = true;
                cleanup();
                reject(new Error(`Step '${step.name}' aborted`));
              }
            };
            signal.addEventListener('abort', abortHandler, { once: true });
          }
          
          // Set up timeout
          timeoutId = setTimeout(() => {
            if (!settled) {
              settled = true;
              cleanup();
              reject(new Error(`Step '${step.name}' timed out after ${step.timeout}ms`));
            }
          }, step.timeout);
          
          // Handle step promise
          stepPromise.then(
            (stepResult) => {
              if (!settled) {
                settled = true;
                cleanup();
                resolve(stepResult);
              }
            },
            (error) => {
              if (!settled) {
                settled = true;
                cleanup();
                reject(error);
              }
            }
          ).catch((error) => {
            // ✅ SAFETY: Catch any remaining promise rejections
            if (!settled) {
              settled = true;
              cleanup();
              reject(error);
            }
          });
        });
        
        const duration = Date.now() - startTime;
        getLogger().debug(`Step '${step.name}' completed in ${duration}ms`);
        
        // ✅ CRITICAL FIX: Mark step as completed
        this.completedSteps.add(step.name);
        
        onProgress?.({
          step: step.name,
          progress: 1.0,
          message: `${step.name} completed`,
          duration
        });
        
        return result;
        
      } catch (error) {
        lastError = error;
        const duration = Date.now() - startTime;
        
        if (signal?.aborted || error.message?.includes('aborted')) {
          throw new Error(`Initialization aborted during step '${step.name}'`);
        }
        
        console.error(`❌ Step '${step.name}' failed (attempt ${attempt}/${step.retries + 1}):`, error.message);
        console.error(`🔍 Step '${step.name}' error details:`, {
          message: error.message,
          stack: error.stack,
          name: error.name,
          cause: error.cause
        });
        getLogger().warn(`Step '${step.name}' failed (attempt ${attempt}/${step.retries + 1}):`, error.message);
        
        if (attempt <= step.retries) {
          const retryDelay = Math.min(1000 * attempt, 5000);
          getLogger().debug(`Retrying step '${step.name}' in ${retryDelay}ms...`);
          
          // Make retry delay cancellable
          await new Promise((resolve, reject) => {
            let settled = false;
            
            const abortHandler = () => {
              if (!settled) {
                settled = true;
                clearTimeout(delayId);
                reject(new Error(`Retry delay aborted for step '${step.name}'`));
              }
            };
            
            const delayId = setTimeout(() => {
              if (!settled) {
                settled = true;
                // ✅ CRITICAL: Remove listener!
                if (signal?.removeEventListener) {
                  signal.removeEventListener('abort', abortHandler);
                }
                resolve();
              }
            }, retryDelay);
            
            if (signal?.addEventListener) {
              signal.addEventListener('abort', abortHandler, { once: true });
            }
          });
        }
      }
    }
    
    // ✅ CRITICAL FIX: Mark step as failed
    this.failedSteps.add(step.name);
    
    const error = new Error(`Step '${step.name}' failed after ${step.retries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
    error.originalError = lastError;
    throw error;
  }

  // Main initialization method
  async initialize(options = {}) {
    // ✅ RACE CONDITION FIX: Check if already initializing BEFORE creating new promise
    if (this.isInitializing) {
      // If already initializing, wait for existing promise or create one if missing
      if (this.initializationPromise) {
        return this.initializationPromise;
      }
      // Edge case: isInitializing=true but no promise (shouldn't happen, but be safe)
      throw new Error('Initialization in progress but no promise found - invalid state');
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.isInitialized) {
      return Promise.resolve();
    }

    // ✅ ATOMIC: Set flag immediately before creating promise
    this.isInitializing = true;
    this.initializationPromise = this._performInitialization(options);
    return this.initializationPromise;
  }

  async _performInitialization(options = {}) {
    const { signal, onProgress } = options;
    
    const GLOBAL_TIMEOUT = 15000;
    let globalTimeoutId = null;
    
    // ✅ FIX: Create AbortController for global timeout that actually aborts operations
    const globalAbortController = new AbortController();
    const combinedSignal = signal ? this._combineAbortSignals(signal, globalAbortController.signal) : globalAbortController.signal;
    
    const globalTimeoutPromise = new Promise((_, reject) => {
      globalTimeoutId = setTimeout(() => {
        // ✅ CRITICAL FIX: Actually abort ongoing operations
        globalAbortController.abort();
        reject(new Error(`Global initialization timeout after ${GLOBAL_TIMEOUT}ms`));
      }, GLOBAL_TIMEOUT);
    });
    
    try {
      // Note: isInitializing already set in initialize() method
      this.startTime = Date.now();
      
      getLogger().info('Starting centralized app initialization with 15s global timeout...');
      
      const initializationLogic = async () => {
        this.completedSteps.clear();
        this.failedSteps.clear();

        const totalSteps = this.steps.length;
        let completedCount = 0;

        for (const step of this.steps) {
          if (combinedSignal?.aborted) {
            throw new Error('Initialization aborted');
          }

          await this.waitForDependencies(step, combinedSignal);
          await this.executeStep(step, combinedSignal);
          
          completedCount++;
          
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
        getLogger().info(`App initialization completed in ${initTime}ms`);
        
        this.isInitialized = true;
        this.isInitializing = false;

        if (!__DEV__ && global.Analytics) {
          global.Analytics.track('app_initialization_success', {
            duration: initTime,
            completedSteps: Array.from(this.completedSteps),
            failedSteps: Array.from(this.failedSteps)
          });
        }
      };

      await Promise.race([initializationLogic(), globalTimeoutPromise]);

    } catch (error) {
      // ✅ COMPREHENSIVE CLEANUP ON FAILURE
      this.isInitializing = false;
      this.initializationPromise = null; // ✅ Clear promise to allow retry
      
      // ✅ Abort any ongoing operations
      if (!globalAbortController.signal.aborted) {
        globalAbortController.abort();
      }
      
      const initTime = this.startTime ? Date.now() - this.startTime : 0;
      getLogger().error('App initialization failed:', error);
      
      // ✅ Log partial state for debugging
      getLogger().warn('Partial initialization state:', {
        completedSteps: Array.from(this.completedSteps),
        failedSteps: Array.from(this.failedSteps),
        totalSteps: this.steps.length
      });
      
      const { reportError, ERROR_EVENTS } = getTelemetry();
      reportError?.(ERROR_EVENTS.COMPONENT_MOUNT_FAILED, error, {
        duration: initTime,
        completedSteps: Array.from(this.completedSteps),
        failedSteps: Array.from(this.failedSteps),
        context: 'app_initialization'
      });

      throw error;
    } finally {
      if (globalTimeoutId) {
        clearTimeout(globalTimeoutId);
      }
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

  // ✅ Helper method to combine multiple abort signals
  _combineAbortSignals(signal1, signal2) {
    if (!signal1 && !signal2) return null;
    if (!signal1) return signal2;
    if (!signal2) return signal1;
    
    const controller = new AbortController();
    
    const abortHandler = () => controller.abort();
    
    if (!signal1.aborted && !signal2.aborted) {
      signal1.addEventListener('abort', abortHandler, { once: true });
      signal2.addEventListener('abort', abortHandler, { once: true });
    } else {
      // If either is already aborted, abort immediately
      controller.abort();
    }
    
    return controller.signal;
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

