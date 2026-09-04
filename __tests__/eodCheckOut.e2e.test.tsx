/**
 * ATT-008 (07_ATTENDANCE, FR-20) — EOD check-out must show the day's job summary and the day's
 * mileage before and after the technician confirms.
 *
 * TOOL SUBSTITUTION. The row's Tool column says "Detox–Android" and its Automation Mapping names
 * `e2e/attendance/eodCheckOut.e2e.js::checkOut_withJobSummary`. Detox builds but cannot run live on
 * this host (the emulator is software-rendered under virtualization and the ANR watchdog kills the
 * app before Detox's bridge attaches) — a project decision recorded in `docs/SLT_Test_Plan_V1.docx`
 * §3 and the Resolution Log of `docs/QA_Compliance_Consolidated_Report.md`. The substitution is
 * Jest + react-test-renderer against the REAL screen, the same one `clientLogin.e2e.test.tsx`
 * (AUTH-016) and `HomeScreen.gpsFallback.test.tsx` (Critical #29) make.
 * `@testing-library/react-native` is genuinely NOT a dependency of this app, so RNTL is not an
 * option either.
 *
 * SCREEN CORRECTION. There is no separate "EOD screen" on the Technician app and no
 * profile/EOD tab: check-out is initiated from the Technician HomeScreen's own EOD control
 * (`handleEODCheckOut`), which raises a native confirm carrying the day's summary. The Team Lead
 * app does have a dedicated `screens/teamlead/EODScreen.tsx`, but this row's fixture ("Tech checked
 * in, 2 jobs completed") is the technician's day, so the technician flow is what is driven.
 *
 * ALREADY-COVERED PARTS NOT DUPLICATED HERE. That the check-out is genuinely dispatched (rather
 * than faked) on both the GPS-success and GPS-failure branches is Critical #29's regression test,
 * `HomeScreen.gpsFallback.test.tsx`; that each still-open job needs its own mandatory handover
 * reason is JOB-025's, `HomeScreen.eodHandover.test.tsx`. This file asserts only what neither
 * covers: the SUMMARY the row is about — completed-job count, final odometer entry and daily
 * mileage.
 */
import React from 'react';
import {TouchableOpacity, TextInput, Text, Alert, PermissionsAndroid} from 'react-native';
import renderer, {act} from 'react-test-renderer';

jest.useFakeTimers();

const CHECK_IN_TIME = new Date(Date.now() - 8 * 3600 * 1000).toISOString();

// The row's fixture: the technician checked in this morning and completed 2 jobs.
// Both are `completed`, so no job is open and the mandatory per-job handover modal
// (a different row's subject) stays out of the way.
const mockState: any = {
  auth: {user: {name: 'Test Tech'}},
  technician: {
    tasks: [
      {id: '1', jobNumber: 'JOB-001', status: 'completed', priority: 'HIGH'},
      {id: '2', jobNumber: 'JOB-002', status: 'completed', priority: 'MEDIUM'},
    ],
    bodCheckIn: {checkInTime: CHECK_IN_TIME},
    todayAttendance: {currentStatus: 'CHECKED_IN'},
    isLoading: false,
    error: null,
  },
};

let unwrapResult: () => Promise<any> = () => Promise.resolve({});
const mockDispatch = jest.fn(() => ({
  unwrap: () => unwrapResult(),
  catch: () => undefined,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: jest.fn()}),
  useFocusEffect: jest.fn(),
}));
jest.mock('@react-navigation/stack', () => ({}));

jest.mock('@store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (sel: any) => sel(mockState),
}));

jest.mock('@store/slices/technicianSlice', () => {
  const makeThunk = (type: string) =>
    jest.fn((args: any) => ({type, payload: args}));
  return {
    QUEUED_OFFLINE: 'QUEUED_OFFLINE',
    fetchTasks: makeThunk('technician/fetchTasks'),
    fetchTodayAttendance: makeThunk('technician/fetchTodayAttendance'),
    submitBODCheckIn: makeThunk('technician/submitBODCheckIn'),
    submitEODCheckOut: makeThunk('technician/submitEODCheckOut'),
    setHasBODToday: makeThunk('technician/setHasBODToday'),
    updateTaskStatus: makeThunk('technician/updateTaskStatus'),
  };
});

// GPS is available for this row — the GPS-failure branch is Critical #29's test.
const mockGetCurrentPosition = jest.fn((success: any) =>
  success({coords: {latitude: 6.93, longitude: 79.86}}),
);
jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: (...args: any[]) =>
    (mockGetCurrentPosition as any)(...args),
}));

jest.mock('@services/technicianService', () => ({
  __esModule: true,
  default: {getMyOutstandingMaterialRequests: jest.fn().mockResolvedValue([])},
}));

jest.mock('@services/connectivityService', () => ({
  __esModule: true,
  isConnectivitySourceAvailable: () => true,
  subscribeToConnectivity: () => () => undefined,
  default: {},
}));

jest.mock('@services/offlineQueue', () => ({
  __esModule: true,
  default: {
    getPending: jest.fn().mockResolvedValue([]),
    triggerSync: jest.fn(),
    subscribe: () => () => undefined,
  },
}));

// getAddressFromCoords hits a real nominatim endpoint; Node 20's jest env has a native
// fetch, so leaving it unmocked would make a genuine network round-trip. Same treatment as
// BODScreen.checkIn.test.tsx.
const mockFetch = jest.fn().mockResolvedValue({
  json: async () => ({display_name: 'Mock Address, Colombo'}),
});
(global as any).fetch = mockFetch;

import HomeScreen from '@screens/technician/HomeScreen';
import {submitEODCheckOut} from '@store/slices/technicianSlice';

const submitEODCheckOutMock = submitEODCheckOut as unknown as jest.Mock;

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.map((x: any) => String(x)).join('') : String(c);
};

const tappable = (tree: any, label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find((b: any) =>
      b.findAllByType(Text).some((t: any) => textOf(t).includes(label)),
    );

const render = async () => {
  let tree: any;
  await act(async () => {
    tree = renderer.create(<HomeScreen />);
  });
  return tree;
};

/** Every string the screen has put in front of the user via Alert, flattened. */
const allAlertText = (alertSpy: jest.SpyInstance) =>
  alertSpy.mock.calls
    .map((c: any[]) => [c[0], c[1]].filter(Boolean).join('\n'))
    .join('\n---\n');

describe('EOD check-out — job summary and daily mileage (ATT-008)', () => {
  let alertSpy: jest.SpyInstance;
  let permSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDispatch.mockClear();
    submitEODCheckOutMock.mockClear();
    mockGetCurrentPosition.mockClear();
    mockFetch.mockClear();
    unwrapResult = () => Promise.resolve({});
    permSpy = jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED as any);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    permSpy?.mockRestore();
    alertSpy?.mockRestore();
  });

  test('checkOut_withJobSummary', async () => {
    const tree = await render();

    // ── Steps 1-2: reach the EOD control ────────────────────────────────────────────
    // Label correction: the row calls it `eodCheckOutBtn`. The screen has two real
    // controls wired to handleEODCheckOut — the header card's "🌆 Checkout" and the
    // job list's footer button, which reads "All Jobs Done! Checkout" when every job
    // is complete (this fixture) and "End Shift & Checkout" otherwise.
    const eodButton = tappable(tree, 'Checkout');
    expect(eodButton).toBeDefined();

    await act(async () => {
      await eodButton.props.onPress();
    });

    // ── Step 3: the EOD confirmation is raised ──────────────────────────────────────
    const confirm = alertSpy.mock.calls.find(
      (c: any[]) => String(c[0]).includes('EOD Check-Out'),
    );
    expect(confirm).toBeDefined();

    // ── Step 4: it shows how many jobs were completed today ─────────────────────────
    // Wording correction: the screen renders "Completed: 2/2 jobs", not the row's
    // literal "Jobs Completed Today: 2". The figure is what matters and it is real —
    // derived from the task list's own statuses, not passed in.
    expect(String(confirm![1])).toContain('Completed: 2/2 jobs');

    // ── Step 5: type the final odometer reading ─────────────────────────────────────
    // Captured here (where the row expects the field to be) but asserted at the very
    // end, so this gap does not abort the rest of the flow and hide its verdicts.
    const odometerInputs = tree.root
      .findAllByType(TextInput)
      .filter((i: any) =>
        /odometer/i.test(
          `${i.props.placeholder ?? ''} ${i.props.testID ?? ''} ${i.props.accessibilityLabel ?? ''}`,
        ),
      );

    // ── Steps 6-7: confirm the check-out ────────────────────────────────────────────
    const confirmButton = (confirm![2] as any[]).find((b: any) =>
      String(b.text).includes('Check Out'),
    );
    expect(confirmButton).toBeDefined();
    await act(async () => {
      await confirmButton.onPress();
    });

    expect(submitEODCheckOutMock).toHaveBeenCalledTimes(1);

    // ── Step 9: success is reported only after the dispatch really resolved ─────────
    const success = alertSpy.mock.calls.find((c: any[]) =>
      String(c[0]).includes('Checked Out'),
    );
    expect(success).toBeDefined();
    expect(String(success![1])).toContain('Completed: 2 jobs');

    // ── Steps 5 and 8, the two genuine gaps, asserted last ──────────────────────────
    // PRODUCTION CHANGE REQUIRED. Neither exists on the Technician EOD path:
    //  - no odometer field anywhere on HomeScreen (the string "odometer" appears only
    //    in the TEAM LEAD's screens/teamlead/BODScreen.tsx and EODScreen.tsx, which
    //    post odometerStart/odometerEnd to /api/jobs/bod and /api/jobs/eod on the
    //    day_sessions row — an individual technician's attendance carries none);
    //  - and therefore no daily mileage to display. The backend cannot supply one
    //    either: AttendanceDTO.AttendanceResponse has no mileage field and
    //    check_in_out has no odometer column (see ATT-005 and ATT-011).
    const gaps: string[] = [];
    if (odometerInputs.length === 0) {
      gaps.push(
        'no final-odometer input is rendered anywhere on the Technician EOD flow',
      );
    }
    if (!/mileage/i.test(allAlertText(alertSpy))) {
      gaps.push(
        'the check-out result never mentions the day\'s mileage. Shown instead: '
          + JSON.stringify(String(success![1])),
      );
    }
    expect(gaps).toEqual([]);

    act(() => tree.unmount());
  });
});
