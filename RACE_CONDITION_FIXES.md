# Race Condition Fixes for App.js

## Critical Race Conditions Identified

### 1. **State Update Race Condition**
**Location**: Lines 235-256 (setTimeout in initialization)
**Problem**: Multiple async state updates can conflict

**Fix**: Use atomic state updates with useRef flags
```javascript
// Add ref to track initialization completion
const initializationCompleteRef = useRef(false);

// Replace the setTimeout section with:
if (isMounted && !initializationCompleteRef.current) {
  initializationCompleteRef.current = true;
  
  // Use single atomic state update
  const finalizeInitialization = () => {
    if (isMounted && !controller?.signal?.aborted) {
      setIsReady(true);
    }
  };
  
  // Use requestAnimationFrame for better timing
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(finalizeInitialization);
  } else {
    setTimeout(finalizeInitialization, 100); // Shorter delay
  }
}
```

### 2. **Promise Rejection Handler Race**
**Location**: Lines 281-299 (initialize().catch)
**Problem**: Catch handler can override successful initialization

**Fix**: Add completion tracking
```javascript
// Add ref to track initialization state
const initializationStateRef = useRef('pending'); // 'pending' | 'success' | 'error'

// In the try block of initialize():
if (isMounted) {
  initializationStateRef.current = 'success';
  setLoadingState({ stage: 'ready', progress: 100, message: 'Ready!' });
  // ... rest of success logic
}

// In the catch handler:
initialize().catch((error) => {
  if (!isMounted || controller?.signal?.aborted || initializationStateRef.current === 'success') {
    return; // Don't override successful initialization
  }
  
  initializationStateRef.current = 'error';
  logger.error('🚨 Unhandled initialization error:', error);
  setInitError(error);
  
  if (isMounted) {
    setIsReady(false);
    setLoadingState({
      stage: 'error',
      progress: 0,
      message: 'Initialization failed'
    });
  }
});
```

### 3. **Auth State Loading Race**
**Location**: Lines 399-401 (loading state calculation)
**Problem**: Multiple boolean checks without coordination

**Fix**: Use useMemo for atomic loading state calculation
```javascript
// Replace the loading calculation with useMemo:
const loadingState = useMemo(() => {
  // Capture all values at once to prevent races
  const currentIsReady = isReady;
  const currentAuthLoading = authLoading;
  const currentIsInitialized = isInitialized;
  
  const isAppLoading = !currentIsReady;
  const isAuthSystemLoading = currentIsReady && (currentAuthLoading || !currentIsInitialized);
  
  return {
    shouldShowLoading: isAppLoading || isAuthSystemLoading,
    isAppLoading,
    isAuthSystemLoading
  };
}, [isReady, authLoading, isInitialized]);

// Use the memoized state:
if (loadingState.shouldShowLoading) {
  // ... loading UI
}
```

### 4. **Restart Button Race Condition**
**Location**: Lines 333-382 (restart button handler)
**Problem**: Multiple restart mechanisms can execute simultaneously

**Fix**: Add restart state management
```javascript
// Add restart state ref
const isRestartingRef = useRef(false);

// Replace the restart handler:
onPress={async () => {
  if (isRestartingRef.current) {
    return; // Prevent multiple restart attempts
  }
  
  isRestartingRef.current = true;
  logger.info('🔄 User requested app restart');
  
  try {
    // Try methods in sequence with proper error handling
    let restartSuccessful = false;
    
    // Method 1: Expo Updates
    if (!restartSuccessful && global.Updates?.reloadAsync) {
      try {
        logger.info('🔄 Restarting via Expo Updates...');
        await global.Updates.reloadAsync();
        restartSuccessful = true;
      } catch (error) {
        logger.warn('Expo Updates restart failed:', error);
      }
    }
    
    // Method 2: DevSettings (only if Method 1 failed)
    if (!restartSuccessful && global.DevSettings?.reload) {
      try {
        logger.info('🔄 Restarting via DevSettings...');
        global.DevSettings.reload();
        restartSuccessful = true;
      } catch (error) {
        logger.warn('DevSettings restart failed:', error);
      }
    }
    
    // Method 3: Web reload (only if previous methods failed)
    if (!restartSuccessful && typeof window !== 'undefined' && window.location) {
      try {
        logger.info('🔄 Restarting via window.location.reload...');
        window.location.reload();
        restartSuccessful = true;
      } catch (error) {
        logger.warn('Web restart failed:', error);
      }
    }
    
    // Method 4: State reset (only if all else failed)
    if (!restartSuccessful) {
      logger.warn('🔄 No restart mechanism available, attempting state reset...');
      
      // Atomic state reset
      setInitError(null);
      setIsReady(false);
      setLoadingState({
        stage: 'initializing',
        progress: 0,
        message: 'Restarting...'
      });
      
      // Reset initializer and restart
      if (appInitializer?.reset) {
        appInitializer.reset();
      }
      
      // Restart after brief delay
      setTimeout(() => {
        if (appInitializer?.initialize && !controller?.signal?.aborted) {
          appInitializer.initialize().catch((error) => {
            logger.error('🚨 Restart initialization failed:', error);
            setInitError(error);
          });
        }
      }, 100);
    }
    
  } catch (error) {
    logger.error('🚨 Restart failed:', error);
    setInitError(new Error(`Restart failed: ${error.message}`));
  } finally {
    // Reset restart flag after a delay to prevent rapid clicking
    setTimeout(() => {
      isRestartingRef.current = false;
    }, 2000);
  }
}}
```

## Additional Race Condition Prevention

### 5. **Add State Synchronization Hook**
```javascript
// Add this custom hook to prevent state update races
const useAtomicState = (initialState) => {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(initialState);
  const updateQueueRef = useRef([]);
  const isUpdatingRef = useRef(false);
  
  const atomicSetState = useCallback((newState) => {
    updateQueueRef.current.push(newState);
    
    if (!isUpdatingRef.current) {
      isUpdatingRef.current = true;
      
      // Process all queued updates atomically
      const processUpdates = () => {
        if (updateQueueRef.current.length > 0) {
          const latestUpdate = updateQueueRef.current.pop();
          updateQueueRef.current = []; // Clear queue
          
          stateRef.current = latestUpdate;
          setState(latestUpdate);
        }
        isUpdatingRef.current = false;
      };
      
      // Use microtask to batch updates
      Promise.resolve().then(processUpdates);
    }
  }, []);
  
  return [state, atomicSetState, stateRef.current];
};

// Use in component:
const [appState, setAppState, currentAppState] = useAtomicState({
  isReady: false,
  initError: null,
  loadingState: { stage: 'initializing', progress: 0, message: 'Starting...' }
});
```

### 6. **Add Initialization State Machine**
```javascript
// Define clear initialization states
const INIT_STATES = {
  IDLE: 'idle',
  INITIALIZING: 'initializing', 
  SUCCESS: 'success',
  ERROR: 'error',
  RESTARTING: 'restarting'
};

// Use reducer for state transitions
const initReducer = (state, action) => {
  switch (action.type) {
    case 'START_INIT':
      return state.status === INIT_STATES.IDLE ? 
        { ...state, status: INIT_STATES.INITIALIZING } : state;
        
    case 'INIT_SUCCESS':
      return state.status === INIT_STATES.INITIALIZING ?
        { ...state, status: INIT_STATES.SUCCESS, error: null } : state;
        
    case 'INIT_ERROR':
      return state.status === INIT_STATES.INITIALIZING ?
        { ...state, status: INIT_STATES.ERROR, error: action.error } : state;
        
    case 'START_RESTART':
      return { ...state, status: INIT_STATES.RESTARTING };
      
    default:
      return state;
  }
};

// Use in component:
const [initState, dispatch] = useReducer(initReducer, {
  status: INIT_STATES.IDLE,
  error: null
});
```

## Testing Race Conditions

### Stress Test Scenarios:
1. **Rapid Navigation**: Navigate away and back during initialization
2. **Multiple Restarts**: Click restart button rapidly
3. **Network Interruption**: Simulate network failure during init
4. **Component Unmounting**: Unmount component during async operations
5. **Concurrent State Updates**: Trigger multiple state changes simultaneously

### Debug Logging:
```javascript
// Add race condition detection logging
const logStateChange = (operation, oldState, newState) => {
  if (__DEV__) {
    console.log(`[RACE CHECK] ${operation}:`, {
      timestamp: Date.now(),
      oldState,
      newState,
      stackTrace: new Error().stack
    });
  }
};
```

## Result
These fixes will eliminate the race conditions by:
1. **Atomic state updates** - Preventing partial state changes
2. **Completion tracking** - Ensuring operations don't override each other  
3. **Sequential execution** - Preventing simultaneous conflicting operations
4. **State synchronization** - Coordinating multiple state dependencies
5. **Proper cleanup** - Preventing stale operations from affecting new states
