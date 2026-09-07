// Shared helpers for the __tests__/live/ suite -- real backend, no @services/* mocking.
import fs from 'fs';
import {AppDispatch} from '@store/index';
import {sendOTP, verifyOTP} from '@store/slices/authSlice';

/**
 * Reads the real OTP fieldops's own AuthService just logged -- the same
 * grep-fieldops's-own-log technique e2e-live.yml already uses on this file for a different value.
 */
export const readRealOtpFromLog = (phone: string): string => {
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

/**
 * Logs a real user in via direct thunk dispatch (real POST /api/auth/otp/send, real OTP read
 * back from fieldops's own log, real POST /api/auth/otp/verify), never through LoginScreen or
 * OTPVerifyScreen's UI. The OTP-entry UI itself is already exhaustively covered, screen-to-
 * thunk-to-reducer, by clientLogin.e2e.test.tsx (AUTH-016) against a mocked backend -- login.live
 * .test.tsx is the one file whose job is proving that UI path's own real-backend wiring, and it
 * keeps its own, deliberately UI-driven send-OTP step for exactly that reason. Every other live
 * spec only needs an authenticated session as a precondition, which this gets to fastest and
 * most robustly -- no fire-and-forget UI timing to account for at all.
 */
export const loginViaOtp = async (
  dispatch: AppDispatch,
  phoneNumber: string,
): Promise<void> => {
  const sendResult = await dispatch(sendOTP({phoneNumber}));
  if (sendOTP.rejected.match(sendResult)) {
    throw new Error(`sendOTP rejected for ${phoneNumber}: ${sendResult.payload}`);
  }

  const otp = readRealOtpFromLog(phoneNumber);

  const verifyResult = await dispatch(verifyOTP({phoneNumber, otp}));
  if (verifyOTP.rejected.match(verifyResult)) {
    throw new Error(`verifyOTP rejected for ${phoneNumber}: ${verifyResult.payload}`);
  }
};
