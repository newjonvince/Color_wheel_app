// ✅ Examples of how to use request cancellation with apiPatterns
// This file demonstrates proper cancellation patterns for different scenarios

import { apiPatterns } from './apiHelpers';

/**
 * Example 1: Component unmount cancellation
 * Cancel requests when component unmounts to prevent memory leaks
 */
export const useComponentCancellation = () => {
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Cancel any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const loadUserDataSafely = async () => {
    // Cancel previous request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController
    abortControllerRef.current = new AbortController();

    try {
      const result = await apiPatterns.loadUserData({
        signal: abortControllerRef.current.signal
      });

      // Only update state if component is still mounted
      if (isMountedRef.current && result.success) {
        // Update your state here
        console.log('User data loaded:', result.data);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request was cancelled');
      } else if (isMountedRef.current) {
        console.error('Failed to load user data:', error);
      }
    }
  };

  return { loadUserDataSafely };
};

/**
 * Example 2: Search debouncing with cancellation
 * Cancel previous search when user types new query
 */
export const useSearchWithCancellation = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const searchControllerRef = useRef(null);

  const performSearch = useCallback(async (query) => {
    // Cancel previous search
    if (searchControllerRef.current) {
      searchControllerRef.current.abort();
    }

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Create new search controller
    searchControllerRef.current = new AbortController();
    setLoading(true);

    try {
      const result = await apiPatterns.loadCommunityPosts(null, {
        signal: searchControllerRef.current.signal,
        // Add search parameters
        search: query
      });

      if (result.success) {
        setResults(result.data.posts || []);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Search failed:', error);
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search with cancellation
  const debouncedSearch = useDebounce(performSearch, 300);

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  return {
    searchQuery,
    setSearchQuery,
    results,
    loading
  };
};

/**
 * Example 3: Form submission with cancellation
 * Allow users to cancel long-running form submissions
 */
export const useFormWithCancellation = () => {
  const [submitting, setSubmitting] = useState(false);
  const submitControllerRef = useRef(null);

  const submitForm = async (formData) => {
    // Prevent multiple submissions
    if (submitting) {
      return;
    }

    setSubmitting(true);
    submitControllerRef.current = new AbortController();

    try {
      const result = await apiPatterns.registerUser(formData, {
        signal: submitControllerRef.current.signal
      });

      if (result.success) {
        console.log('Registration successful:', result.data);
        // Handle success
      } else {
        console.error('Registration failed:', result.error);
        // Handle error
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Registration cancelled by user');
      } else {
        console.error('Registration error:', error);
      }
    } finally {
      setSubmitting(false);
      submitControllerRef.current = null;
    }
  };

  const cancelSubmission = () => {
    if (submitControllerRef.current) {
      submitControllerRef.current.abort();
    }
  };

  return {
    submitForm,
    cancelSubmission,
    submitting
  };
};

/**
 * Example 4: Batch operations with individual cancellation
 * Cancel specific operations in a batch without affecting others
 */
export const useBatchOperationsWithCancellation = () => {
  const [operations, setOperations] = useState(new Map());

  const startOperation = async (operationId, operationType, ...args) => {
    const controller = new AbortController();
    
    // Store the controller for this operation
    setOperations(prev => new Map(prev).set(operationId, controller));

    try {
      let result;
      
      switch (operationType) {
        case 'loadUserData':
          result = await apiPatterns.loadUserData({
            signal: controller.signal
          });
          break;
        case 'loadColorMatches':
          result = await apiPatterns.loadColorMatches({
            signal: controller.signal
          });
          break;
        case 'toggleLike':
          const [postId, isLiked] = args;
          result = await apiPatterns.togglePostLike(postId, isLiked, {
            signal: controller.signal
          });
          break;
        default:
          throw new Error(`Unknown operation type: ${operationType}`);
      }

      console.log(`Operation ${operationId} completed:`, result);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`Operation ${operationId} was cancelled`);
      } else {
        console.error(`Operation ${operationId} failed:`, error);
      }
      throw error;
    } finally {
      // Remove the controller when operation completes
      setOperations(prev => {
        const newMap = new Map(prev);
        newMap.delete(operationId);
        return newMap;
      });
    }
  };

  const cancelOperation = (operationId) => {
    const controller = operations.get(operationId);
    if (controller) {
      controller.abort();
    }
  };

  const cancelAllOperations = () => {
    operations.forEach(controller => controller.abort());
    setOperations(new Map());
  };

  return {
    startOperation,
    cancelOperation,
    cancelAllOperations,
    activeOperations: Array.from(operations.keys())
  };
};

/**
 * Example 5: Timeout with cancellation
 * Combine timeout with manual cancellation
 */
export const useTimeoutWithCancellation = () => {
  const loadWithTimeout = async (timeoutMs = 10000) => {
    const controller = new AbortController();
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const result = await apiPatterns.loadUserData({
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      throw error;
    }
  };

  return { loadWithTimeout };
};
