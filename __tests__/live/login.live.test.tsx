// Live-backend integration test: proves the real OTP login mechanism works end-to-end against
// a genuine, running fieldops instance (Testcontainers-backed run mode in CI) -- nothing under
// @services/* is mocked, and the real Redux store is used, so a pass here means a real
// POST /api/auth/otp/send, a real OTP generated and persisted by the real backend, read back
// from fieldops's own stdout log (the same technique frontend-admin/.github/workflows/e2e-live.yml
// already uses on this same log file, there to discover the Testcontainers MySQL port), a real
// POST /api/auth/otp/verify, and a real JWT landing in the real Redux store.
//
// Only @react-navigation is mocked here, matching every other test in this suite -- LoginScreen's
// success path is driven entirely by real Redux state, not by navigation, so proving real
// screen-to-screen transitions is a separate concern from what this file proves. The OTP-verify
// step dispatches the real authSlice thunk directly rather than driving it through
// OTPVerifyScreen's UI (see the comment at that call site for why).
//
// Excluded from the normal `npm test` run via jest.config.js's testPathIgnorePatterns (there is
// no live backend at API_BASE_URL there) -- only .github/workflows/live-backend.yml runs this,
// with API_BASE_URL=http://localhost:8080 and FIELDOPS_LOG_PATH pointing at fieldops's own log.
import React from 'react';
import fs from 'fs';
import {TextInput, TouchableOpacity, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {Provider} from 'react-redux';
import {store} from '@store/index';
import {verifyOTP} from '@store/slices/authSlice';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: jest.fn()}),
}));
jest.mock('@react-navigation/stack', () => ({}));

import LoginScreen from '@screens/auth/LoginScreen';

// The exact phone the CI-seeded SUPER_ADMIN carries -- frontend-admin/cypress/support/
// seed_live_fixtures.py's seed-admin command, reused as-is. sendOtp requires an existing user
// by phone (fieldops AuthService.sendOtp -> findUserByPhone(...).orElseThrow(...)), so this
// can't be an arbitrary, unseeded number.
const TEST_PHONE = '0770000000';

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.map((x: any) => String(x)).join('') : String(c);
};

const findButtonByLabel = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find(btn => btn.findAllByType(Text).some(t => textOf(t).includes(label)));

/**
 * Reads the real OTP fieldops's own AuthService just logged -- the same
 * grep-fieldops's-own-log technique e2e-live.yml already uses on this file for a different value.
 */
const readRealOtpFromLog = (phone: string): string => {
  const logPath = process.env.FIELDOPS_LOG_PATH;
  if (!logPath) {
    throw new Error(
      'FIELDOPS_LOG_PATH is not set -- this test only runs against a real fieldops instance ' +
        '(see .github/workflows/live-backend.yml), never under the normal npm test run.',
    );
  }
  const log = fs.readFileSync(logPath, 'utf8');
  const matches = [...log.matchAll(new RegExp(`DEV OTP for ${phone} : (\\d{6})`, 'g'))];
  const last = matches[matches.length - 1];
  if (!last) {
    throw new Error(
      `No DEV OTP found in fieldops's log for ${phone}. Log tail:\n${log.slice(-2000)}`,
    );
  }
  return last[1];
};

describe('Live backend: OTP login', () => {
  it('sends a real OTP, verifies it, and lands a real JWT in the real store', async () => {
    // Step 1: real POST /api/auth/otp/send
    let loginTree!: renderer.ReactTestRenderer;
    await act(async () => {
      loginTree = renderer.create(
        <Provider store={store}>
          <LoginScreen />
        </Provider>,
      );
    });

    try {
      const phoneInput = loginTree.root.findByType(TextInput);
      act(() => {
        phoneInput.props.onChangeText(TEST_PHONE);
      });

      const sendButton = findButtonByLabel(loginTree, 'Send OTP');
      expect(sendButton).toBeDefined();
      await act(async () => {
        await sendButton!.props.onPress();
      });

      // LoginScreen only navigates once dispatch(sendOTP(...)) actually fulfilled against the
      // real backend -- this is the real end-to-end assertion, not a mocked one.
      expect(mockNavigate).toHaveBeenCalledWith('OTPVerify', {phoneNumber: TEST_PHONE});

      // Step 2: read the real OTP fieldops's own backend just generated
      const realOtp = readRealOtpFromLog(TEST_PHONE);
      expect(realOtp).toMatch(/^\d{6}$/);

      // Step 3: real POST /api/auth/otp/verify -- dispatched directly and awaited, rather than
      // driven through OTPVerifyScreen's onChangeText/auto-submit UI path.
      //
      // That UI path (typing each digit, auto-submitting on the 6th) is already exhaustively
      // covered, screen-to-thunk-to-reducer, by clientLogin.e2e.test.tsx (AUTH-016) against a
      // mocked backend -- re-driving the same UI mechanics here would be redundant. It was also
      // the actual bug: OTPVerifyScreen.handleOtpChange (a synchronous onChangeText handler)
      // calls its own async handleVerify(otpString) without awaiting or returning it, so nothing
      // in an `act(async () => { otpInputs[i].props.onChangeText(...) })` block was ever waiting
      // on the dispatched thunk -- the store assertions below ran before verifyOTP.fulfilled had
      // actually landed, even though the real network call had already genuinely succeeded.
      // Dispatching the thunk directly removes that fire-and-forget layer entirely: this test's
      // job is proving the real backend integration (authService <-> fieldops), not re-proving
      // the OTP input component's own auto-submit behavior.
      await act(async () => {
        await store.dispatch(verifyOTP({phoneNumber: TEST_PHONE, otp: realOtp}));
      });

      // Step 4: a real JWT landed in the real store
      expect(store.getState().auth.token).toBeTruthy();
      expect(store.getState().auth.isAuthenticated).toBe(true);
      expect(store.getState().auth.user?.phone).toBe(TEST_PHONE);
    } finally {
      // Unmount even on assertion failure -- otherwise LoginScreen's Animated and setInterval
      // timers keep firing after Jest tears the environment down, the same class of leaked-timer
      // warning already fixed in App.test.tsx.
      act(() => {
        loginTree.unmount();
      });
    }
  }, 30000);
});
