module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated v4 moved its babel plugin to react-native-worklets.
      // MUST be listed last.
      'react-native-worklets/plugin',
    ],
  };
};
