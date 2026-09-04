// AsyncStorage is a native module; under Jest there is no native side, so the
// real package throws "NativeModule: AsyncStorage is null" the moment it is
// imported. This is the integration the package itself documents. Needed now
// that `@services/offlineQueue` persists the offline action queue through
// AsyncStorage and is reachable from the technician screens/slice.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
