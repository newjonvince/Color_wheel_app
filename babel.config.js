// babel.config.js — hardened for Expo + Reanimated + cleaner imports
module.exports = function (api) {
  api.cache(true);

  const isProd = process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production';

  const plugins = [
    // Absolute imports like: import Button from '@components/Button'
    ['module-resolver', {
      root: ['./src'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        '@components': './src/components',
        '@screens': './src/screens',
        '@services': './src/services',
        '@utils': './src/utils',
        '@assets': './assets',
      },
    }],
  ];

  // Strip console.* in production (keep warn/error)
  if (isProd) {
    plugins.push(['transform-remove-console', { exclude: ['error', 'warn'] }]);
  }

  // IMPORTANT: Reanimated plugin MUST be last
  plugins.push('react-native-reanimated/plugin');

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
