const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable New Architecture to prevent Swift compilation errors
config.resolver.unstable_enablePackageExports = false;

// Fix file watcher issues with platform-specific packages
config.resolver.blockList = [
  /node_modules\/.*lightningcss-.*/,
  /node_modules\/.*fsevents.*/,
  /node_modules\/.*babel-plugin-transform-react-remove-prop-types.*/,
];

// Reduce file watching scope to avoid platform-specific package issues
config.watchFolders = [];
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Path aliases temporarily disabled - need to install babel-plugin-module-resolver properly
// config.resolver.alias = {
//   '@': path.resolve(__dirname, 'src'),
//   '@components': path.resolve(__dirname, 'src/components'),
//   '@screens': path.resolve(__dirname, 'src/screens'),
//   '@services': path.resolve(__dirname, 'src/services'),
//   '@utils': path.resolve(__dirname, 'src/utils'),
//   '@hooks': path.resolve(__dirname, 'src/hooks'),
//   '@config': path.resolve(__dirname, 'src/config'),
//   '@assets': path.resolve(__dirname, 'assets'),
// };

module.exports = config;
