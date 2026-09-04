/**
 * Critical #25 / JOB-016 — the "Sync" action must never claim success for work
 * that did not happen.
 *
 * Before the fix, `HomeScreen.handleSync` was two lines: set `pendingSyncs` to 0
 * and `Alert.alert('Synced', 'All data synced successfully')` — unconditionally,
 * with no queue, no request, and no result to check. A technician who lost a job
 * update in a basement was told everything had synced.
 *
 * These cases drive the REAL TechnicianHomeScreen (react-test-renderer, the same
 * substitution the other HomeScreen suites make since @testing-library/react-native
 * is not installed) with a controllable offline queue, and assert that the success
 * alert appears ONLY after a replay the queue itself reports as fully drained.
 * The companion suite offlineQueue.test.ts covers the existence of the offline
 * infrastructure; this one covers the honesty of what the screen says about it.
 */
import React from 'react';
import {TouchableOpacity, Text, Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';

jest.useFakeTimers();

const mockState: any = {
  auth: {user: {name: 'Test Tech'}},
  technician: {
    tasks: [] as any[],
    bodCheckIn: null,
    todayAttendance: null,
    isLoading: false,
    error: null,
  },
};

const mockDispatch = jest.fn(() => ({unwrap: () => Promise.resolve()}));

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

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
}));

jest.mock('@services/technicianService', () => ({
  __esModule: true,
  default: {getMyOutstandingMaterialRequests: jest.fn().mockResolvedValue([])},
}));

// Controllable connectivity — stands in for NetInfo so each case can pin the
// device to online/offline without a native module.
let mockConnectivityListener: ((status: boolean | null) => void) | null = null;
jest.mock('@services/connectivityService', () => ({
  __esModule: true,
  isConnectivitySourceAvailable: () => true,
  subscribeToConnectivity: (listener: any) => {
    mockConnectivityListener = listener;
    return () => undefined;
  },
  default: {},
}));

// Controllable offline queue — the screen must report exactly what this says.
const mockGetPending = jest.fn();
const mockTriggerSync = jest.fn();
let mockQueueListener: ((count: number) => void) | null = null;
jest.mock('@services/offlineQueue', () => ({
  __esModule: true,
  default: {
    getPending: (...args: any[]) => mockGetPending(...args),
    triggerSync: (...args: any[]) => mockTriggerSync(...args),
    subscribe: (listener: any) => {
      mockQueueListener = listener;
      return () => undefined;
    },
  },
}));

import HomeScreen from '@screens/technician/HomeScreen';

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

const findSyncBanner = (tree: any) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find((b: any) =>
      b
        .findAllByType(Text)
        .some((t: any) => textOf(t).includes('pending sync')),
    );

/** Renders the screen, then pins connectivity and the pending-queue count. */
const renderWith = async (opts: {online: boolean; pendingCount: number}) => {
  let tree: any;
  await act(async () => {
    tree = renderer.create(<HomeScreen />);
  });
  await act(async () => {
    mockConnectivityListener?.(opts.online);
    mockQueueListener?.(opts.pendingCount);
  });
  return tree;
};

const alertsShown = (alertSpy: jest.SpyInstance) =>
  alertSpy.mock.calls.map(c => `${c[0]} ${c[1] ?? ''}`);

describe('HomeScreen sync — Critical #25 false-success', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockGetPending.mockReset();
    mockTriggerSync.mockReset();
    mockDispatch.mockClear();
    mockState.technician.tasks = [];
    mockConnectivityListener = null;
    mockQueueListener = null;
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test('nothing queued — says so, and never claims a sync happened', async () => {
    // Counter says 1 (stale), but the queue is genuinely empty.
    mockGetPending.mockResolvedValue([]);
    const tree = await renderWith({online: true, pendingCount: 1});

    const banner = findSyncBanner(tree);
    expect(banner).toBeDefined();
    await act(async () => {
      banner.props.onPress();
    });

    expect(mockTriggerSync).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Nothing to Sync',
      expect.stringContaining('no pending changes'),
    );
    expect(alertsShown(alertSpy).join('\n')).not.toMatch(/synced successfully/i);
  });

  test('offline with queued work — refuses to sync, keeps the work, no success claim', async () => {
    mockGetPending.mockResolvedValue([{id: 'a'}, {id: 'b'}]);
    const tree = await renderWith({online: false, pendingCount: 2});

    const banner = findSyncBanner(tree);
    await act(async () => {
      banner.props.onPress();
    });

    expect(mockTriggerSync).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Cannot Sync While Offline',
      expect.stringContaining('2 pending change(s)'),
    );
    expect(alertsShown(alertSpy).join('\n')).not.toMatch(/synced successfully/i);
  });

  test('replay genuinely fails — reports the failure, never "synced successfully"', async () => {
    mockGetPending.mockResolvedValue([{id: 'a'}, {id: 'b'}]);
    mockTriggerSync.mockResolvedValue({
      attempted: 2,
      synced: 0,
      failed: 2,
      remaining: 2,
      errors: ['Job 7 → ACCEPTED: no connection'],
    });
    const tree = await renderWith({online: true, pendingCount: 2});

    const banner = findSyncBanner(tree);
    await act(async () => {
      banner.props.onPress();
    });

    expect(mockTriggerSync).toHaveBeenCalled();
    const shown = alertsShown(alertSpy).join('\n');
    expect(shown).toMatch(/Sync Incomplete/);
    expect(shown).toMatch(/0 of 2 change\(s\) synced/);
    expect(shown).not.toMatch(/synced successfully/i);
  });

  test('partial replay — still not reported as success', async () => {
    mockGetPending.mockResolvedValue([{id: 'a'}, {id: 'b'}]);
    mockTriggerSync.mockResolvedValue({
      attempted: 2,
      synced: 1,
      failed: 1,
      remaining: 1,
      errors: ['Job 8 → COMPLETED: rejected'],
    });
    const tree = await renderWith({online: true, pendingCount: 2});

    const banner = findSyncBanner(tree);
    await act(async () => {
      banner.props.onPress();
    });

    const shown = alertsShown(alertSpy).join('\n');
    expect(shown).toMatch(/Sync Incomplete/);
    expect(shown).not.toMatch(/synced successfully/i);
  });

  test('queue genuinely drained by the server — only then is success claimed', async () => {
    mockGetPending.mockResolvedValue([{id: 'a'}]);
    mockTriggerSync.mockResolvedValue({
      attempted: 1,
      synced: 1,
      failed: 0,
      remaining: 0,
      errors: [],
    });
    const tree = await renderWith({online: true, pendingCount: 1});

    const banner = findSyncBanner(tree);
    await act(async () => {
      banner.props.onPress();
    });

    expect(mockTriggerSync).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Synced',
      '1 pending change(s) synced successfully',
    );
  });
});
