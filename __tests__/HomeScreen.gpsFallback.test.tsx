/**
 * Critical #28 — Technician HomeScreen's BOD check-in GPS-error fallback.
 *
 * Before the fix, `handleBODCheckIn`'s `Geolocation.getCurrentPosition` ERROR
 * callback offered "Location Unavailable — Check In Anyway", and that button's
 * onPress only did `setCheckInTime(now)` + `Alert.alert('✅ Checked In', ...)`.
 * It never dispatched `submitBODCheckIn` and never touched the network: the
 * technician was told they were checked in while the server knew nothing about
 * it. Distinct from Critical #17/#19, which fixed the API-REJECTION case on the
 * GPS-SUCCESS branch — this is the GPS-FAILURE branch, which was never wired to
 * the backend at all.
 *
 * These cases drive the REAL TechnicianHomeScreen with react-test-renderer (the
 * same substitution the other HomeScreen suites make — @testing-library/react-native
 * is genuinely not installed), fire the geolocation ERROR callback, press the real
 * "Check In Anyway" button, and assert:
 *   (a) `submitBODCheckIn` is genuinely dispatched (with null coordinates, never
 *       a fake (0,0) — same rule as BODScreen's own GPS-unavailable path, and
 *       what AttendanceDTO.CheckInRequest allows);
 *   (b) a REJECTED dispatch produces a real failure alert and no success claim;
 *   (c) the "✅ Checked In" alert appears only after a genuinely fulfilled dispatch.
 *
 * Critical #29 — the same defect on the EOD CHECK-OUT side (second describe
 * block below). `performCheckOut`'s geolocation ERROR callback did only
 * `setIsCheckingOut(false); setCheckInTime(null); Alert.alert('✅ Checked Out', …)`,
 * so a technician whose phone couldn't get a fix was told their day was closed
 * while the server still had them checked in — and any EOD open-job handover
 * reasons they had just typed were silently discarded. The fix dispatches
 * `submitEODCheckOut` with NULL coordinates (never a phantom (0,0)) and mirrors
 * the GPS-success branch's failure/success handling.
 */
import React from 'react';
import {TouchableOpacity, Text, Alert, PermissionsAndroid} from 'react-native';
import renderer, {act} from 'react-test-renderer';

jest.useFakeTimers();

const mockState: any = {
  auth: {user: {name: 'Test Tech'}},
  technician: {
    tasks: [] as any[],
    // Not checked in yet today -> the BOD Check-In button is the live control.
    bodCheckIn: null,
    todayAttendance: null,
    isLoading: false,
    error: null,
  },
};

// The check-in dispatch is consumed via `.unwrap()`; each test decides whether
// that promise fulfils or rejects, exactly as the real thunk would.
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

// GPS FAILURE is the whole point of this suite: always take the error callback.
const mockGetCurrentPosition = jest.fn((_success: any, error: any) =>
  error({code: 2, message: 'Position unavailable'}),
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

import HomeScreen from '@screens/technician/HomeScreen';
import {
  submitBODCheckIn,
  submitEODCheckOut,
  setHasBODToday,
} from '@store/slices/technicianSlice';

const submitBODCheckInMock = submitBODCheckIn as unknown as jest.Mock;
const submitEODCheckOutMock = submitEODCheckOut as unknown as jest.Mock;
const setHasBODTodayMock = setHasBODToday as unknown as jest.Mock;

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

/**
 * Taps "BOD Check-In" (which fails to get a GPS fix) and then presses the real
 * "Check In Anyway" button on the resulting "Location Unavailable" alert.
 */
const checkInWithoutGps = async (tree: any, alertSpy: jest.SpyInstance) => {
  const bodButton = tappable(tree, 'BOD Check-In');
  expect(bodButton).toBeDefined();
  await act(async () => {
    await bodButton.props.onPress();
  });

  const fallbackCall = alertSpy.mock.calls.find(
    (c: any[]) => c[0] === 'Location Unavailable',
  );
  expect(fallbackCall).toBeDefined();

  const anyway = (fallbackCall![2] as any[]).find(
    (b: any) => b.text === 'Check In Anyway',
  );
  expect(anyway).toBeDefined();

  await act(async () => {
    await anyway.onPress();
  });
};

const alertTitles = (alertSpy: jest.SpyInstance) =>
  alertSpy.mock.calls.map((c: any[]) => String(c[0]));

describe('HomeScreen BOD check-in — GPS-unavailable fallback (Critical #28)', () => {
  let alertSpy: jest.SpyInstance;
  let permSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDispatch.mockClear();
    submitBODCheckInMock.mockClear();
    setHasBODTodayMock.mockClear();
    mockGetCurrentPosition.mockClear();
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

  test('genuinely dispatches submitBODCheckIn with NULL coordinates', async () => {
    const tree = await render();
    await checkInWithoutGps(tree, alertSpy);

    // (a) The API call actually happens on this path — it used to not exist.
    expect(submitBODCheckInMock).toHaveBeenCalledTimes(1);
    const payload = submitBODCheckInMock.mock.calls[0][0];
    expect(payload.latitude).toBeNull();
    expect(payload.longitude).toBeNull();
    // A phantom (0,0) is exactly what CheckInRequest's nullable coordinates exist to avoid.
    expect(payload.latitude).not.toBe(0);
    expect(payload.longitude).not.toBe(0);
    expect(payload.address).toBe('Location unavailable');

    // The dispatched action really reached dispatch(), not just the creator.
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({type: 'technician/submitBODCheckIn'}),
    );

    act(() => tree.unmount());
    // This is the first test in the file, so it eats the cold-start cost of
    // transforming/mounting HomeScreen's full component graph — verified
    // locally to take ~17s cold vs ~5s warm, comfortably over Jest's 5000ms
    // default on a shared CI runner even though later tests in this same
    // file pass within it.
  }, 20000);

  test('rejected check-in shows a real failure, never "✅ Checked In"', async () => {
    unwrapResult = () => Promise.reject('No active shift for today');

    const tree = await render();
    await checkInWithoutGps(tree, alertSpy);

    // It was genuinely attempted...
    expect(submitBODCheckInMock).toHaveBeenCalledTimes(1);
    // ...and the failure is surfaced with the backend's own message.
    expect(alertSpy).toHaveBeenCalledWith(
      'Check-In Failed',
      'No active shift for today',
    );
    // No false success anywhere, and no local "checked in" state change.
    expect(alertTitles(alertSpy).some(t => t.includes('✅ Checked In'))).toBe(
      false,
    );
    expect(setHasBODTodayMock).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });

  test('success alert appears only after a genuinely fulfilled dispatch', async () => {
    const tree = await render();
    await checkInWithoutGps(tree, alertSpy);

    expect(alertSpy).toHaveBeenCalledWith(
      '✅ Checked In',
      'Location unavailable — checked in without GPS',
    );
    expect(setHasBODTodayMock).toHaveBeenCalledWith(true);
    expect(alertTitles(alertSpy)).not.toContain('Check-In Failed');

    act(() => tree.unmount());
  });
});

/**
 * Taps the EOD checkout control (whose GPS fix fails) and confirms the native
 * "EOD Check-Out" alert. `performCheckOut` is not itself async, so the extra
 * act() flush below is what lets its async geolocation-error callback settle.
 */
const checkOutWithoutGps = async (tree: any, alertSpy: jest.SpyInstance) => {
  const eodButton = tappable(tree, '🌆 Checkout');
  expect(eodButton).toBeDefined();
  await act(async () => {
    await eodButton.props.onPress();
  });

  const confirmCall = alertSpy.mock.calls.find(
    (c: any[]) => c[0] === 'EOD Check-Out',
  );
  expect(confirmCall).toBeDefined();

  const confirm = (confirmCall![2] as any[]).find(
    (b: any) => b.text === 'Check Out 🌆',
  );
  expect(confirm).toBeDefined();

  await act(async () => {
    await confirm.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('HomeScreen EOD check-out — GPS-unavailable fallback (Critical #29)', () => {
  let alertSpy: jest.SpyInstance;
  let permSpy: jest.SpyInstance;

  beforeEach(() => {
    // Already checked in today (so the EOD control is the live one) with no
    // open jobs, which routes through the plain native-confirm path rather
    // than the open-job handover modal.
    mockState.technician.bodCheckIn = {
      checkInTime: new Date(Date.now() - 3 * 3600000).toISOString(),
    };
    mockState.technician.todayAttendance = {currentStatus: 'CHECKED_IN'};
    mockState.technician.tasks = [];

    mockDispatch.mockClear();
    submitEODCheckOutMock.mockClear();
    mockGetCurrentPosition.mockClear();
    unwrapResult = () => Promise.resolve({});
    permSpy = jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED as any);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    permSpy?.mockRestore();
    alertSpy?.mockRestore();
    // Leave the shared state as the check-in cases expect to find it.
    mockState.technician.bodCheckIn = null;
    mockState.technician.todayAttendance = null;
    mockState.technician.tasks = [];
  });

  test('genuinely dispatches submitEODCheckOut with NULL coordinates', async () => {
    const tree = await render();
    await checkOutWithoutGps(tree, alertSpy);

    // (a) The API call actually happens on this path — it used to not exist.
    expect(submitEODCheckOutMock).toHaveBeenCalledTimes(1);
    const payload = submitEODCheckOutMock.mock.calls[0][0];
    expect(payload.latitude).toBeNull();
    expect(payload.longitude).toBeNull();
    // A phantom (0,0) is exactly what CheckOutRequest's nullable coordinates
    // exist to avoid.
    expect(payload.latitude).not.toBe(0);
    expect(payload.longitude).not.toBe(0);
    expect(payload.address).toBe('Location unavailable');

    // The dispatched action really reached dispatch(), not just the creator.
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({type: 'technician/submitEODCheckOut'}),
    );

    act(() => tree.unmount());
  });

  test('rejected check-out shows a real failure, never "✅ Checked Out"', async () => {
    unwrapResult = () => Promise.reject('Open jobs require a handover reason');

    const tree = await render();
    await checkOutWithoutGps(tree, alertSpy);

    // It was genuinely attempted...
    expect(submitEODCheckOutMock).toHaveBeenCalledTimes(1);
    // ...and the failure is surfaced with the backend's own message.
    expect(alertSpy).toHaveBeenCalledWith(
      'Check-Out Failed',
      'Open jobs require a handover reason',
    );
    // No false success anywhere.
    expect(alertTitles(alertSpy).some(t => t.includes('✅ Checked Out'))).toBe(
      false,
    );

    act(() => tree.unmount());
  });

  test('success alert appears only after a genuinely fulfilled dispatch', async () => {
    const tree = await render();
    await checkOutWithoutGps(tree, alertSpy);

    expect(submitEODCheckOutMock).toHaveBeenCalledTimes(1);
    const successCall = alertSpy.mock.calls.find(
      (c: any[]) => String(c[0]) === '✅ Checked Out',
    );
    expect(successCall).toBeDefined();
    expect(String(successCall![1])).toMatch(/^Total: \d+h \d+m$/);
    expect(alertTitles(alertSpy)).not.toContain('Check-Out Failed');

    act(() => tree.unmount());
  });
});
