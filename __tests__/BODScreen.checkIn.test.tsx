/**
 * Regression coverage for:
 *  - QA Critical Issue #10 (BODScreen success path lands the technician in the
 *    tabs after check-in), and
 *  - The GPS-unavailable data-integrity fix: when device GPS is unavailable the
 *    check-in must submit latitude/longitude as NULL (never a fake (0,0), which
 *    would be indistinguishable from a real check-in at 0N 0E and pollute
 *    location-aware features).
 *
 * Renders the REAL BODScreen (screens/technician/BODScreen.tsx) with
 * react-test-renderer (the sanctioned approach here — @testing-library/react-native
 * is not installed), taps "Check In & Start Day" and asserts what handleCheckIn
 * passes to submitBODCheckIn and where it navigates.
 *
 * Two location states are exercised:
 *   1. GPS unavailable (permission denied -> location stays null): submits
 *      {latitude: null, longitude: null} and STILL succeeds (replace to tabs,
 *      no Alert) — i.e. null is the intended, non-error path.
 *   2. GPS available: submits the real coordinates (proves the `?? null` fallback
 *      only fires when location is genuinely absent).
 *
 * Pre-fix, the fallback was `?? 0`, so test 1 would have submitted
 * {latitude: 0, longitude: 0} and its `toBeNull()` assertions would fail —
 * this test genuinely exercises the closed gap.
 *
 * global.fetch is mocked below: reverseGeocode() calls a real nominatim.
 * openstreetmap.org endpoint, and Node 20's jest env has a native `fetch`
 * (unlike older setups where `fetch` was undefined and the call threw
 * synchronously into reverseGeocode's catch). Left unmocked, the "GPS
 * available" test performs a genuine network round-trip (~800ms), which is
 * both non-deterministic and far longer than the microtask-only `flush()`
 * below can bridge. Mocking it keeps reverseGeocode's async chain resolving
 * over microtasks only, so the existing act()/flush() pattern is sufficient.
 */
import React from 'react';
import {TouchableOpacity, Text, PermissionsAndroid, Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';

// TouchableOpacity drives an Animated value on press; with real timers those
// callbacks fire after teardown and spam act() warnings. Fake timers keep them
// dormant (same convention as HomeScreen.completeRouting.test.tsx).
jest.useFakeTimers();

const mockFetch = jest.fn().mockResolvedValue({
  json: async () => ({display_name: 'Mock Address, Colombo'}),
});
(global as any).fetch = mockFetch;

const mockReplace = jest.fn();
// dispatch(submitBODCheckIn(...)).unwrap() must resolve; dispatch(fetchTodayAttendance())
// is awaited directly. A single impl that returns an unwrap-able, awaitable object works.
const mockDispatch = jest.fn(() => ({unwrap: () => Promise.resolve({})}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({replace: mockReplace}),
}));
jest.mock('@react-navigation/stack', () => ({}));

const mockState: any = {auth: {user: {name: 'Test Tech'}}};
jest.mock('@store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (sel: any) => sel(mockState),
}));

// Capture the payloads passed to each action creator.
jest.mock('@store/slices/technicianSlice', () => ({
  submitBODCheckIn: jest.fn((args: any) => ({type: 'bod/checkIn', payload: args})),
  setHasBODToday: jest.fn((args: any) => ({type: 'bod/setHasBODToday', payload: args})),
  fetchTodayAttendance: jest.fn(() => ({type: 'bod/fetchTodayAttendance'})),
}));

const mockGetCurrentPosition = jest.fn();
jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: (...args: any[]) => mockGetCurrentPosition(...args),
}));

import BODScreen from '@screens/technician/BODScreen';
import {
  submitBODCheckIn,
  setHasBODToday,
} from '@store/slices/technicianSlice';

const submitBODCheckInMock = submitBODCheckIn as unknown as jest.Mock;
const setHasBODTodayMock = setHasBODToday as unknown as jest.Mock;

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

const findCheckInButton = (tree: any) => {
  const buttons = tree.root.findAllByType(TouchableOpacity);
  return buttons.find((b: any) =>
    b.findAllByType(Text).some((t: any) =>
      textOf(t).includes('Check In & Start Day'),
    ),
  );
};

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
  });
};

const renderScreen = async () => {
  let tree: any;
  await act(async () => {
    tree = renderer.create(<BODScreen />);
  });
  // Let getLocation()'s permission promise (and, when granted, the geolocation
  // success callback + reverseGeocode) settle so `location` state is populated.
  await flush();
  return tree;
};

describe('BODScreen check-in — null coordinates when GPS unavailable', () => {
  let permSpy: jest.SpyInstance;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockReplace.mockClear();
    mockDispatch.mockClear();
    mockFetch.mockClear();
    submitBODCheckInMock.mockClear();
    setHasBODTodayMock.mockClear();
    mockGetCurrentPosition.mockReset();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    permSpy?.mockRestore();
    alertSpy?.mockRestore();
  });

  test('GPS unavailable: submits latitude/longitude NULL and still succeeds into tabs', async () => {
    // Permission denied -> getLocation returns early -> location state stays null.
    permSpy = jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED as any);

    const tree = await renderScreen();
    const btn = findCheckInButton(tree);
    expect(btn).toBeDefined();

    await act(async () => {
      await btn.props.onPress();
    });

    // THE fix: null, not 0.
    expect(submitBODCheckInMock).toHaveBeenCalledTimes(1);
    const payload = submitBODCheckInMock.mock.calls[0][0];
    expect(payload.latitude).toBeNull();
    expect(payload.longitude).toBeNull();
    expect(payload.latitude).not.toBe(0);
    expect(payload.longitude).not.toBe(0);
    expect(payload.address).toBe('Location unavailable');

    // Null submission is the intended SUCCESS path, not a swallowed error.
    expect(alertSpy).not.toHaveBeenCalled();
    expect(setHasBODTodayMock).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith('TechnicianTabs');

    act(() => tree.unmount());
  });

  test('GPS available: submits the real coordinates (fallback does not fire)', async () => {
    permSpy = jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED as any);
    mockGetCurrentPosition.mockImplementation((success: any) => {
      success({coords: {latitude: 6.9271, longitude: 79.8612}});
    });

    const tree = await renderScreen();
    // renderScreen()'s flush() already lets reverseGeocode's mocked-fetch
    // chain settle over microtasks, so `location` is populated by now.

    const btn = findCheckInButton(tree);
    await act(async () => {
      await btn.props.onPress();
    });

    expect(submitBODCheckInMock).toHaveBeenCalledTimes(1);
    const payload = submitBODCheckInMock.mock.calls[0][0];
    expect(payload.latitude).toBe(6.9271);
    expect(payload.longitude).toBe(79.8612);
    expect(mockReplace).toHaveBeenCalledWith('TechnicianTabs');

    act(() => tree.unmount());
  });
});
