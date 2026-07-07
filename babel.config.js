module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // No plugins in dev. Re-add 'react-native-worklets/plugin' here when
    // we add reanimated back via a development build.
    env: {
      production: {
        // Strip all console.* from release builds (dev logging stays intact).
        // Catch-paths log error.message via console.warn but also surface a
        // user-facing toast, so removing the logs is safe.
        plugins: ['transform-remove-console'],
      },
    },
  };
};
