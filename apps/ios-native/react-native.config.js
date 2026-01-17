// Workaround for iOS codegen not using autolinking output
// See: https://github.com/facebook/react-native/issues/53501
module.exports = {
  dependencies: {
    'react-native-screens': {
      root: require.resolve('react-native-screens/package.json').replace('/package.json', ''),
    },
    'react-native-safe-area-context': {
      root: require.resolve('react-native-safe-area-context/package.json').replace('/package.json', ''),
    },
    'react-native-svg': {
      root: require.resolve('react-native-svg/package.json').replace('/package.json', ''),
    },
  },
};
