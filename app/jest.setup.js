/* jest 环境里没有原生安全区，用官方 mock 顶上（它默认导出整个模块对象） */
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(async () => ({didCancel: true})),
}));
