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
    return require('../config/appconfig').initializeAppConfig;
  } catch (error) {
    getLogger().error?.('AppInitializer: initializeAppConfig load failed', error?.message || error);
    // CRITICAL FIX: Throw on config load failure instead of silent success
    return async () => {
      const configError = new Error(`Failed to load app configuration module: ${error?.message || error}`);
      configError.cause = error;
      configError.category = 'ConfigError';
      throw configError;
    };
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
    // CONSISTENCY FIX: Fallback service should be honest but not break initialization
    return { 
      ready: Promise.resolve(false), // Honest: Not actually ready for real work
      initialize: async ({ signal } = {}) => {
        if (signal?.aborted) {
          throw new Error('API service initialization aborted (fallback)');
        }
        getLogger().warn('Using fallback API service - no real API functionality available');
        // FALLBACK SUCCESS: Return success to allow app to continue in degraded mode
        return { 
          success: true, 
          fallbackMode: true,
          message: 'API service running in fallback mode - limited functionality'
        };
      },
      isServiceReady: () => false, // Consistent: Not ready for real API work
      getInitializationStatus: () => ({
        isInitialized: true,  // It did initialize (as a fallback)
        isReady: false,       // But it's not ready for real work
        initializationFailed: false, // Initialization didn't fail, it's just a fallback
        initializationError: null,
        fallbackMode: true,   // Clear indication this is a fallback
        fallbackReason: 'Failed to load safeApiService module'
      })
    };
  }
};

/**
 * Initialization step interface
 * 
 * CRITICAL: Step functions MUST check signal.aborted for proper timeout handling!
 * 
 * @example
 * // CORRECT: Step function respects abort signal
 * new InitializationStep('storage', async ({ signal }) => {
 *   if (signal?.aborted) throw new Error('Aborted');
 *   await AsyncStorage.getItem('key');
 *   if (signal?.aborted) throw new Error('Aborted');
 *   await AsyncStorage.setItem('key', 'value');
 * }, { timeout: 5000, critical: true });
 * 
 * // WRONG: Step function ignores abort signal (will not respect timeout)
 * new InitializationStep('storage', async ({ signal }) => {
 *   await AsyncStorage.getItem('key');     // No abort check - bad!
 *   await AsyncStorage.setItem('key', 'value'); // No abort check - bad!
 * }, { timeout: 5000, critical: true });
 */
class InitializationStep {
  /**
   * @param {string} name - Step name
   * @param {Function} fn - Step function that MUST accept { signal } and check signal.aborted
   * @param {Object} options - Step configuration
   * @param {boolean} options.critical - Whether step failure should fail entire initialization
   * @param {number} options.timeout - Timeout in milliseconds
   * @param {number} options.retries - Number of retry attempts
   * @param {string[]} options.dependencies - Names of steps this step depends on
   */
  constructor(name, fn, options = {}) {
    this.name = name;
    this.fn = fn;
    this.critical = options.critical ?? true;
    this.timeout = options.timeout ?? 10000;
    this.retries = options.retries ?? 0;
    this.dependencies = options.dependencies ?? [];
  }
}

/**
 * State Machine for Initialization Process
 * 
 * States: IDLE → INITIALIZING → SUCCESS
 *                    ↓
 *                  FAILED → RESET → IDLE
 */
class InitializationStateMachine {
  constructor() {
    this.state = 'IDLE';
    this.previousState = null;
    this.stateHistory = [];
    this.stateData = {};
    this.listeners = new Map();
  }

  /**
   * Valid state transitions
   */
  static TRANSITIONS = {
    'IDLE': ['INITIALIZING'],
    'INITIALIZING': ['SUCCESS', 'FAILED', 'RESET'], // Allow abort during initialization
    'SUCCESS': ['RESET'],
    'FAILED': ['RESET', 'FAILED'], // Allow FAILED → FAILED for repeated failures
    'RESET': ['IDLE']
  };

  /**
   * Transition to a new state
   * @param {string} newState - Target state
   * @param {Object} data - Additional state data
   * @returns {boolean} - True if transition succeeded, false if rejected
   */
  transition(newState, data = {}) {
    const validTransitions = InitializationStateMachine.TRANSITIONS[this.state] || [];
    
    if (!validTransitions.includes(newState)) {
      // CRITICAL FIX: Log warning but don't throw - especially for error states
      getLogger().warn(`Invalid transition from ${this.state} to ${newState}, current state retained`);
      
      // Store the attempted transition for debugging
      this.stateHistory.push({
        from: this.state,
        to: newState,
        timestamp: Date.now(),
        rejected: true,
        reason: `Invalid transition`,
        data: { ...data }
      });
      
      return false; // Indicate transition failed
    }

    this.previousState = this.state;
    this.state = newState;
    this.stateData = { ...this.stateData, ...data };
    this.stateHistory.push({
      from: this.previousState,
      to: newState,
      timestamp: Date.now(),
      data: { ...data }
    });

    // Notify listeners
    this.notifyListeners(newState, data);
    
    getLogger().debug(`State transition: ${this.previousState} → ${newState}`, data);
    return true; // Indicate transition succeeded
  }

  /**
   * Add state change listener
   */
  onStateChange(callback) {
    // FIX: Replace deprecated substr with substring
    const id = Math.random().toString(36).substring(2, 11);
    this.listeners.set(id, callback);
    return () => this.listeners.delete(id);
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners(newState, data) {
    this.listeners.forEach(callback => {
      try {
        callback(newState, data, this.previousState);
      } catch (error) {
        getLogger().error('State listener error:', error);
      }
    });
  }

  /**
   * Get current state info
   */
  getStateInfo() {
    return {
      current: this.state,
      previous: this.previousState,
      data: { ...this.stateData },
      history: [...this.stateHistory]
    };
  }

  /**
   * Check if in specific state
   */
  is(state) {
    return this.state === state;
  }

  /**
   * Check if can transition to state
   */
  canTransitionTo(state) {
    const validTransitions = InitializationStateMachine.TRANSITIONS[this.state] || [];
    return validTransitions.includes(state);
  }
}

// Centralized initialization manager with State Machine
class AppInitializer {
  constructor() {
    // STATE MACHINE: Replace boolean flags with proper state machine
    this.stateMachine = new InitializationStateMachine();
    this.initializationPromise = null;
    this.completedSteps = new Set();
    this.failedSteps = new Set();
    this.startTime = null;
    
    // AUTH INITIALIZER FIX: Track auth initializer state
    this.authInitializer = null;
    
    // Define initialization steps with dependencies
    this.steps = [
      new InitializationStep('env', async ({ signal }) => {
        // FIX: Check signal before environment validation
        if (signal?.aborted) throw new Error('Environment validation aborted');
        return getValidateEnv()();
      }, {
        critical: true,
        timeout: 1000,
        retries: 0
      }),
      
      new InitializationStep('config', async ({ signal }) => {
        // FIX: Check signal before expensive config initialization
        if (signal?.aborted) throw new Error('Config initialization aborted');
        return await getInitializeAppConfig()();
      }, {
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
      
      new InitializationStep('auth', async ({ signal }) => {
        // CRITICAL FIX: Fail explicitly if auth initializer wasn't set
        if (!this.authInitializer) {
          throw new Error('Auth initializer not set - call setAuthInitializer() before initialize()');
        }
        return this.authInitializer({ signal });
      }, {
        critical: false,
        timeout: 2000,
        retries: 1,
        dependencies: ['storage', 'api']
      })
    ];
  }

  // AUTH INITIALIZER FIX: Set auth initializer with proper validation
  setAuthInitializer(initializeAuth) {
    if (typeof initializeAuth !== 'function') {
      getLogger().error('setAuthInitializer called with non-function:', typeof initializeAuth);
      return;
    }
    
    this.authInitializer = initializeAuth;
    getLogger().debug('Auth initializer registered');
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

  // DEPENDENCY TIMEOUT FIX: Safer approach with non-critical dependency handling
  async waitForDependencies(step, signal) {
    if (!step.dependencies || step.dependencies.length === 0) {
      return;
    }

    // PERFORMANCE FIX: Circular dependency check moved to initialization time

    const DEPENDENCY_TIMEOUT = 10000;
    const CHECK_INTERVAL = 100;
    // Add a "give up on non-critical" fallback
    const MAX_WAIT_FOR_NON_CRITICAL = 5000; // 5 seconds
    const startTime = Date.now();
    
    getLogger().debug(`Waiting for dependencies for step '${step.name}': [${step.dependencies.join(', ')}]`);

    while (!this.areDependenciesSatisfied(step)) {
      const elapsed = Date.now() - startTime;
      
      // Check: Are we only waiting on non-critical dependencies?
      const pendingDeps = step.dependencies.filter(dep => {
        return !this.completedSteps.has(dep) && !this.failedSteps.has(dep);
      });
      
      const allPendingAreNonCritical = pendingDeps.every(dep => {
        const depStep = this.steps.find(s => s.name === dep);
        return depStep && !depStep.critical;
      });
      
      if (allPendingAreNonCritical && elapsed > MAX_WAIT_FOR_NON_CRITICAL) {
        getLogger().warn(
          `Giving up on non-critical dependencies after ${elapsed}ms: ${pendingDeps.join(', ')}`
        );
        getLogger().info(
          `Step '${step.name}' will proceed without non-critical dependencies: ${pendingDeps.join(', ')}`
        );
        // Mark them as "skipped" instead of waiting forever
        pendingDeps.forEach(dep => {
          this.failedSteps.add(dep);
          getLogger().debug(`Marked non-critical dependency '${dep}' as skipped due to timeout`);
        });
        break;
      }
      
      if (elapsed > DEPENDENCY_TIMEOUT) {
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
      
      if (elapsed > 0 && elapsed % 5000 < CHECK_INTERVAL) {
        const remainingPendingDeps = step.dependencies.filter(dep => !this.completedSteps.has(dep));
        getLogger().warn(`Still waiting for dependencies (${elapsed}ms): ${remainingPendingDeps.join(', ')}`);
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
            // CRITICAL: Remove listener!
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

  // PERFORMANCE FIX: Validate all dependencies once at initialization time
  validateAllDependencies() {
    const startTime = Date.now();
    
    // Check for circular dependencies in all steps
    for (const step of this.steps) {
      const circularDep = this.detectCircularDependency(step.name, step.dependencies);
      if (circularDep) {
        const errorMsg = `Circular dependency detected: ${circularDep}`;
        getLogger().error(errorMsg);
        throw new Error(errorMsg);
      }
    }
    
    // Check for missing dependencies
    const allStepNames = new Set(this.steps.map(s => s.name));
    for (const step of this.steps) {
      for (const dep of step.dependencies || []) {
        if (!allStepNames.has(dep)) {
          const errorMsg = `Step '${step.name}' depends on unknown step '${dep}'`;
          getLogger().error(errorMsg);
          throw new Error(errorMsg);
        }
      }
    }
    
    const validationTime = Date.now() - startTime;
    getLogger().debug(`Dependency validation completed in ${validationTime}ms for ${this.steps.length} steps`);
  }

  /**
   * Execute a single step with timeout and retry logic
   * 
   * CRITICAL: Step functions MUST check signal.aborted to respect timeouts!
   * 
   * @param {InitializationStep} step - The step to execute
   * @param {AbortSignal} signal - Abort signal for cancellation (MUST be checked by step function)
   * @param {Function} onProgress - Progress callback
   * 
   * @example
   * // CORRECT: Step function checks signal.aborted
   * new InitializationStep('storage', async ({ signal }) => {
   *   if (signal?.aborted) throw new Error('Aborted');
   *   await AsyncStorage.getItem('key');
   *   if (signal?.aborted) throw new Error('Aborted'); 
   *   await AsyncStorage.setItem('key', 'value');
   * });
   * 
   * // WRONG: Step function ignores signal
   * new InitializationStep('storage', async ({ signal }) => {
   *   await AsyncStorage.getItem('key');     // No signal check
   *   await AsyncStorage.setItem('key', 'value'); // No signal check
   * });
   */
  async executeStep(step, signal, onProgress) {
    const startTime = Date.now();
    let lastError = null;
    
    for (let attempt = 1; attempt <= step.retries + 1; attempt++) {
      if (signal?.aborted) {
        throw new Error(`Initialization aborted during step '${step.name}'`);
      }
      
      try {
        // CRASH FIX: Use logger instead of direct console.log
        getLogger().info(`Executing initialization step '${step.name}' (attempt ${attempt}/${step.retries + 1})`);
        getLogger().debug(`Executing step '${step.name}' (attempt ${attempt}/${step.retries + 1})`);
        
        // ENHANCED: Pass signal to step function with validation
        const stepPromise = typeof step.fn === 'function' 
          ? step.fn({ signal }) 
          : Promise.resolve(step.fn);
          
        // CRITICAL: Warn if step function doesn't seem to handle signal properly
        if (typeof step.fn === 'function' && step.timeout > 1000) {
          // For longer-running steps, log a reminder about signal handling
          getLogger().debug(`Step '${step.name}' timeout: ${step.timeout}ms - ensure it checks signal.aborted`);
        }
        
        // CRITICAL FIX: Manual timeout/cancellation management to prevent uncaught promise rejections
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
            // SAFETY: Catch any remaining promise rejections
            if (!settled) {
              settled = true;
              cleanup();
              reject(error);
            }
          });
        });
        
        const duration = Date.now() - startTime;
        getLogger().debug(`Step '${step.name}' completed in ${duration}ms`);
        
        // CRITICAL FIX: Mark step as completed
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
        
        // CRASH FIX: Use logger instead of direct console.error
        getLogger().error(`Step '${step.name}' failed (attempt ${attempt}/${step.retries + 1}):`, error.message);
        getLogger().error(`Step '${step.name}' error details:`, {
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
                // CRITICAL: Remove listener!
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
    
    // CRITICAL FIX: Mark step as failed
    this.failedSteps.add(step.name);
    
    const error = new Error(`Step '${step.name}' failed after ${step.retries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
    error.originalError = lastError;
    throw error;
  }

  // STATE MACHINE: Main initialization method with state machine management
  async initialize(options = {}) {
    // IDEMPOTENCY: If already successfully initialized, just return
    if (this.stateMachine.is('SUCCESS')) {
      return Promise.resolve({ success: true, message: 'Already initialized' });
    }

    // DEBOUNCE: If currently initializing, wait for that attempt
    if (this.stateMachine.is('INITIALIZING') && this.initializationPromise) {
      return this.initializationPromise;
    }

    // FAILURE RECOVERY: Check if we're in a failed state
    if (this.stateMachine.is('FAILED')) {
      const failedStepNames = Array.from(this.failedSteps).join(', ');
      getLogger().warn(`Previous initialization failed at: ${failedStepNames}`);
      
      // Require explicit reset before retry (safer)
      throw new Error(
        `Cannot re-initialize without reset. Failed steps: ${failedStepNames}. ` +
        `Call appInitializer.reset() first. Current state: ${this.stateMachine.state}`
      );
    }

    // STATE TRANSITION: Move to INITIALIZING state
    if (!this.stateMachine.canTransitionTo('INITIALIZING')) {
      throw new Error(`Cannot initialize from current state: ${this.stateMachine.state}`);
    }

    this.stateMachine.transition('INITIALIZING', {
      startTime: Date.now(),
      options: { ...options }
    });

    this.initializationPromise = this._performInitialization(options)
      .then(
        (result) => {
          // SUCCESS: Transition to SUCCESS state
          this.stateMachine.transition('SUCCESS', {
            completedAt: Date.now(),
            result
          });
          return result;
        },
        (error) => {
          // FAILURE: Attempt to transition to FAILED state (safe - won't throw)
          const transitionSucceeded = this.stateMachine.transition('FAILED', {
            failedAt: Date.now(),
            error: error.message,
            failedSteps: Array.from(this.failedSteps)
          });
          
          if (!transitionSucceeded) {
            // ALREADY IN FAILED STATE: Update state data without transition
            this.stateMachine.stateData = {
              ...this.stateMachine.stateData,
              lastFailedAt: Date.now(),
              lastError: error.message,
              lastFailedSteps: Array.from(this.failedSteps)
            };
            getLogger().warn('Already in FAILED state, updated failure data without transition');
          }
          
          this.initializationPromise = null;
          throw error; // CRITICAL: Always throw the original error
        }
      );

    return this.initializationPromise;
  }

  async _performInitialization(options = {}) {
    const { signal, onProgress } = options;
    
    const GLOBAL_TIMEOUT = 15000;
    let globalTimeoutId = null;
    
    // FIX: Create AbortController for global timeout that actually aborts operations
    const globalAbortController = new AbortController();
    const combinedSignal = signal ? this._combineAbortSignals(signal, globalAbortController.signal) : globalAbortController.signal;
    
    // PROPER CANCELLATION: Use manual timeout with AbortController instead of Promise.race
    let timeoutId = null;
    let isTimedOut = false;
    
    try {
      // Note: isInitializing already set in initialize() method
      this.startTime = Date.now();
      
      getLogger().info('Starting centralized app initialization with 15s global timeout...');
      
      // PERFORMANCE FIX: Validate all dependencies once upfront (O(n²) but only once)
      this.validateAllDependencies();
      
      // Set up timeout that properly cancels operations
      timeoutId = setTimeout(() => {
        isTimedOut = true;
        globalAbortController.abort();
        getLogger().error(`Global initialization timeout after ${GLOBAL_TIMEOUT}ms - operations cancelled`);
      }, GLOBAL_TIMEOUT);
      
      const initializationLogic = async () => {
        this.completedSteps.clear();
        this.failedSteps.clear();

        const totalSteps = this.steps.length;
        let completedCount = 0;

        // PARALLEL INITIALIZATION: Group steps by dependency levels for parallel execution
        const stepsByLevel = this._groupStepsByDependencyLevel();
        getLogger().info(`Parallel initialization: ${stepsByLevel.length} levels`, 
          stepsByLevel.map((level, i) => `Level ${i}: [${level.map(s => s.name).join(', ')}]`));

        // Execute each level in parallel, but levels sequentially
        for (let levelIndex = 0; levelIndex < stepsByLevel.length; levelIndex++) {
          const currentLevel = stepsByLevel[levelIndex];
          
          if (combinedSignal?.aborted) {
            throw new Error('Initialization aborted');
          }

          getLogger().debug(`Executing level ${levelIndex} with ${currentLevel.length} parallel steps: [${currentLevel.map(s => s.name).join(', ')}]`);

          // PARALLEL EXECUTION: Run all steps in current level simultaneously
          const levelPromises = currentLevel.map(async (step) => {
            try {
              await this.executeStep(step, combinedSignal, (stepProgress) => {
                // CANCELLATION CHECK: Don't update progress if cancelled or timed out
                if (isTimedOut || combinedSignal?.aborted) {
                  return; // Silently ignore progress updates after cancellation
                }
                
                // Forward individual step progress
                if (onProgress) {
                  onProgress({
                    step: step.name,
                    progress: (completedCount + stepProgress.progress) / totalSteps,
                    message: stepProgress.message || `${step.name} in progress...`,
                    completed: completedCount,
                    total: totalSteps,
                    levelIndex,
                    stepProgress
                  });
                }
              });
              
              completedCount++;
              getLogger().debug(`Step '${step.name}' completed (${completedCount}/${totalSteps})`);
              
              return { step: step.name, success: true };
            } catch (error) {
              getLogger().error(`Step '${step.name}' failed:`, error);
              return { step: step.name, success: false, error };
            }
          });

          // Wait for all steps in current level to complete
          const levelResults = await Promise.allSettled(levelPromises);
          
          // CANCELLATION CHECK: Stop processing if cancelled or timed out
          if (isTimedOut || combinedSignal?.aborted) {
            throw new Error('Initialization cancelled during level execution');
          }
          
          // DEBUGGING FIX: Check for critical failures with full error context preservation
          const failures = levelResults
            .map((result, i) => ({ result, step: currentLevel[i] }))
            .filter(({ result }) => result.status === 'rejected' || !result.value?.success)
            .map(({ step, result }) => {
              const error = result.status === 'rejected' ? result.reason : result.value?.error;
              return { 
                step: step.name, 
                critical: step.critical,
                error,
                // PRESERVE FULL ERROR CONTEXT: Keep original error object with stack trace
                originalError: error,
                errorMessage: error?.message || String(error),
                errorStack: error?.stack,
                errorName: error?.name,
                resultStatus: result.status,
                fullResult: result // Keep complete result for debugging
              };
            });

          if (failures.length > 0) {
            // LOG DETAILED ERROR INFORMATION: Log full context for all failures
            failures.forEach(failure => {
              const logLevel = failure.critical ? 'error' : 'warn';
              getLogger()[logLevel](`Step '${failure.step}' failed:`, {
                message: failure.errorMessage,
                stack: failure.errorStack,
                name: failure.errorName,
                critical: failure.critical,
                resultStatus: failure.resultStatus
              });
              
              // STACK TRACE PRESERVATION: Log full stack trace for debugging
              // CRASH FIX: Use typeof check to prevent ReferenceError in production
              if (failure.errorStack && typeof __DEV__ !== 'undefined' && __DEV__) {
                getLogger().debug(`Full stack trace for '${failure.step}':`, failure.errorStack);
              }
            });

            const criticalFailures = failures.filter(f => f.critical);
            
            if (criticalFailures.length > 0) {
              const criticalSteps = criticalFailures.map(f => f.step).join(', ');
              
              // ENHANCED ERROR: Include first critical error details in thrown error
              const firstCriticalError = criticalFailures[0];
              const enhancedError = new Error(
                `Critical steps failed in level ${levelIndex}: ${criticalSteps}. ` +
                `First failure: ${firstCriticalError.errorMessage}`
              );
              enhancedError.cause = firstCriticalError.originalError;
              enhancedError.failedSteps = criticalFailures;
              enhancedError.levelIndex = levelIndex;
              
              throw enhancedError;
            } else {
              // NON-CRITICAL FAILURES: Enhanced logging with error details
              const nonCriticalSteps = failures.map(f => f.step).join(', ');
              const errorSummary = failures.map(f => `${f.step}: ${f.errorMessage}`).join('; ');
              getLogger().warn(
                `Non-critical steps failed in level ${levelIndex}, continuing: ${nonCriticalSteps}. ` +
                `Errors: ${errorSummary}`
              );
            }
          }

          getLogger().info(`Level ${levelIndex} completed (${completedCount}/${totalSteps} total steps done)`);
        }

        const initTime = Date.now() - this.startTime;
        getLogger().info(`App initialization completed in ${initTime}ms`);
        
        // STATE MACHINE: Success state will be set by the calling initialize() method

        // CRASH FIX: Use typeof check to prevent ReferenceError in production
        if ((typeof __DEV__ === 'undefined' || !__DEV__) && global.Analytics) {
          global.Analytics.track('app_initialization_success', {
            duration: initTime,
            completedSteps: Array.from(this.completedSteps),
            failedSteps: Array.from(this.failedSteps)
          });
        }
      };

      // SAFE EXECUTION: Run initialization with proper cancellation handling
      await initializationLogic();
      
      // SUCCESS: Clear timeout if we completed before timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // CANCELLATION CHECK: Ensure we didn't complete after being cancelled
      if (isTimedOut || combinedSignal?.aborted) {
        throw new Error('Initialization was cancelled or timed out');
      }

    } catch (error) {
      // CLEANUP: Always clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // STATE MACHINE: Failure state will be set by the calling initialize() method
      // Clear promise to allow retry (will be set to null in initialize() method)
      
      // Abort any ongoing operations
      if (!globalAbortController.signal.aborted) {
        globalAbortController.abort();
      }
      
      // TIMEOUT HANDLING: Provide specific error for timeout cases
      if (isTimedOut) {
        const timeoutError = new Error(`Initialization timed out after ${GLOBAL_TIMEOUT}ms`);
        timeoutError.code = 'INITIALIZATION_TIMEOUT';
        throw timeoutError;
      }
      
      const initTime = this.startTime ? Date.now() - this.startTime : 0;
      getLogger().error('App initialization failed:', error);
      
      // Log partial state for debugging
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
      // CRASH FIX: Reference correct variable (timeoutId, not globalTimeoutId)
      // Note: timeoutId cleanup is already handled in try/catch blocks above
      // This finally block is kept for safety but the timeout should already be cleared
    }
  }

  // STATE MACHINE: Get initialization status with state machine info
  getStatus() {
    const stateInfo = this.stateMachine.getStateInfo();
    return {
      // Legacy compatibility
      isInitialized: this.stateMachine.is('SUCCESS'),
      isInitializing: this.stateMachine.is('INITIALIZING'),
      
      // Enhanced state machine info
      state: stateInfo.current,
      previousState: stateInfo.previous,
      stateData: stateInfo.data,
      stateHistory: stateInfo.history,
      
      // Step progress
      completedSteps: Array.from(this.completedSteps),
      failedSteps: Array.from(this.failedSteps),
      progress: this.completedSteps.size / this.steps.length,
      
      // Timing info
      startTime: this.startTime,
      duration: this.startTime ? Date.now() - this.startTime : null
    };
  }

  // Helper method to combine multiple abort signals
  _combineAbortSignals(signal1, signal2) {
    if (!signal1 && !signal2) return null;
    if (!signal1) return signal2;
    if (!signal2) return signal1;
    
    const controller = new AbortController();
    
    // MEMORY LEAK FIX: Create separate handlers that clean up the other listener
    let abortHandler1 = null;
    let abortHandler2 = null;
    
    abortHandler1 = () => {
      // Remove the other listener to prevent memory leak
      if (abortHandler2 && signal2?.removeEventListener) {
        signal2.removeEventListener('abort', abortHandler2);
      }
      controller.abort();
    };
    
    abortHandler2 = () => {
      // Remove the other listener to prevent memory leak
      if (abortHandler1 && signal1?.removeEventListener) {
        signal1.removeEventListener('abort', abortHandler1);
      }
      controller.abort();
    };
    
    if (!signal1.aborted && !signal2.aborted) {
      signal1.addEventListener('abort', abortHandler1, { once: true });
      signal2.addEventListener('abort', abortHandler2, { once: true });
    } else {
      // If either is already aborted, abort immediately
      controller.abort();
    }
    
    return controller.signal;
  }

  // STATE MACHINE: Reset initialization state with proper state transitions
  reset() {
    // CRITICAL FIX: Check if reset is valid from current state
    if (!this.stateMachine.canTransitionTo('RESET')) {
      getLogger().warn(`Cannot reset from state: ${this.stateMachine.state}`);
      return false;
    }
    
    // Transition through RESET state to IDLE
    const resetSucceeded = this.stateMachine.transition('RESET', {
      resetAt: Date.now(),
      reason: 'Manual reset',
      wasInitializing: this.stateMachine.state === 'INITIALIZING'
    });
    
    if (!resetSucceeded) {
      getLogger().error('Failed to transition to RESET state');
      return false;
    }
    
    // Clear all state
    this.initializationPromise = null;
    this.completedSteps.clear();
    this.failedSteps.clear();
    this.startTime = null;
    
    // Transition to IDLE state
    const idleSucceeded = this.stateMachine.transition('IDLE', {
      resetCompletedAt: Date.now()
    });
    
    if (!idleSucceeded) {
      getLogger().error('Failed to transition to IDLE state after reset');
      return false;
    }
    
    getLogger().info('AppInitializer reset to IDLE state');
    return true;
  }

  // Add custom initialization step
  addStep(name, fn, options = {}) {
    const step = new InitializationStep(name, fn, options);
    this.steps.push(step);
    
    // PERFORMANCE NOTE: Dependency validation will run once at initialization time
    // No need to validate here unless explicitly requested for immediate feedback
    if (options.validateImmediately) {
      this.validateAllDependencies();
    }
    
    return step;
  }

  /**
   * PARALLEL INITIALIZATION: Group steps by dependency levels for parallel execution
   * Steps with no dependencies can run in parallel (level 0)
   * Steps that depend on level 0 steps run in level 1, etc.
   * 
   * @returns {Array<Array<InitializationStep>>} Array of levels, each containing steps that can run in parallel
   */
  _groupStepsByDependencyLevel() {
    const levels = [];
    const processedSteps = new Set();
    const stepMap = new Map(this.steps.map(step => [step.name, step]));

    // Helper function to get the maximum dependency level for a step
    const getStepLevel = (step, visiting = new Set()) => {
      if (visiting.has(step.name)) {
        throw new Error(`Circular dependency detected involving step: ${step.name}`);
      }
      
      if (!step.dependencies || step.dependencies.length === 0) {
        return 0; // No dependencies = level 0
      }

      visiting.add(step.name);
      
      let maxLevel = 0;
      for (const depName of step.dependencies) {
        const depStep = stepMap.get(depName);
        if (depStep) {
          const depLevel = getStepLevel(depStep, visiting);
          maxLevel = Math.max(maxLevel, depLevel + 1);
        }
      }
      
      visiting.delete(step.name);
      return maxLevel;
    };

    // Calculate level for each step
    const stepLevels = new Map();
    for (const step of this.steps) {
      if (!processedSteps.has(step.name)) {
        const level = getStepLevel(step);
        stepLevels.set(step.name, level);
        processedSteps.add(step.name);
      }
    }

    // Group steps by level
    for (const step of this.steps) {
      const level = stepLevels.get(step.name);
      if (!levels[level]) {
        levels[level] = [];
      }
      levels[level].push(step);
    }

    // Remove any empty levels
    return levels.filter(level => level && level.length > 0);
  }

  /**
   * Get the state machine instance for advanced monitoring
   * @returns {InitializationStateMachine} The state machine instance
   */
  getStateMachine() {
    return this.stateMachine;
  }

  /**
   * Add a listener for state changes
   * @param {Function} callback - Callback function (newState, data, previousState) => void
   * @returns {Function} Unsubscribe function
   */
  onStateChange(callback) {
    return this.stateMachine.onStateChange(callback);
  }

  /**
   * Utility method to check abort signal - use this in step functions
   * 
   * @param {AbortSignal} signal - The abort signal to check
   * @param {string} stepName - Name of the step (for error messages)
   * @throws {Error} If the signal is aborted
   * 
   * @example
   * // Use in step functions:
   * new InitializationStep('myStep', async ({ signal }) => {
   *   AppInitializer.checkAborted(signal, 'myStep');
   *   await someAsyncOperation();
   *   AppInitializer.checkAborted(signal, 'myStep');
   *   await anotherAsyncOperation();
   * });
   */
  static checkAborted(signal, stepName = 'unknown') {
    if (signal?.aborted) {
      throw new Error(`Step '${stepName}' aborted`);
    }
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

