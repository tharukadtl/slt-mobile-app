// react-native-gesture-handler's own recommended Jest integration (see its
// testing docs): mocks the native RNGestureHandlerModule so any screen that
// imports @react-navigation/stack (which pulls this in transitively) doesn't
// hit "TurboModuleRegistry.getEnforcing(...): 'RNGestureHandlerModule' could
// not be found" under Jest, which has no native side.
require('react-native-gesture-handler/jestSetup');

// @react-native-firebase/messaging ships no Jest mock of its own (unlike
// gesture-handler above); its native module (RNFBAppModule) doesn't exist
// under Jest either. @services/notificationService.ts imports every one of
// these named exports — mocked here, globally, so any test that renders a
// real screen in the notification chain (e.g. App.test.tsx, which mocks
// nothing) doesn't hit "Native module RNFBAppModule not found".
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({})),
  requestPermission: jest.fn(() => Promise.resolve(1)),
  getToken: jest.fn(() => Promise.resolve('mock-fcm-token')),
  onTokenRefresh: jest.fn(() => () => undefined),
  onMessage: jest.fn(() => () => undefined),
  onNotificationOpenedApp: jest.fn(() => () => undefined),
  getInitialNotification: jest.fn(() => Promise.resolve(null)),
  setBackgroundMessageHandler: jest.fn(),
  AuthorizationStatus: {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  },
}));

// The remaining native modules App.test.tsx's unmocked, whole-app render
// reaches transitively (every navigator's screens are imported eagerly, so
// all of these are pulled in regardless of which route is actually shown).
// Individual test files that already jest.mock() one of these locally are
// unaffected — a test file's own mock registers after this one and wins for
// that file, same as before this change.
jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
  requestAuthorization: jest.fn(),
}));

jest.mock('react-native-maps', () => {
  const ReactLocal = require('react');
  const MapView = ReactLocal.forwardRef((props, ref) =>
    ReactLocal.createElement('MapView', props, props.children),
  );
  return {
    __esModule: true,
    default: MapView,
    Marker: (props) => ReactLocal.createElement('Marker', props, props.children),
    PROVIDER_GOOGLE: 'google',
  };
});

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('react-native-signature-canvas', () => {
  const ReactLocal = require('react');
  return {
    __esModule: true,
    default: (props) => ReactLocal.createElement('SignatureCanvas', props, null),
  };
});

// AsyncStorage is a native module; under Jest there is no native side, so the
// real package throws "NativeModule: AsyncStorage is null" the moment it is
// imported. This is the integration the package itself documents. Needed now
// that `@services/offlineQueue` persists the offline action queue through
// AsyncStorage and is reachable from the technician screens/slice.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
