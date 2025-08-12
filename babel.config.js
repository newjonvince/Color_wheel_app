// babel.config.js — simplified for stable Expo builds
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // IMPORTANT: Reanimated plugin MUST be last
      'react-native-reanimated/plugin'
    ],
  };
};
