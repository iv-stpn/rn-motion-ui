/** biome-ignore-all lint/style/noCommonJs: exception for babel config */
module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
