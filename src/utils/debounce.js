// utils/debounce.js - Memory-safe debounce utility
export function debounce(fn, delay) {
  let timeoutId;
  
  const debounced = (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
  
  // ✅ Clean cancel method to prevent memory leaks
  debounced.cancel = () => {
    clearTimeout(timeoutId);
    timeoutId = null;
  };
  
  return debounced;
}

export default debounce;
