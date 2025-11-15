// babel.config.js — Production-ready configuration with console log management
module.exports = function (api) {
  api.cache(true);
  
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Production: Remove console logs but preserve fatal logs
      ...(isProduction ? [
        [
          'transform-remove-console',
          {
            exclude: ['error', 'warn'] // Keep console.error and console.warn for debugging crashes
          }
        ]
      ] : []),
      
      // Path aliases temporarily disabled - need to install babel-plugin-module-resolver properly
      // [
      //   'module-resolver',
      //   {
      //     root: ['./src'],
      //     alias: {
      //       '@': './src',
      //       '@components': './src/components',
      //       '@screens': './src/screens',
      //       '@services': './src/services',
      //       '@utils': './src/utils',
      //       '@hooks': './src/hooks',
      //       '@config': './src/config',
      //       '@assets': './assets',
      //     },
      //   },
      // ],
      
      // IMPORTANT: Reanimated plugin MUST be last
      'react-native-reanimated/plugin'
    ],
  };
};
