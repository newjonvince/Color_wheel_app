// babel.config.js — Production-ready configuration with robust plugin loading
module.exports = function (api) {
  api.cache(true);
  
  const isProduction = process.env.NODE_ENV === 'production';
  const isEASBuild = process.env.EAS_BUILD === 'true';

  // Helper function to safely load plugins
  const safePlugin = (pluginName, options = null) => {
    try {
      require.resolve(pluginName);
      return options ? [pluginName, options] : pluginName;
    } catch (e) {
      console.warn(`⚠️ Babel plugin '${pluginName}' not found, skipping...`);
      return null;
    }
  };

  // Build plugins array safely
  const plugins = [];

  // Production: Remove console logs (only if plugin is available)
  if (isProduction && !isEASBuild) {
    const consolePlugin = safePlugin('babel-plugin-transform-remove-console', {
      exclude: ['error', 'warn'] // Keep console.error and console.warn for debugging crashes
    });
    if (consolePlugin) plugins.push(consolePlugin);
  }
  
  // Production: Strip PropTypes (only if plugin is available)
  if (isProduction) {
    const propTypesPlugin = safePlugin('babel-plugin-transform-react-remove-prop-types');
    if (propTypesPlugin) plugins.push(propTypesPlugin);
  }
  
  // IMPORTANT: Reanimated plugin MUST be last
  plugins.push('react-native-reanimated/plugin');

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
