// utils/debugMode.js
// Single lazy loader for isDebugMode — eliminates the identical 12-line block
// that was copy-pasted across every file that needed debug-mode checks.
// Uses require() internally so it is safe to import from any module without
// triggering the expoConfigHelper circular-dependency crash at load time.
let _value = null;
export const isDebugMode = () => {
  if (_value === null) {
    try {
      _value = require('./expoConfigHelper')?.isDebugMode?.() ?? false;
    } catch (_) {
      _value = false;
    }
  }
  return _value;
};
