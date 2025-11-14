const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Disable New Architecture to prevent Swift compilation errors
config.resolver.unstable_enablePackageExports = false;

// Add path aliases for cleaner imports (must match babel.config.js)
config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
  '@components': path.resolve(__dirname, 'src/components'),
  '@screens': path.resolve(__dirname, 'src/screens'),
  '@services': path.resolve(__dirname, 'src/services'),
  '@utils': path.resolve(__dirname, 'src/utils'),
  '@hooks': path.resolve(__dirname, 'src/hooks'),
  '@config': path.resolve(__dirname, 'src/config'),
  '@assets': path.resolve(__dirname, 'assets'),
};

module.exports = config;
