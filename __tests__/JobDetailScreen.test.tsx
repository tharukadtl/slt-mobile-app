/**
 * JOB-013 (03_JOB_LIFECYCLE, FR-8) — the job detail screen must render every field a technician
 * needs to decide on a job: customer address, fault category, a correctly-coloured priority badge,
 * the job description, and both Accept and Reject actions.
 *
 * MAPPING NOTE: the row maps to "JobDetailScreen.test.jsx" with Tool "Jest+RTL". There is no
 * component named JobDetailScreen in either app. The technician's job-detail screen is
 * src/screens/technician/TaskDetailScreen.tsx — same role, same fields, and the only screen that
 * takes a single job and shows its full detail — so that is what is exercised. The web admin portal
 * has no such component (only pages/Jobs/JobsPage.js, a list) and no @testing-library/react
 * installed, so a .jsx test there is not a viable reading.
 *
 * TOOL NOTE: "Jest+RTL" — @testing-library/react-native is genuinely not installed in this project
 * (see package.json); react-test-renderer is the sanctioned renderer here, as in every other mobile
 * test in this directory.
 *
 * SHAPE NOTE: the row renders `<JobDetailScreen job={mockJob}/>`. TaskDetailScreen takes a
 * `taskId` route param and selects the job out of the technician slice, so the mock job is seeded
 * into that store state instead. Same input, real wiring.
 */
import React from 'react';
import {TouchableOpacity, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {colors} from '@theme/colors';

jest.useFakeTimers();

const TASK_ID = '1042';

/** The row's mock: a HIGH priority BROADBAND job. */
const mockJob = {
  id: TASK_ID,
  jobNumber: 'JOB-2026-01042',
  status: 'assigned',
  priority: 'HIGH',
  category: 'BROADBAND',
  description: 'Customer reports no internet since 08:00; ONT power LED is off.',
  scheduledDate: '2026-08-06 10:00',
  customerName: 'Jane Doe',
  estimatedDuration: 2,
  location: {
    address: 'No. 5 Main Street, Colombo 03',
    latitude: 6.9271,
    longitude: 79.8612,
  },
};

const mockState: any = {
  auth: {user: {name: 'Test Tech'}},
  technician: {tasks: [mockJob] as any[], isLoading: false, error: null},
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
  const MapView = React2.forwardRef((props: any, _ref: any) =>
    React2.createElement('MapView', props, props.children),
  );
  return {
    __esModule: true,
    default: MapView,
    Marker: (props: any) => React2.createElement('Marker', props, props.children),
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

import TaskDetailScreen from '@screens/technician/TaskDetailScreen';

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.map((x: any) => String(x)).join('') : String(c);
};

describe('JOB-013 — job detail renders every required field', () => {
  test('renders_allRequiredFields', () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<TaskDetailScreen />);
    });

    const texts = tree.root.findAllByType(Text).map(textOf);
    const screenText = texts.join(' | ');
    const buttons = tree.root
      .findAllByType(TouchableOpacity)
      .map((b: any) => b.findAllByType(Text).map(textOf).join(''));

    // Every sub-check is collected rather than short-circuiting, so one missing field does not
    // hide the state of the others — the Jest equivalent of JUnit's assertAll.
    const failures: string[] = [];
    const check = (ok: boolean, message: string) => {
      if (!ok) failures.push(message);
    };

    // ── Step 2: customer address ────────────────────────────────────────────────────────
    check(
      screenText.includes('No. 5 Main Street, Colombo 03'),
      'Customer address is not rendered.',
    );

    // ── Step 3: fault category ──────────────────────────────────────────────────────────
    check(screenText.includes('BROADBAND'), 'Fault category is not rendered.');

    // ── Step 4: priority badge, HIGH = red ──────────────────────────────────────────────
    check(screenText.includes('HIGH PRIORITY'), 'HIGH priority badge is not rendered.');
    const priorityLabel = tree.root
      .findAllByType(Text)
      .find((t: any) => textOf(t).includes('HIGH PRIORITY'));
    const priorityStyles = ([] as any[])
      .concat(priorityLabel ? priorityLabel.props.style ?? [] : [])
      .filter(Boolean);
    check(
      priorityStyles.some((s: any) => s && s.color === colors.error),
      'HIGH priority badge is not rendered in the error/red colour.',
    );

    // ── Step 5: Accept AND Reject actions ───────────────────────────────────────────────
    check(
      buttons.some(b => b.includes('Accept')),
      'No Accept action on the job detail screen.',
    );
    check(
      buttons.some(b => b.includes('Reject')),
      'JOB-013 step 5 requires a Reject action on the job detail screen. TaskDetailScreen\'s '
        + 'getStatusActions() renders only "✅ Accept Job" for an assigned job — Reject exists '
        + 'ONLY on the HomeScreen job card (renderJobActions), so a technician who opened the job '
        + 'detail has to back out to the list to decline it, and the SRS 5.3.1.2 rejection '
        + 'categorization modal is unreachable from here. PRODUCTION CHANGE REQUIRED. '
        + 'Buttons found: ' + JSON.stringify(buttons),
    );

    // ── Step 6: job description ─────────────────────────────────────────────────────────
    check(
      screenText.includes('ONT power LED is off'),
      'JOB-013 step 6 requires the job description to be visible. TaskDetailScreen never renders '
        + 'task.description at all — the technician sees customer name, category, schedule, '
        + 'estimated time and address, but not what the customer actually reported. '
        + 'PRODUCTION CHANGE REQUIRED.',
    );

    expect(failures).toEqual([]);

    act(() => tree.unmount());
  });
});
