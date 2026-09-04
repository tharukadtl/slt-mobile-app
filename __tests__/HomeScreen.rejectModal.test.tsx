/**
 * JOB-021 and JOB-022 (03_JOB_LIFECYCLE, FR-8 / SRS 5.3.1.2) — the two categorized on-site
 * rejection paths, which must be distinguishable from a generic reject in the Team Lead's queue:
 *
 *   JOB-021 — "Issue Mismatch": the technician reports that the issue actually observed on site is
 *             a different type than what was reported, and must say which type.
 *   JOB-022 — "Material Delay": the rejection is linked to a real, verified outstanding
 *             MaterialRequest for this job, not free text.
 *
 * Both are driven through the REAL TechnicianHomeScreen with react-test-renderer — the sanctioned
 * renderer in this project (@testing-library/react-native is genuinely not installed, so the
 * sheet's "Jest + RNTL" Tool value is aspirational; see HomeScreen.completeRouting.test.tsx and
 * SignatureScreen.guard.test.tsx for the same substitution). The real reject modal is opened by
 * tapping the real "❌ Reject" button on a job card, the real category/issue-type/request chips are
 * tapped, and the payload dispatched to updateTaskStatus is asserted.
 *
 * The guards are asserted too (submit blocked with no category; ISSUE_MISMATCH blocked with no
 * observed type), since "categorized" is worthless if the category can be skipped.
 */
import React from 'react';
import {TouchableOpacity, TextInput, Text, Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';

// HomeScreen starts a 1s clock interval and a 30s network-check interval; with real timers these
// fire after teardown and setState on an unmounted tree. Same reason as
// HomeScreen.completeRouting.test.tsx.
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

const mockNavigate = jest.fn();
const mockDispatch = jest.fn(() => ({
  unwrap: () => Promise.resolve(),
  catch: () => undefined,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
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

// The Material-Delay path calls this for real. Each test sets its resolved value.
const mockGetOutstanding = jest.fn().mockResolvedValue([]);
jest.mock('@services/technicianService', () => ({
  __esModule: true,
  default: {getMyOutstandingMaterialRequests: (...a: any[]) => mockGetOutstanding(...a)},
}));

import HomeScreen from '@screens/technician/HomeScreen';
import {updateTaskStatus} from '@store/slices/technicianSlice';

const updateTaskStatusMock = updateTaskStatus as unknown as jest.Mock;

const TASK_ID = '1042';

const makeTask = (status = 'in_progress') => ({
  id: TASK_ID,
  jobNumber: 'JOB-2026-01042',
  status,
  priority: 'HIGH',
  scheduledDate: '2026-08-06 10:00',
  customerName: 'Jane Doe',
  category: 'broadband',
  estimatedDuration: 2,
  location: {address: '123 Main St'},
});

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.map((x: any) => String(x)).join('') : String(c);
};

/** Finds the first TouchableOpacity whose rendered text contains `label`. */
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

const typeReason = async (tree: any, text: string) => {
  const input = tree.root
    .findAllByType(TextInput)
    .find((i: any) => i.props.placeholder === 'Enter reason...');
  expect(input).toBeDefined();
  await act(async () => {
    input.props.onChangeText(text);
  });
};

/** The payload the component handed to updateTaskStatus on the last call. */
const lastPayload = () => {
  expect(updateTaskStatusMock).toHaveBeenCalled();
  return updateTaskStatusMock.mock.calls[updateTaskStatusMock.mock.calls.length - 1][0];
};

const render = (task: any = makeTask()) => {
  mockState.technician.tasks = [task];
  let tree: any;
  act(() => {
    tree = renderer.create(<HomeScreen />);
  });
  return tree;
};

describe('HomeScreen reject modal — SRS 5.3.1.2 categorized rejection', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockNavigate.mockClear();
    mockDispatch.mockClear();
    updateTaskStatusMock.mockClear();
    mockGetOutstanding.mockClear().mockResolvedValue([]);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // JOB-021
  // ══════════════════════════════════════════════════════════════════════════

  test('issueMismatchCategorization', async () => {
    const tree = render();

    // ── Step 1: tap Reject on the job card ──────────────────────────────────────────────
    await tap(tree, '❌ Reject');

    // The modal is a categorization step, not a bare text box.
    expect(tappable(tree, 'Issue Mismatch')).toBeDefined();
    expect(tappable(tree, 'Material Delay')).toBeDefined();

    // Guard: submitting with no category selected must be blocked.
    await typeReason(tree, 'Actually a fiber fault');
    await tap(tree, '❌ Confirm Reject');
    expect(updateTaskStatusMock).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Category Required',
      expect.stringContaining('why this job is being rejected'),
    );

    // ── Step 2: select the Issue Mismatch category ──────────────────────────────────────
    alertSpy.mockClear();
    await tap(tree, 'Issue Mismatch');

    // Guard: ISSUE_MISMATCH without an observed type must be blocked — the whole point of the
    // category is recording WHAT was actually found.
    await tap(tree, '❌ Confirm Reject');
    expect(updateTaskStatusMock).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Issue Type Required',
      expect.stringContaining('actually observed on-site'),
    );

    // ── Step 3: select the observed issue type (reported INTERNET, observed FIBER) ──────
    await tap(tree, 'Fiber');

    // ── Step 4: submit ──────────────────────────────────────────────────────────────────
    await typeReason(tree, 'Actually a fiber fault');
    await tap(tree, '❌ Confirm Reject');

    // ── Step 5: the dispatched payload carries the categorization ───────────────────────
    const payload = lastPayload();
    expect(payload.id).toBe(TASK_ID);
    expect(payload.status).toBe('REJECTED');
    expect(payload.rejectionCategory).toBe('ISSUE_MISMATCH');
    expect(payload.observedIssueType).toBe('FIBER');
    expect(payload.reason).toBe('Actually a fiber fault');
    // A generic reject would carry neither of the two fields above — that is exactly what makes
    // this distinguishable in the Team Lead's queue.
    expect(payload.linkedMaterialRequestId).toBeUndefined();

    act(() => tree.unmount());
  });

  // ══════════════════════════════════════════════════════════════════════════
  // JOB-022
  // ══════════════════════════════════════════════════════════════════════════

  test('materialDelayLinksRequest', async () => {
    const outstandingRequestId = 77;
    // Two outstanding requests come back from the server; only the one tied to THIS job's taskId
    // may be offered, so the picker cannot link a request belonging to another job.
    mockGetOutstanding.mockResolvedValue([
      {
        id: outstandingRequestId,
        requestNumber: 'MR-2026-0077',
        status: 'PENDING',
        totalItems: 3,
        submittedTimeAgo: '2 hours ago',
        taskId: TASK_ID,
      },
      {
        id: 999,
        requestNumber: 'MR-2026-0999',
        status: 'APPROVED',
        totalItems: 1,
        submittedTimeAgo: '1 day ago',
        taskId: 'SOME-OTHER-JOB',
      },
    ]);

    const tree = render();

    // ── Step 1: tap Reject ──────────────────────────────────────────────────────────────
    await tap(tree, '❌ Reject');

    // ── Step 2: select the Material Delay category ──────────────────────────────────────
    await tap(tree, 'Material Delay');
    expect(mockGetOutstanding).toHaveBeenCalledTimes(1);

    // ── Step 3: the picker shows this job's outstanding request, and only that one ──────
    expect(tappable(tree, 'MR-2026-0077')).toBeDefined();
    expect(tappable(tree, 'MR-2026-0999')).toBeUndefined();
    // The row shows enough to verify it is genuinely still outstanding.
    const requestRow = tappable(tree, 'MR-2026-0077');
    const rowText = requestRow.findAllByType(Text).map(textOf).join(' | ');
    expect(rowText).toContain('PENDING');

    await tap(tree, 'MR-2026-0077');

    // ── Step 4: submit ──────────────────────────────────────────────────────────────────
    await typeReason(tree, 'Waiting on fiber cable from stores');
    await tap(tree, '❌ Confirm Reject');

    // ── Step 5: the dispatched payload links the real request ───────────────────────────
    const payload = lastPayload();
    expect(payload.id).toBe(TASK_ID);
    expect(payload.status).toBe('REJECTED');
    expect(payload.rejectionCategory).toBe('MATERIAL_DELAY');
    expect(payload.linkedMaterialRequestId).toBe(outstandingRequestId);
    expect(payload.reason).toBe('Waiting on fiber cable from stores');
    // Material delay is not an issue mismatch — the two categories must not bleed together.
    expect(payload.observedIssueType).toBeUndefined();

    act(() => tree.unmount());
  });

  /**
   * A reason is still mandatory on top of the category — the category replaces guesswork, it does
   * not replace the technician's explanation.
   */
  test('reason is still mandatory once a category is chosen', async () => {
    const tree = render();

    await tap(tree, '❌ Reject');
    await tap(tree, 'Other');
    await tap(tree, '❌ Confirm Reject');

    expect(updateTaskStatusMock).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Reason Required',
      expect.stringContaining('reason'),
    );

    act(() => tree.unmount());
  });
});
