// Live-backend integration test: proves the real BOD (Beginning-of-Day) check-in mechanism works
// end-to-end against a genuine, running fieldops instance -- nothing under @services/* is mocked,
// the real Redux store is used, and both authentication and the check-in itself are direct thunk
// dispatches rather than UI-driven (see liveTestHelpers.ts's loginViaOtp for why) -- this file's
// job is proving the real submitBODCheckIn <-> POST /api/attendance/check-in integration, not
// re-proving the BOD screen's own UI, which is unit-tested elsewhere with a mocked backend.
//
// Authenticates as the CI-seeded Technician account (scripts/live/seed_admin.py's
// seed-job-assignment command, phone 0770000002) -- no fixtures of this file's own to add,
// though it does depend on that command having already run (see live-backend.yml's step order).
// Deliberately NOT the SUPER_ADMIN account login.live.test.tsx uses: both files dispatch a real
// POST /api/auth/otp/send for their login, and fieldops enforces a real 60-second OTP-resend
// cooldown per phone number -- reusing 0770000000 here collided with login.live.test.tsx's own
// request moments earlier in the same CI job ("Please wait 59 second(s) before requesting
// another OTP", confirmed directly from a real failed run), a genuine cross-test interaction bug
// a fully-mocked test could never have surfaced. TECHNICIAN is one of the roles
// AttendanceController permits for check-in anyway, and is arguably the more realistic caller
// for this specific action.
//
// Excluded from the normal `npm test` run via jest.config.js's testPathIgnorePatterns -- only
// .github/workflows/live-backend.yml runs this, with API_BASE_URL=http://localhost:8080 and
// FIELDOPS_LOG_PATH pointing at fieldops's own log.
import {store} from '@store/index';
import {submitBODCheckIn} from '@store/slices/technicianSlice';
import {loginViaOtp} from './liveTestHelpers';

// The real fieldops AttendanceDTO.AttendanceResponse carries more fields than the app's own
// (stale) BODCheckIn interface declares -- checkInLatitude/checkInLongitude (not
// latitude/longitude), status, odometerStart and userPhone all genuinely exist on the wire but
// aren't in technician.types.ts's BODCheckIn. Typed locally here rather than widening that
// production interface, which is out of scope for this test.
interface RealAttendanceResponse {
  status: string;
  checkInLatitude: number;
  checkInLongitude: number;
  odometerStart: number;
  userPhone: string;
}

const TEST_PHONE = '0770000002';

// Real Colombo coordinates -- must fall inside LocationService.validateSriLankaCoords' bounds
// (lat 5.9-9.9, lng 79.5-81.9) or the backend genuinely rejects the check-in (ATT-003).
const COLOMBO_LAT = 6.9271;
const COLOMBO_LNG = 79.8612;
const ODOMETER_START = 12000;

describe('Live backend: BOD check-in', () => {
  it('checks in with a real odometer reading and lands a real CHECKED_IN record in the store', async () => {
    await loginViaOtp(store.dispatch, TEST_PHONE);
    expect(store.getState().auth.token).toBeTruthy();

    const result = await store.dispatch(
      submitBODCheckIn({
        latitude: COLOMBO_LAT,
        longitude: COLOMBO_LNG,
        address: 'CI live-backend test -- Colombo',
        odometerStart: ODOMETER_START,
      }),
    );

    if (submitBODCheckIn.rejected.match(result)) {
      throw new Error(`submitBODCheckIn rejected: ${result.payload}`);
    }

    const bodCheckIn = store.getState().technician.bodCheckIn as unknown as RealAttendanceResponse | null;
    expect(bodCheckIn).toBeTruthy();
    expect(bodCheckIn?.status).toBe('CHECKED_IN');
    expect(bodCheckIn?.checkInLatitude).toBe(COLOMBO_LAT);
    expect(bodCheckIn?.checkInLongitude).toBe(COLOMBO_LNG);
    expect(bodCheckIn?.odometerStart).toBe(ODOMETER_START);
    expect(bodCheckIn?.userPhone).toBe(TEST_PHONE);
  }, 30000);
});
