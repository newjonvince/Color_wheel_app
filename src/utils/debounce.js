// utils/debounce.js - Simple debounce utility function
/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * 
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @param {Object} options - Options object
 * @param {boolean} options.leading - Specify invoking on the leading edge of the timeout
 * @param {boolean} options.trailing - Specify invoking on the trailing edge of the timeout
 * @returns {Function} Returns the new debounced function
 */
export function debounce(func, wait = 300, options = {}) {
  let timeoutId;
  let lastArgs;
  let lastThis;
  let result;
  let lastCallTime;
  let lastInvokeTime = 0;
  
  const { leading = false, trailing = true } = options;
  
  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;
    
    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    return result;
  }
  
  function leadingEdge(time) {
    // Reset any `maxWait` timer.
    lastInvokeTime = time;
    // Start the timer for the trailing edge.
    timeoutId = setTimeout(timerExpired, wait);
    // Invoke the leading edge.
    return leading ? invokeFunc(time) : result;
  }
  
  function remainingWait(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastCall;
    
    return timeWaiting;
  }
  
  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    
    // Either this is the first call, activity has stopped and we're at the
    // trailing edge, the system time has gone backwards and we're treating
    // it as the trailing edge, or we've hit the `maxWait` limit.
    return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
            (timeSinceLastCall < 0) || (timeSinceLastInvoke >= wait));
  }
  
  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    // Restart the timer.
    timeoutId = setTimeout(timerExpired, remainingWait(time));
  }
  
  function trailingEdge(time) {
    timeoutId = undefined;
    
    // Only invoke if we have `lastArgs` which means `func` has been
    // debounced at least once.
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  }
  
  function cancel() {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timeoutId = undefined;
  }
  
  function flush() {
    return timeoutId === undefined ? result : trailingEdge(Date.now());
  }
  
  function pending() {
    return timeoutId !== undefined;
  }
  
  function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);
    
    lastArgs = args;
    lastThis = this;
    lastCallTime = time;
    
    if (isInvoking) {
      if (timeoutId === undefined) {
        return leadingEdge(lastCallTime);
      }
    }
    if (timeoutId === undefined) {
      timeoutId = setTimeout(timerExpired, wait);
    }
    return result;
  }
  
  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.pending = pending;
  
  return debounced;
}

// Default export for convenience
export default debounce;
