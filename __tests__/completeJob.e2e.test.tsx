/**
 * JOB-012 (03_JOB_LIFECYCLE, FR-9) — attach before/after photos then complete the job.
 *
 * TOOL SUBSTITUTION: the row maps to Detox (e2e/job/completeJob.e2e.js). Detox builds but cannot
 * run live on this host (project decision of 2026-08-04 — the emulator is software-rendered under
 * virtualization and the ANR watchdog kills the app before Detox's bridge attaches; recorded in
 * docs/SLT_Test_Plan_V1.docx §3). The sanctioned substitute is Jest + react-test-renderer against
 * the REAL screen; precedent __tests__/clientLogin.e2e.test.tsx (AUTH-016).
 *
 * Drives the real TaskDetailScreen: picks a before photo, picks an after photo, taps
 * "✅ Complete Job", and asserts the after-photos are uploaded and the job is handed to the
 * Signature screen carrying those photo URLs.
 *
 * ENDPOINT/FLOW REALITY vs. the row: the row expects the Complete tap to land on a
 * "completionScreen" with the job already COMPLETED. In this build completion is deliberately NOT
 * terminal at this point — TaskDetailScreen uploads the after-photos and then routes to the
 * Signature screen, which performs the actual COMPLETED transition only after a real customer
 * signature is captured (FR-9). That funnel is what is asserted here, and JOB-024
 * (signatureGate.e2e.test.tsx) asserts it is the ONLY path to COMPLETED.
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
  technician: {tasks: [IN_PROGRESS_TASK] as any[], isLoading: false, error: null},
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
    updateTaskStatus: makeThunk('technician/updateTaskStatus'),
  };
});

jest.mock('react-native-maps', () => {
  const React2 = require('react');
  const MapView = React2.forwardRef((props: any, ref: any) =>
    React2.createElement('MapView', props, props.children),
  );
  return {
    __esModule: true,
    default: MapView,
    Marker: (props: any) => React2.createElement('Marker', props, props.children),
    PROVIDER_GOOGLE: 'google',
  };
});

// The image picker is the emulator's gallery in the Detox original. Here it answers immediately
// with a fixed asset uri, which is what "select test image" reduces to.
const mockLaunchCamera = jest.fn();
const mockLaunchImageLibrary = jest.fn();
jest.mock('react-native-image-picker', () => ({
  launchCamera: (...a: any[]) => mockLaunchCamera(...a),
  launchImageLibrary: (...a: any[]) => mockLaunchImageLibrary(...a),
}));

const mockUploadPhotos = jest.fn();
jest.mock('@services/uploadService', () => ({
  __esModule: true,
  default: {uploadPhotos: (...a: any[]) => mockUploadPhotos(...a)},
}));

import TaskDetailScreen from '@screens/technician/TaskDetailScreen';

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

/**
 * Taps "📷 Add Photo" and drives the real Alert action sheet's Gallery branch, which is what
 * "select test image" does on the emulator.
 */
const addPhotoFromGallery = async (tree: any, alertSpy: jest.SpyInstance, uri: string) => {
  mockLaunchImageLibrary.mockImplementationOnce((_opts: any, cb: any) =>
    cb({didCancel: false, assets: [{uri}]}),
  );
  alertSpy.mockClear();
  await tap(tree, 'Add Photo');

  const [title, , buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1] as any[];
  expect(title).toBe('Add Photo');
  const gallery = (buttons as any[]).find(b => b.text === 'Gallery');
  expect(gallery).toBeDefined();
  await act(async () => {
    gallery.onPress();
  });
};

describe('JOB-012 — before/after photos then complete', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockNavigate.mockClear();
    mockDispatch.mockClear();
    mockUploadPhotos.mockClear().mockResolvedValue([
      'http://x/uploads/photos/after-1.jpg',
    ]);
    mockLaunchImageLibrary.mockClear();
    mockState.technician.tasks = [IN_PROGRESS_TASK];
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test('uploadPhotos_completeJob_success', async () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<TaskDetailScreen />);
    });

    // The photo section starts on the Before tab with nothing attached.
    expect(allText(tree)).toContain('Before (0)');
    expect(allText(tree)).toContain('After (0)');

    // ── Steps 1-3: add a BEFORE photo, thumbnail count updates ──────────────────────────
    await addPhotoFromGallery(tree, alertSpy, 'file:///test/before.jpg');
    expect(allText(tree)).toContain('Before (1)');
    expect(allText(tree)).toContain('After (0)');

    // ── Steps 4-6: switch to the After tab and add an AFTER photo ───────────────────────
    await tap(tree, 'After (0)');
    await addPhotoFromGallery(tree, alertSpy, 'file:///test/after.jpg');
    expect(allText(tree)).toContain('After (1)');

    // ── Step 7: tap Complete Job ────────────────────────────────────────────────────────
    mockNavigate.mockClear();
    await tap(tree, '✅ Complete Job');

    // ── Step 8: the after-photos are uploaded, and ONLY the after-photos ────────────────
    expect(mockUploadPhotos).toHaveBeenCalledTimes(1);
    expect(mockUploadPhotos).toHaveBeenCalledWith(['file:///test/after.jpg']);

    // The completion hands off to the Signature screen carrying the uploaded photo URLs —
    // it does NOT complete the job here (FR-9; see JOB-024).
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('Signature', {
      taskId: TASK_ID,
      completionPhotoUrls: 'http://x/uploads/photos/after-1.jpg',
    });

    act(() => tree.unmount());
  });

  /**
   * The server hard-requires at least one after-photo to complete (JobService.updateJobStatus), so
   * the client must not even attempt the upload/handoff without one.
   */
  test('completing with no after photo is blocked before any upload', async () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<TaskDetailScreen />);
    });

    // A BEFORE photo alone is not enough.
    await addPhotoFromGallery(tree, alertSpy, 'file:///test/before.jpg');
    expect(allText(tree)).toContain('Before (1)');

    alertSpy.mockClear();
    mockNavigate.mockClear();
    await tap(tree, '✅ Complete Job');

    expect(alertSpy).toHaveBeenCalledWith(
      'After Photos Required',
      expect.stringContaining('at least one after photo'),
    );
    expect(mockUploadPhotos).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });
});
