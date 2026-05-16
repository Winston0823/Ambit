module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // No plugins right now. Re-add 'react-native-worklets/plugin' here when
    // we add reanimated back via a development build.
  };
};
