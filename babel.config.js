// babel.config.js — simplified for stable Expo builds
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
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
