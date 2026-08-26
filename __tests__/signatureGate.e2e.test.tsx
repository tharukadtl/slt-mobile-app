/**
 * JOB-024 (03_JOB_LIFECYCLE, FR-9) — there is exactly ONE path to COMPLETED, and it runs through
 * the Signature screen. No shortcut from a Home job card, and no completion from the job detail
 * screen without first capturing a real customer signature.
 *
 * TOOL SUBSTITUTION: the row maps to Detox (signatureGate.e2e.ts). Detox builds but cannot run live
 * on this host (project decision of 2026-08-04 — software-rendered emulator under virtualization,
 * ANR watchdog kills the app before Detox's bridge attaches; docs/SLT_Test_Plan_V1.docx §3). The
 * sanctioned substitute is Jest + react-test-renderer against the REAL screens; precedent
 * __tests__/clientLogin.e2e.test.tsx (AUTH-016).
 *
 * This walks the whole funnel end to end in one test, which is what makes it an "only path"
 * assertion rather than three unrelated checks:
 *
 *   1. HomeScreen  — tapping "✅ Complete" on an in_progress card routes to TaskDetail and
 *                    dispatches NOTHING (the FR-9 bypass that was closed).
 *   2. TaskDetail  — tapping "✅ Complete Job" uploads the after-photos and routes to Signature,
 *                    still dispatching NO status update.
 *   3. Signature   — an empty or placeholder signature is refused; only a real captured signature
 *                    dispatches status 'completed'.
 *
 * Existing sibling coverage: HomeScreen.completeRouting.test.tsx covers step 1 in isolation and
 * SignatureScreen.guard.test.tsx covers step 3 in isolation. Step 2 — the TaskDetail link that
 * joins them — had no coverage, and neither did the end-to-end "no other route reaches COMPLETED"
 * property, which is what this file adds.
 */
import React from 'react';
import {TouchableOpacity, Text, Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';

jest.useFakeTimers();

const TASK_ID = '1042';

const IN_PROGRESS_TASK = {
  id: TASK_ID,
  jobNumber: 'JOB-2026-01042',
  status: 'in_progress',
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
    tasks: [IN_PROGRESS_TASK] as any[],
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

// The Signature screen reads its params from the route; the test rewrites this between steps so
// the handoff payload TaskDetail produced is genuinely what Signature consumes.
let mockRouteParams: any = {taskId: TASK_ID};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: mockGoBack}),
  useRoute: () => ({params: mockRouteParams}),
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
  getCurrentPosition: jest.fn(),
}));

jest.mock('react-native-maps', () => {
  const React2 = require('react');
  const MapView = React2.forwardRef((props: any) =>
    React2.createElement('MapView', props, props.children),
  );
  return {
    __esModule: true,
    default: MapView,
    Marker: (props: any) => React2.createElement('Marker', props, props.children),
    PROVIDER_GOOGLE: 'google',
  };
});

const mockLaunchImageLibrary = jest.fn();
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: (...a: any[]) => mockLaunchImageLibrary(...a),
}));

const mockUploadPhotos = jest.fn();
jest.mock('@services/uploadService', () => ({
  __esModule: true,
  default: {uploadPhotos: (...a: any[]) => mockUploadPhotos(...a)},
}));

const mockSubmitSignature = jest.fn();
jest.mock('@services/technicianService', () => ({
  __esModule: true,
  default: {
    getMyOutstandingMaterialRequests: jest.fn().mockResolvedValue([]),
    submitSignature: (...a: any[]) => mockSubmitSignature(...a),
  },
}));

// The signature canvas is native; capture its callbacks so the test can drive a real capture,
// an empty capture, and the placeholder the FR-9 regression shipped.
const canvasProps: {onOK?: (s: string) => void; onEmpty?: () => void} = {};
jest.mock('react-native-signature-canvas', () => {
  const React2 = require('react');
  return {
    __esModule: true,
    default: (props: any) => {
      canvasProps.onOK = props.onOK;
      canvasProps.onEmpty = props.onEmpty;
      return React2.createElement('SignatureCanvas', null);
    },
  };
});

import HomeScreen from '@screens/technician/HomeScreen';
import TaskDetailScreen from '@screens/technician/TaskDetailScreen';
import SignatureScreen from '@screens/technician/SignatureScreen';
import {updateTaskStatus} from '@store/slices/technicianSlice';

const updateTaskStatusMock = updateTaskStatus as unknown as jest.Mock;

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

describe('JOB-024 — the Signature screen is the only path to COMPLETED', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockNavigate.mockClear();
    mockDispatch.mockClear();
    updateTaskStatusMock.mockClear();
    mockSubmitSignature.mockClear().mockResolvedValue(undefined);
    mockUploadPhotos.mockClear().mockResolvedValue([
      'http://x/uploads/photos/after-1.jpg',
    ]);
    mockLaunchImageLibrary.mockClear();
    mockState.technician.tasks = [IN_PROGRESS_TASK];
    mockRouteParams = {taskId: TASK_ID};
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test('onlyPathToCompleted', async () => {
    // ══ Step 1: the HomeScreen "Complete" shortcut does not complete anything ═══════════
    const home = mount(HomeScreen);
    mockNavigate.mockClear();
    mockDispatch.mockClear();
    updateTaskStatusMock.mockClear();

    await tap(home, '✅ Complete');

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('TaskDetail', {taskId: TASK_ID});
    // Nothing was completed here — this is the FR-9 bypass that was closed.
    expect(updateTaskStatusMock).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
    act(() => home.unmount());

    // ══ Step 2: TaskDetail routes on to Signature, still completing nothing ════════════
    const detail = mount(TaskDetailScreen);

    // Attach the after-photo the server requires (JobService.updateJobStatus).
    mockLaunchImageLibrary.mockImplementationOnce((_o: any, cb: any) =>
      cb({didCancel: false, assets: [{uri: 'file:///test/after.jpg'}]}),
    );
    await tap(detail, 'After (0)');
    alertSpy.mockClear();
    await tap(detail, 'Add Photo');
    const [, , buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1] as any[];
    await act(async () => {
      (buttons as any[]).find(b => b.text === 'Gallery').onPress();
    });
    expect(allText(detail)).toContain('After (1)');

    mockNavigate.mockClear();
    updateTaskStatusMock.mockClear();
    await tap(detail, '✅ Complete Job');

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [screen, params] = mockNavigate.mock.calls[0];
    expect(screen).toBe('Signature');
    expect(params.taskId).toBe(TASK_ID);
    expect(params.completionPhotoUrls).toBe('http://x/uploads/photos/after-1.jpg');
    // Still nothing completed — this is the link that had no coverage before.
    expect(updateTaskStatusMock).not.toHaveBeenCalled();
    act(() => detail.unmount());

    // ══ Step 3: only a real signature completes the job ════════════════════════════════
    // The Signature screen consumes exactly the params TaskDetail just produced.
    mockRouteParams = params;
    const signature = mount(SignatureScreen);

    // 3a — an empty capture is refused.
    updateTaskStatusMock.mockClear();
    alertSpy.mockClear();
    await act(async () => {
      canvasProps.onEmpty?.();
    });
    await tap(signature, 'Complete');
    expect(updateTaskStatusMock).not.toHaveBeenCalled();
    expect(mockSubmitSignature).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();

    // 3b — the literal placeholder the FR-9 regression shipped is refused.
    updateTaskStatusMock.mockClear();
    alertSpy.mockClear();
    await act(async () => {
      canvasProps.onOK?.('signature_placeholder');
    });
    await tap(signature, 'Complete');
    expect(updateTaskStatusMock).not.toHaveBeenCalled();
    expect(mockSubmitSignature).not.toHaveBeenCalled();

    // 3c — a real captured signature completes the job.
    updateTaskStatusMock.mockClear();
    alertSpy.mockClear();
    const realSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA';
    await act(async () => {
      canvasProps.onOK?.(realSignature);
    });
    await tap(signature, 'Complete');

    expect(mockSubmitSignature).toHaveBeenCalledTimes(1);
    expect(mockSubmitSignature).toHaveBeenCalledWith(TASK_ID, realSignature);
    expect(updateTaskStatusMock).toHaveBeenCalledTimes(1);
    const completion = updateTaskStatusMock.mock.calls[0][0];
    expect(completion.id).toBe(TASK_ID);
    expect(String(completion.status).toLowerCase()).toBe('completed');
    // The photos gathered two screens earlier ride along with the completion.
    expect(completion.completionPhotoUrls).toBe('http://x/uploads/photos/after-1.jpg');

    act(() => signature.unmount());
  });
});
