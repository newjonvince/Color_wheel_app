// utils/abortUtils.js - Standardized abort signal handling utilities

/**
 * Check if an abort signal is aborted and throw appropriate error
 * @param {AbortSignal} signal - The abort signal to check
 * @param {string} operation - Name of the operation being aborted
 * @throws {Error} If signal is aborted
 */
export const checkAborted = (signal, operation = 'Operation') => {
  if (signal?.aborted) {
    throw new Error(`${operation} aborted`);
  }
};

/**
 * Create a cancellable timeout that respects abort signals
 * @param {number} ms - Timeout in milliseconds
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise} Promise that resolves after timeout or rejects if aborted
 */
export const cancellableTimeout = (ms, signal) => {
  return new Promise((resolve, reject) => {
    // Check if already aborted
    if (signal?.aborted) {
      reject(new Error('Timeout aborted'));
      return;
    }

    const timeoutId = setTimeout(() => {
      resolve();
    }, ms);

    // Listen for abort signal
    if (signal?.addEventListener) {
      const abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new Error('Timeout aborted'));
      };
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  });
};

/**
 * Wrap a promise with abort signal support
 * @param {Promise} promise - The promise to wrap
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @param {string} operation - Name of the operation for error messages
 * @returns {Promise} Promise that rejects if aborted
 */
export const withAbortSignal = (promise, signal, operation = 'Operation') => {
  if (!signal) {
    return promise;
  }

  return new Promise((resolve, reject) => {
    // Check if already aborted
    if (signal.aborted) {
      reject(new Error(`${operation} aborted`));
      return;
    }

    // Listen for abort signal
    const abortHandler = () => {
      reject(new Error(`${operation} aborted`));
    };
    signal.addEventListener('abort', abortHandler, { once: true });

    // Handle promise resolution/rejection
    promise.then(
      (result) => {
        signal.removeEventListener('abort', abortHandler);
        if (signal.aborted) {
          reject(new Error(`${operation} aborted`));
        } else {
          resolve(result);
        }
      },
      (error) => {
        signal.removeEventListener('abort', abortHandler);
        reject(error);
      }
    );
  });
};

/**
 * Create a race between a promise and an abort signal
 * @param {Promise} promise - The promise to race
 * @param {AbortSignal} signal - Abort signal
 * @param {string} operation - Operation name for error messages
 * @returns {Promise} Promise that resolves with the promise result or rejects if aborted
 */
export const raceWithAbort = (promise, signal, operation = 'Operation') => {
  if (!signal) {
    return promise;
  }

  const abortPromise = new Promise((_, reject) => {
    if (signal.aborted) {
      reject(new Error(`${operation} aborted`));
      return;
    }

    signal.addEventListener('abort', () => {
      reject(new Error(`${operation} aborted`));
    }, { once: true });
  });

  return Promise.race([promise, abortPromise]);
};

/**
 * Check if an error is an abort error
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error is an abort error
 */
export const isAbortError = (error) => {
  return error?.name === 'AbortError' || 
         error?.message?.includes('aborted') ||
         error?.message?.includes('cancelled');
};

/**
 * Safe error handler that doesn't throw abort errors to unmounted components
 * @param {Error} error - The error to handle
 * @param {function} errorHandler - Function to call for non-abort errors
 * @param {string} operation - Operation name for logging
 */
export const handleAbortableError = (error, errorHandler, operation = 'Operation') => {
  if (isAbortError(error)) {
    console.debug(`${operation} was cancelled gracefully`);
    return;
  }
  
  if (typeof errorHandler === 'function') {
    errorHandler(error);
  }
};

/**
 * Create an AbortController with timeout
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Object} Object with controller, signal, and cancel function
 */
export const createTimedAbortController = (timeoutMs) => {
  const controller = new AbortController();
  
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  
  const cancel = () => {
    clearTimeout(timeoutId);
    controller.abort();
  };
  
  return {
    controller,
    signal: controller.signal,
    cancel
  };
};

/**
 * Standardized abort signal patterns for common operations
 */
export const AbortPatterns = {
  /**
   * Network request with timeout and abort support
   */
  networkRequest: async (requestFn, { signal, timeout = 30000, operation = 'Network request' } = {}) => {
    const { controller: timeoutController, cancel } = createTimedAbortController(timeout);
    
    try {
      // Combine external signal with timeout signal
      const combinedSignal = signal || timeoutController.signal;
      
      const result = await withAbortSignal(
        requestFn(combinedSignal),
        combinedSignal,
        operation
      );
      
      cancel(); // Clear timeout
      return result;
    } catch (error) {
      cancel(); // Clear timeout
      throw error;
    }
  },

  /**
   * Storage operation with abort support
   */
  storageOperation: async (storageFn, { signal, operation = 'Storage operation' } = {}) => {
    checkAborted(signal, operation);
    
    try {
      const result = await storageFn();
      checkAborted(signal, operation); // Check again after async operation
      return result;
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(`${operation} aborted`);
      }
      throw error;
    }
  },

  /**
   * Initialization sequence with abort support
   */
  initializationSequence: async (steps, { signal, operation = 'Initialization' } = {}) => {
    const results = [];
    
    for (let i = 0; i < steps.length; i++) {
      checkAborted(signal, `${operation} step ${i + 1}`);
      
      try {
        const result = await steps[i]({ signal });
        results.push(result);
        
        checkAborted(signal, `${operation} step ${i + 1}`);
      } catch (error) {
        if (isAbortError(error)) {
          throw new Error(`${operation} aborted at step ${i + 1}`);
        }
        throw error;
      }
    }
    
    return results;
  }
};
