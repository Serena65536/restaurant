module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  // react-native-image-picker 发的是未编译的 ESM/TS，需要让 babel 转一遍
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-image-picker|react-native-safe-area-context)/)',
  ],
};
