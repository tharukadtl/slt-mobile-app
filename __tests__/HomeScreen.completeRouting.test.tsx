/**
 * Regression coverage for QA_Compliance_Consolidated_Report §2.5 (FR-9),
 * Layer 2 (Mobile Technician) — HomeScreen job-card "✅ Complete" bypass.
 *
 * Original bug: the two "✅ Complete" buttons on the Technician Home job cards
 * (rendered by renderJobActions for the `in_progress` and `hold` statuses) called
 * dispatch(updateTaskStatus({id, status:'COMPLETED'})) DIRECTLY — completing a job
 * from the home screen with NO after-photos and NO customer signature, bypassing the
 * FR-9 signature flow entirely.
 *
 * Fix under test: both onPress handlers now navigate('TaskDetail', {taskId}) instead,
 * routing the technician into the guarded completion flow
 * (TaskDetail -> photos -> Signature -> real signature -> COMPLETED dispatch).
 *
 * These tests render the REAL HomeScreen with react-test-renderer (the sanctioned
 * approach here — @testing-library/react-native is still not installed) for a task
 * in `in_progress` and a task in `hold`, tap the "✅ Complete" button, and assert:
 *   - navigation.navigate was called with ('TaskDetail', {taskId: <id>})
 *   - updateTaskStatus was NOT invoked as a result of the tap
 *   - dispatch was NOT called as a result of the tap
 * i.e. the home-card Complete button no longer completes a job directly.
 *
 * Pre-fix, tapping this button called handleQuickAction(task.id, 'COMPLETED') ->
 * dispatch(updateTaskStatus({id, status:'COMPLETED'})).unwrap(), so both the
 * "navigate to TaskDetail" and "updateTaskStatus not called" assertions below would
 * have failed against the old code — this test genuinely exercises the closed gap.
 */
import React from 'react';
import {TouchableOpacity, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';

// HomeScreen starts a 1s clock interval + a 30s network-check interval. With real
// timers these fire after the test finishes and trigger setState on an unmounted
// tree (post-teardown "import after environment torn down" errors -> nonzero exit).
// Fake timers keep them dormant; each test unmounts to run the cleanup that clears
// them.
jest.useFakeTimers();

// ---- Fake store state the component selects from ----------------------------
// `mock`-prefixed so jest allows referencing it from inside the jest.mock factory.
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

const mockNavigate = jest.fn();
const mockDispatch = jest.fn(() => ({unwrap: () => Promise.resolve()}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
  // No-op: don't run the focus callback (which would dispatch fetch thunks);
  // this test only cares about the Complete-button onPress behaviour.
  useFocusEffect: jest.fn(),
}));
jest.mock('@react-navigation/stack', () => ({}));

jest.mock('@store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (sel: any) => sel(mockState),
}));

// Mock every action creator HomeScreen imports so the real slice (and its
// axios/AsyncStorage/config chain) is never loaded.
jest.mock('@store/slices/technicianSlice', () => {
  const makeThunk = (type: string) =>
    jest.fn((args: any) => ({type, payload: args}));
  return {
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

// HomeScreen now also imports technicianService directly (Material-Delay
// rejection path, SRS 5.3.1.2) — mock it too so the real module (and its
// axios/AsyncStorage/config chain) is never loaded, same reason technicianSlice
// is mocked above. Not exercised by these Complete-button tests.
jest.mock('@services/technicianService', () => ({
  __esModule: true,
  default: {getMyOutstandingMaterialRequests: jest.fn().mockResolvedValue([])},
}));

import HomeScreen from '@screens/technician/HomeScreen';
import {updateTaskStatus} from '@store/slices/technicianSlice';

const updateTaskStatusMock = updateTaskStatus as unknown as jest.Mock;

const makeTask = (id: string, status: string) => ({
  id,
  status,
  priority: 'MEDIUM',
  scheduledDate: '2026-07-20 10:00',
  customerName: 'Jane Doe',
  category: 'broadband',
  estimatedDuration: 2,
  location: {address: '123 Main St'},
});

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

const findCompleteButton = (tree: any) => {
  const buttons = tree.root.findAllByType(TouchableOpacity);
  return buttons.find((b: any) =>
    b.findAllByType(Text).some((t: any) => textOf(t) === '✅ Complete'),
  );
};

const renderForTask = (task: any) => {
  mockState.technician.tasks = [task];
  let tree: any;
  act(() => {
    tree = renderer.create(<HomeScreen />);
  });
  // Clear any calls incurred during render so assertions isolate the tap.
  mockNavigate.mockClear();
  mockDispatch.mockClear();
  updateTaskStatusMock.mockClear();
  return tree;
};

describe('HomeScreen — FR-9 "✅ Complete" no longer completes a job directly', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockDispatch.mockClear();
    updateTaskStatusMock.mockClear();
    mockState.technician.tasks = [];
  });

  test('in_progress card: Complete routes to TaskDetail, does NOT dispatch a status update', async () => {
    const tree = renderForTask(makeTask('IP-1', 'in_progress'));
    const completeBtn = findCompleteButton(tree);
    expect(completeBtn).toBeDefined();

    await act(async () => {
      await completeBtn.props.onPress();
    });

    // Routes into the guarded completion flow instead of completing here.
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('TaskDetail', {taskId: 'IP-1'});

    // No direct completion side effect from the tap.
    expect(updateTaskStatusMock).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });

  test('hold card: Complete routes to TaskDetail, does NOT dispatch a status update', async () => {
    const tree = renderForTask(makeTask('HOLD-1', 'hold'));
    const completeBtn = findCompleteButton(tree);
    expect(completeBtn).toBeDefined();

    await act(async () => {
      await completeBtn.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('TaskDetail', {taskId: 'HOLD-1'});

    expect(updateTaskStatusMock).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });
});
