/**
 * JOB-011 (03_JOB_LIFECYCLE, FR-7) — accept a job, navigate to site, mark arrival, timer starts.
 *
 * TOOL SUBSTITUTION: the row maps to Detox (e2e/job/acceptAndNavigate.e2e.js). Detox builds but
 * cannot run live on this host — the emulator is software-rendered under virtualization and the ANR
 * watchdog kills the app before Detox's bridge attaches (project decision of 2026-08-04, recorded
 * in docs/SLT_Test_Plan_V1.docx §3 and the QA_Compliance_Consolidated_Report Resolution Log). The
 * sanctioned substitute is Jest + react-test-renderer, driving the REAL screens; precedent
 * __tests__/clientLogin.e2e.test.tsx (AUTH-016).
 *
 * The row's flow spans three real screens, so all three are rendered in sequence and the handoff
 * between them is asserted by the navigation payload, which is exactly what Detox's screen
 * transitions would have observed:
 *
 *   HomeScreen  — job card 1042, HIGH priority badge, "✅ Accept" dispatches ACCEPTED,
 *                 "🗺️ Navigate" hands off to the Navigation screen with this taskId
 *   NavigationScreen — map + route rendered, "✅ I Have Arrived" dispatches markArrived
 *   TaskDetailScreen — once in_progress, the work timer is mounted and ticking
 */
import React from 'react';
import {TouchableOpacity, Text, Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {colors} from '@theme/colors';

jest.useFakeTimers();

const TASK_ID = '1042';

const HIGH_PRIORITY_TASK = {
  id: TASK_ID,
  jobNumber: 'JOB-2026-01042',
  status: 'pending',
  priority: 'HIGH',
  scheduledDate: '2026-08-06 10:00',
  customerName: 'Jane Doe',
  category: 'broadband',
  estimatedDuration: 2,
  location: {address: '123 Main St', latitude: 6.9271, longitude: 79.8612},
};

const mockState: any = {
  auth: {user: {name: 'Test Tech'}},
  technician: {
    tasks: [HIGH_PRIORITY_TASK] as any[],
    bodCheckIn: null,
    todayAttendance: null,
    isLoading: false,
    error: null,
  },
};

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockDispatch = jest.fn(() => ({
  unwrap: () => Promise.resolve(),
  catch: () => undefined,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: mockGoBack}),
  useRoute: () => ({params: {taskId: '1042'}}),
  useFocusEffect: jest.fn(),
}));
jest.mock('@react-navigation/stack', () => ({}));

jest.mock('@store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (sel: any) => sel(mockState),
}));

jest.mock('@store/slices/technicianSlice', () => {
  const makeThunk = (type: string) => {
    const fn: any = jest.fn((args: any) => ({type, payload: args}));
    fn.fulfilled = {match: () => true};
    return fn;
  };
  return {
    fetchTasks: makeThunk('technician/fetchTasks'),
    fetchTodayAttendance: makeThunk('technician/fetchTodayAttendance'),
    submitBODCheckIn: makeThunk('technician/submitBODCheckIn'),
    submitEODCheckOut: makeThunk('technician/submitEODCheckOut'),
    setHasBODToday: makeThunk('technician/setHasBODToday'),
    updateTaskStatus: makeThunk('technician/updateTaskStatus'),
    markArrived: makeThunk('technician/markArrived'),
  };
});

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn((success: any) =>
    success({coords: {latitude: 6.9271, longitude: 79.8612}}),
  ),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
}));

jest.mock('react-native-maps', () => {
  const React2 = require('react');
  const MapView = React2.forwardRef((props: any, ref: any) => {
    React2.useImperativeHandle(ref, () => ({
      fitToCoordinates: jest.fn(),
      animateToRegion: jest.fn(),
    }));
    return React2.createElement('MapView', props, props.children);
  });
  return {
    __esModule: true,
    default: MapView,
    Marker: (props: any) => React2.createElement('Marker', props, props.children),
    Polyline: (props: any) => React2.createElement('Polyline', props),
    PROVIDER_GOOGLE: 'google',
  };
});

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('@services/uploadService', () => ({
  __esModule: true,
  default: {uploadPhotos: jest.fn().mockResolvedValue([])},
}));

jest.mock('@services/technicianService', () => ({
  __esModule: true,
  default: {
    getMyOutstandingMaterialRequests: jest.fn().mockResolvedValue([]),
    // Shape returned by fieldops' /api/location/shortest-path (see
    // NavigationScreen.fetchShortestPath): waypoints[{lat,lng}], distanceKm, etaMinutes, routed.
    getShortestPath: jest.fn().mockResolvedValue({
      // ETA of 2 min: NavigationScreen only renders "✅ I Have Arrived" when
      // etaMinutes is in (0, 2], i.e. the technician is essentially on site.
      routed: true,
      distanceKm: 0.4,
      etaMinutes: 2,
      waypoints: [
        {lat: 6.9271, lng: 79.8612},
        {lat: 6.9500, lng: 79.8700},
      ],
    }),
  },
}));

import HomeScreen from '@screens/technician/HomeScreen';
import NavigationScreen from '@screens/technician/NavigationScreen';
import TaskDetailScreen from '@screens/technician/TaskDetailScreen';
import {updateTaskStatus, markArrived} from '@store/slices/technicianSlice';

const updateTaskStatusMock = updateTaskStatus as unknown as jest.Mock;
const markArrivedMock = markArrived as unknown as jest.Mock;

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.map((x: any) => String(x)).join('') : String(c);
};

const allText = (tree: any) => tree.root.findAllByType(Text).map(textOf).join(' | ');

const tappable = (tree: any, label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find((b: any) => b.findAllByType(Text).some((t: any) => textOf(t).includes(label)));

const tap = async (tree: any, label: string) => {
  const btn = tappable(tree, label);
  expect(btn).toBeDefined();
  await act(async () => {
    await btn.props.onPress();
  });
};

const mount = (Component: any) => {
  let tree: any;
  act(() => {
    tree = renderer.create(<Component />);
  });
  return tree;
};

describe('JOB-011 — accept job, navigate to site, arrive, timer starts', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockNavigate.mockClear();
    mockDispatch.mockClear();
    updateTaskStatusMock.mockClear();
    markArrivedMock.mockClear();
    mockState.technician.tasks = [HIGH_PRIORITY_TASK];
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test('acceptJob_navigateToSite_timerStarts', async () => {
    // ── Step 1: the job card for 1042 is on screen ──────────────────────────────────────
    const home = mount(HomeScreen);
    // The card is titled by task id ("#1042"), which is Detox's by.id('jobCard-1042') target.
    expect(allText(home)).toContain('#1042');
    expect(allText(home)).toContain('Jane Doe');

    // ── Step 2: HIGH priority badge, rendered in the error/red colour ───────────────────
    expect(allText(home)).toContain('HIGH PRIORITY');
    const priorityLabel = home.root
      .findAllByType(Text)
      .find((t: any) => textOf(t).includes('HIGH PRIORITY'));
    const priorityStyle = ([] as any[]).concat(priorityLabel.props.style ?? []).filter(Boolean);
    expect(priorityStyle.some((s: any) => s && s.color === colors.error)).toBe(true);

    // ── Step 3: tap Accept ──────────────────────────────────────────────────────────────
    await tap(home, '✅ Accept');
    expect(updateTaskStatusMock).toHaveBeenCalledWith({id: TASK_ID, status: 'ACCEPTED'});

    // ── Steps 4-5: the accepted job now offers the next step, not Accept again ──────────
    updateTaskStatusMock.mockClear();
    mockState.technician.tasks = [{...HIGH_PRIORITY_TASK, status: 'accepted'}];
    const accepted = mount(HomeScreen);
    expect(allText(accepted)).toContain('ACCEPTED');
    expect(tappable(accepted, '✅ Accept')).toBeUndefined();

    // ── Step 6: tap Navigate — hands off to the Navigation screen for THIS task ─────────
    mockNavigate.mockClear();
    await tap(accepted, '🗺️ Navigate');
    expect(mockNavigate).toHaveBeenCalledWith('Navigation', {taskId: TASK_ID});
    act(() => accepted.unmount());
    act(() => home.unmount());

    // ── Steps 7-8: the Navigation screen renders a map and a route ──────────────────────
    mockState.technician.tasks = [{...HIGH_PRIORITY_TASK, status: 'travelling'}];
    const nav = mount(NavigationScreen);
    await act(async () => {
      await Promise.resolve();
    });
    expect(nav.root.findAllByType('MapView').length).toBeGreaterThan(0);
    expect(nav.root.findAllByType('Polyline').length).toBeGreaterThan(0);
    // Distance / ETA guidance is present (this build shows routed distance + duration rather
    // than turn-by-turn instructions — see NavigationScreen.honesty.test.tsx).
    expect(allText(nav)).toMatch(/km|min/i);

    // ── Step 9: tap I Have Arrived ──────────────────────────────────────────────────────
    await tap(nav, 'I Have Arrived');
    expect(markArrivedMock).toHaveBeenCalledWith(TASK_ID);
    act(() => nav.unmount());

    // ── Steps 10-11: once work has started, the timer is mounted and ticking ────────────
    mockState.technician.tasks = [{...HIGH_PRIORITY_TASK, status: 'in_progress'}];
    const detail = mount(TaskDetailScreen);
    expect(allText(detail)).toContain('Work Timer');
    expect(allText(detail)).toContain('00:00:00');

    // Advance the clock — the elapsed readout must actually move, not sit at zero.
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    const ticked = allText(detail);
    expect(ticked).toMatch(/00:00:0[1-9]/);

    act(() => detail.unmount());
  });
});
