module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // MUST be listed last. Enables react-native-reanimated worklets.
      'react-native-reanimated/plugin',
    ],
  };
};
