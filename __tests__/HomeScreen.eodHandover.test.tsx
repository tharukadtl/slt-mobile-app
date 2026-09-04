/**
 * JOB-025 (03_JOB_LIFECYCLE, FR-20 / SRS 5.3.1.4) — EOD pending-task handover.
 *
 * At check-out, every job the technician still has open must be listed INDIVIDUALLY and must carry
 * its OWN mandatory explanation — not one blanket reason covering all of them, and not an optional
 * note that can be skipped. Nothing exercised this before.
 *
 * Driven through the REAL TechnicianHomeScreen with react-test-renderer (the sanctioned renderer
 * here — @testing-library/react-native is genuinely not installed, so the sheet's "Jest + RNTL"
 * Tool value is aspirational; same substitution as HomeScreen.completeRouting.test.tsx).
 *
 * SCOPE NOTE: the row's Expected Result also requires "Fault.status reset to ASSIGNED (not left
 * IN_PROGRESS)". That is a server-side effect of AttendanceService.checkOut and cannot be observed
 * from a mobile component test; it is covered by
 * fieldops/src/test/java/lk/slt/fieldops/service/FaultStatusResetTest.java (JOB-026), which asserts
 * the same reset on the rejection path and the terminal-fault guard both paths share. What IS
 * asserted here is the client half: the per-job reasons the technician enters are the ones actually
 * sent to the server as openJobReasons, which is the input that reset depends on.
 */
import React from 'react';
import {TouchableOpacity, TextInput, Text, Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';

jest.useFakeTimers();

const CHECK_IN_TIME = '2026-08-06T08:00:00.000Z';

const mockState: any = {
  auth: {user: {name: 'Test Tech'}},
  technician: {
    tasks: [] as any[],
    // A real BOD check-in today, so the EOD button is live.
    bodCheckIn: {checkInTime: CHECK_IN_TIME},
    todayAttendance: {currentStatus: 'CHECKED_IN'},
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

// performCheckOut resolves the technician's GPS before dispatching. Answer immediately with a
// fixed position so the checkout completes synchronously inside act().
jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn((success: any) =>
    success({coords: {latitude: 6.9271, longitude: 79.8612}}),
  ),
}));

jest.mock('@services/technicianService', () => ({
  __esModule: true,
  default: {getMyOutstandingMaterialRequests: jest.fn().mockResolvedValue([])},
}));

// The screen reverse-geocodes the checkout coordinates via nominatim.
global.fetch = jest.fn().mockResolvedValue({
  json: async () => ({display_name: 'Colombo 03, Sri Lanka'}),
}) as any;

import HomeScreen from '@screens/technician/HomeScreen';
import {submitEODCheckOut} from '@store/slices/technicianSlice';

const submitEODCheckOutMock = submitEODCheckOut as unknown as jest.Mock;

const openJob = (id: string, jobNumber: string, status: string, customerName: string) => ({
  id,
  jobNumber,
  status,
  priority: 'MEDIUM',
  scheduledDate: '2026-08-06 10:00',
  customerName,
  category: 'broadband',
  estimatedDuration: 2,
  location: {address: '123 Main St'},
});

const JOB_1 = openJob('1', 'JOB-2026-00001', 'in_progress', 'Jane Doe');
const JOB_2 = openJob('2', 'JOB-2026-00002', 'hold', 'John Smith');

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.map((x: any) => String(x)).join('') : String(c);
};

const allText = (tree: any) => tree.root.findAllByType(Text).map(textOf);

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

/** Every per-job handover reason input in the EOD modal, in render order. */
const handoverInputs = (tree: any) =>
  tree.root
    .findAllByType(TextInput)
    .filter((i: any) => i.props.placeholder === "Why wasn't this completed?");

const fill = async (input: any, text: string) => {
  await act(async () => {
    input.props.onChangeText(text);
  });
};

const render = (tasks: any[]) => {
  mockState.technician.tasks = tasks;
  let tree: any;
  act(() => {
    tree = renderer.create(<HomeScreen />);
  });
  return tree;
};

describe('HomeScreen EOD handover — SRS 5.3.1.4 mandatory per-job reason', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDispatch.mockClear();
    submitEODCheckOutMock.mockClear();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test('mandatoryPerJobReason', async () => {
    const tree = render([JOB_1, JOB_2]);

    // ── Step 1: tap EOD Check-Out with two jobs still open ──────────────────────────────
    await tap(tree, 'Checkout');

    // ── Step 2: the modal lists BOTH open jobs individually ─────────────────────────────
    const inputs = handoverInputs(tree);
    expect(inputs).toHaveLength(2);

    const modalText = allText(tree).join(' | ');
    expect(modalText).toContain('JOB-2026-00001');
    expect(modalText).toContain('JOB-2026-00002');
    expect(modalText).toContain('Jane Doe');
    expect(modalText).toContain('John Smith');
    // It says how many are open, so this is a per-job list and not one lumped prompt.
    expect(modalText).toContain('2 jobs still open');

    // A native confirm must NOT have been used — that path can't hold multiple inputs.
    expect(submitEODCheckOutMock).not.toHaveBeenCalled();

    // ── Step 3: fill only ONE reason and try to submit ──────────────────────────────────
    await fill(inputs[0], 'Client unavailable');
    await tap(tree, 'Confirm Check-Out');

    // ── Step 4: blocked, and it names the job that is missing a reason ──────────────────
    expect(submitEODCheckOutMock).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Reason Required',
      expect.stringContaining('JOB-2026-00002'),
    );
    // The job that DOES have a reason must not be named as missing.
    const blockedMessage = alertSpy.mock.calls[alertSpy.mock.calls.length - 1][1] as string;
    expect(blockedMessage).not.toContain('JOB-2026-00001');

    // Whitespace is not a reason — a blank-but-not-empty entry is still blocked.
    alertSpy.mockClear();
    await fill(handoverInputs(tree)[1], '    ');
    await tap(tree, 'Confirm Check-Out');
    expect(submitEODCheckOutMock).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Reason Required',
      expect.stringContaining('JOB-2026-00002'),
    );

    // ── Step 5: fill both reasons and submit ────────────────────────────────────────────
    alertSpy.mockClear();
    await fill(handoverInputs(tree)[1], 'Ran out of time');
    await tap(tree, 'Confirm Check-Out');

    // ── Step 6: each job carries its OWN distinct reason to the server ──────────────────
    expect(submitEODCheckOutMock).toHaveBeenCalledTimes(1);
    const payload = submitEODCheckOutMock.mock.calls[0][0];
    expect(payload.openJobReasons).toEqual([
      {jobId: '1', reason: 'Client unavailable'},
      {jobId: '2', reason: 'Ran out of time'},
    ]);
    // Not one blanket reason applied to both.
    const reasons = payload.openJobReasons.map((r: any) => r.reason);
    expect(new Set(reasons).size).toBe(2);
    expect(payload.latitude).toBe(6.9271);
    expect(payload.longitude).toBe(79.8612);

    act(() => tree.unmount());
  });

  /**
   * A technician with nothing open still checks out through the plain confirm path — the handover
   * modal must not appear and must not become a pointless obstacle.
   */
  test('no open jobs: check-out does not raise the handover modal', async () => {
    const tree = render([{...JOB_1, status: 'completed'}]);

    await tap(tree, 'Checkout');

    expect(handoverInputs(tree)).toHaveLength(0);
    expect(alertSpy).toHaveBeenCalledWith(
      'EOD Check-Out',
      expect.stringContaining('Confirm check-out?'),
      expect.any(Array),
    );

    act(() => tree.unmount());
  });
});
