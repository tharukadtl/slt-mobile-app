/**
 * AUTH-016 — OTP login happy path for the Client app: enter a phone number, request an OTP,
 * type the 6 digits, and land authenticated on the client home stack.
 *
 * <p><b>Tool substitution.</b> The sheet maps this row to Detox
 * (`e2e/auth/clientLogin.e2e.js::otpLogin_happyPath`, driving an Android emulator by `testID`).
 * Detox is not a dependency of this app (`package.json` has jest + react-test-renderer only),
 * there is no `e2e/` directory or Detox config, and no emulator is available here — so a Detox
 * spec could not be executed and would not produce a verdict. It also could not be written
 * against the described selectors at all: `phoneInput`, `sendOtpBtn`, `otpScreen`, `verifyBtn`
 * and `homeScreen` do not exist — neither `LoginScreen.tsx` nor `OTPVerifyScreen.tsx` sets a
 * single `testID`, and adding them would be a production-code change.
 *
 * <p>This is therefore the runnable equivalent in the convention this app already uses for
 * screen-level tests (`BODScreen.checkIn.test.tsx`, `HomeScreen.completeRouting.test.tsx`):
 * render the REAL screens with react-test-renderer and locate elements by component type + the
 * visible label, exactly as those tests do. Crucially it is NOT a mock-the-slice test — the REAL
 * `authSlice` thunks and reducer run against a REAL Redux store, and only the HTTP boundary
 * (`@services/authService`) is faked. So the assertions cover the genuine wiring: screen ->
 * thunk -> reducer -> the state `AppNavigator` routes on.
 *
 * <p>"homeScreen visible / bottomNav visible" is asserted as the state that actually produces
 * it: `AppNavigator.getNavigator()` renders `<ClientNavigator/>` (the bottom-tab stack) exactly
 * when `isAuthenticated && user.role === 'client'`. That derivation is mirrored below rather
 * than rendering the whole navigator, which would need NavigationContainer, Firebase and
 * AsyncStorage stand-ins unrelated to what this row is about.
 */
import React from 'react';
import {TextInput, TouchableOpacity, Text, Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';

// OTPVerifyScreen starts a 1s countdown interval on mount; fake timers keep it dormant instead
// of firing after teardown (same convention as BODScreen.checkIn.test.tsx).
//
// `doNotFake` is required here and is not needed by BODScreen's test: React's async `act()`
// drains its work queue through a real macrotask (setImmediate) and the thunk chain resolves
// over microtasks. Jest's modern fake timers replace setImmediate/queueMicrotask/nextTick by
// default, which deadlocks the very first `await act(...)`. Leaving those three real keeps only
// the wall-clock timers (setInterval/setTimeout/Date) faked, which is all this screen needs.
jest.useFakeTimers({
  doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick'],
});

const PHONE = '0717730773';
const OTP = '123456';

const AUTH_RESPONSE = {
  accessToken: 'header.payload.signature',
  refreshToken: 'refresh-token-value',
  tokenType: 'Bearer',
  userId: 4242,
  username: 'client_0717730773',
  role: 'CLIENT',
  fullName: 'Test Client',
  opmcId: 1,
  expiresIn: 1800000,
  phoneNumber: PHONE,
};

// The only thing faked: the HTTP boundary. Mocking this module also keeps axios /
// AsyncStorage / api.config out of the import graph.
const mockSendOTP = jest.fn().mockResolvedValue(undefined);
const mockVerifyOTP = jest.fn().mockResolvedValue(AUTH_RESPONSE);
jest.mock('@services/authService', () => ({
  __esModule: true,
  default: {
    sendOTP: (...args: any[]) => mockSendOTP(...args),
    verifyOTP: (...args: any[]) => mockVerifyOTP(...args),
  },
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: mockGoBack}),
  useRoute: () => ({params: {phoneNumber: '0717730773'}}),
}));
jest.mock('@react-navigation/stack', () => ({}));

import LoginScreen from '@screens/auth/LoginScreen';
import OTPVerifyScreen from '@screens/auth/OTPVerifyScreen';
import authReducer from '@store/slices/authSlice';

const makeStore = () =>
  configureStore({reducer: {auth: authReducer}});

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

const findButtonByLabel = (tree: any, label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find((b: any) =>
      b.findAllByType(Text).some((t: any) => textOf(t).includes(label)),
    );

/** Lets the dispatched thunk's promise chain settle over microtasks. */
const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
  });
};

const render = async (store: any, element: React.ReactElement) => {
  let tree: any;
  await act(async () => {
    tree = renderer.create(<Provider store={store}>{element}</Provider>);
  });
  await flush();
  return tree;
};

/**
 * Mirrors AppNavigator.getNavigator() exactly (AppNavigator.tsx lines 55-71): which stack the
 * user lands on after login.
 */
const landingStack = (state: any): string => {
  const {isAuthenticated, user} = state.auth;
  if (!isAuthenticated || !user) return 'AuthNavigator';
  switch (user.role) {
    case 'client':
      return 'ClientNavigator';
    case 'technician':
      return 'TechnicianNavigator';
    case 'teamlead':
    case 'admin':
    case 'super_admin':
      return 'TeamLeadNavigator';
    default:
      return 'AuthNavigator';
  }
};

describe('AUTH-016 — client OTP login, happy path', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockSendOTP.mockClear();
    mockVerifyOTP.mockClear();
    mockNavigate.mockClear();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy?.mockRestore();
  });

  it('otpLogin_happyPath: phone -> OTP -> authenticated on the client stack', async () => {
    const store = makeStore();

    // ── Step 1: type the phone number into the login form ────────────────────────────────
    const login = await render(store, <LoginScreen />);
    const phoneInput = login.root.findAllByType(TextInput)[0];
    expect(phoneInput).toBeDefined();

    await act(async () => {
      phoneInput.props.onChangeText(PHONE);
    });

    // The Send OTP button only enables for a phone that passes validatePhone() (AUTH-001).
    const sendBtn = findButtonByLabel(login, 'Send OTP');
    expect(sendBtn).toBeDefined();
    expect(sendBtn.props.disabled).toBe(false);

    // ── Step 2: tap Send OTP — the REAL sendOTP thunk runs ───────────────────────────────
    await act(async () => {
      await sendBtn.props.onPress();
    });
    await flush();

    expect(mockSendOTP).toHaveBeenCalledTimes(1);
    expect(mockSendOTP).toHaveBeenCalledWith({phoneNumber: PHONE});
    expect(store.getState().auth.error).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();

    // ── Step 3: the OTP screen is opened, carrying the phone number forward ──────────────
    expect(mockNavigate).toHaveBeenCalledWith('OTPVerify', {phoneNumber: PHONE});

    act(() => login.unmount());

    // ── Step 4: type the 6 OTP digits into boxes 0-5 ─────────────────────────────────────
    const otpScreen = await render(store, <OTPVerifyScreen />);
    const boxes = otpScreen.root.findAllByType(TextInput);
    expect(boxes).toHaveLength(6);

    for (let i = 0; i < 6; i++) {
      // Entering the 6th digit auto-submits (OTPVerifyScreen.handleOtpChange), which is the
      // real UX — step 5's explicit Verify tap is therefore already covered by this loop.
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        boxes[i].props.onChangeText(OTP[i]);
      });
    }
    await flush();

    // ── Step 5: verification was submitted with the phone + the full code ────────────────
    expect(mockVerifyOTP).toHaveBeenCalledTimes(1);
    expect(mockVerifyOTP).toHaveBeenCalledWith({phoneNumber: PHONE, otp: OTP});
    expect(alertSpy).not.toHaveBeenCalled();

    // ── Steps 6 & 7: the session is established and routes to the client tab stack ───────
    const state = store.getState();
    expect(state.auth.isAuthenticated).toBe(true);
    expect(state.auth.isLoading).toBe(false);
    expect(state.auth.error).toBeNull();
    expect(state.auth.token).toBe(AUTH_RESPONSE.accessToken);
    expect(state.auth.refreshToken).toBe(AUTH_RESPONSE.refreshToken);
    expect(state.auth.user).not.toBeNull();
    expect(state.auth.user.role).toBe('client');
    expect(state.auth.user.name).toBe('Test Client');
    expect(state.auth.user.phone).toBe(PHONE);

    // "homeScreen + bottomNav visible": ClientNavigator is the bottom-tab stack.
    expect(landingStack(state)).toBe('ClientNavigator');

    act(() => otpScreen.unmount());
  });
});
