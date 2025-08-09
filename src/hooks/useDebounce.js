// hooks/useDebounce.js
import { useEffect, useState } from 'react';

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  
  return debounced;
}

export default useDebounce;
