// Live-backend integration test: proves the real OTP login mechanism works end-to-end against
// a genuine, running fieldops instance (Testcontainers-backed run mode in CI) -- nothing under
// @services/* is mocked, and the real Redux store is used, so a pass here means a real
// POST /api/auth/otp/send, a real OTP generated and persisted by the real backend, read back
// from fieldops's own stdout log (the same technique frontend-admin/.github/workflows/e2e-live.yml
// already uses on this same log file, there to discover the Testcontainers MySQL port), a real
// POST /api/auth/otp/verify, and a real JWT landing in the real Redux store.
//
// Only @react-navigation is mocked here, matching every other test in this suite -- LoginScreen
// and OTPVerifyScreen's success paths are driven entirely by real Redux state, not by navigation,
// so proving real screen-to-screen transitions is a separate concern from what this file proves.
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

const mockNavigate = jest.fn();
// jest.mock() factories may only close over variables prefixed with "mock" (case-insensitive) --
// enforced by Jest's out-of-scope-variable guard against uninitialized mocks.
let mockOtpRouteParams = {phoneNumber: ''};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: jest.fn()}),
  useRoute: () => ({params: mockOtpRouteParams}),
}));
jest.mock('@react-navigation/stack', () => ({}));

import LoginScreen from '@screens/auth/LoginScreen';
import OTPVerifyScreen from '@screens/auth/OTPVerifyScreen';

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

    let otpTree: renderer.ReactTestRenderer | undefined;
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

      // Step 3: real POST /api/auth/otp/verify
      mockOtpRouteParams = {phoneNumber: TEST_PHONE};
      await act(async () => {
        otpTree = renderer.create(
          <Provider store={store}>
            <OTPVerifyScreen />
          </Provider>,
        );
      });

      const otpInputs = otpTree!.root.findAllByType(TextInput);
      expect(otpInputs).toHaveLength(6);
      // Entering the 6th digit auto-submits (OTPVerifyScreen.handleOtpChange), so no explicit
      // "Verify OTP" button press is needed here.
      await act(async () => {
        for (let i = 0; i < 6; i++) {
          otpInputs[i].props.onChangeText(realOtp[i]);
        }
      });

      // Step 4: a real JWT landed in the real store
      expect(store.getState().auth.token).toBeTruthy();
      expect(store.getState().auth.isAuthenticated).toBe(true);
      expect(store.getState().auth.user?.phone).toBe(TEST_PHONE);
    } finally {
      // Unmount even on assertion failure -- otherwise LoginScreen/OTPVerifyScreen's Animated
      // and setInterval timers keep firing after Jest tears the environment down, the same
      // class of leaked-timer warning already fixed in App.test.tsx.
      act(() => {
        loginTree.unmount();
        otpTree?.unmount();
      });
    }
  }, 30000);
});
