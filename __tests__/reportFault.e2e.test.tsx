/**
 * FAULT-006 (02_FAULT_TRACKING, FR-4) — a client reports a fault end to end: pick a category,
 * describe the problem, confirm the GPS location, submit, and see the confirmation.
 *
 * <p><b>Tool substitution.</b> The sheet maps this row to Detox
 * (`e2e/fault/reportFault.e2e.js::threeStepWizard_happyPath`, driving an Android emulator by
 * `testID`). Per the project-wide decision recorded on 2026-08-04 in `docs/SLT_Test_Plan_V1.docx`
 * §3 and the Resolution Log of `docs/QA_Compliance_Consolidated_Report.md`, Detox cannot execute
 * live on this host: the emulator is software-rendered under virtualization and the ANR watchdog
 * kills the app before Detox's bridge attaches. A build succeeds; a run never produces a verdict.
 * The established substitute is a Jest + react-test-renderer screen test, and the precedent is
 * `__tests__/clientLogin.e2e.test.tsx` (AUTH-016), whose conventions this file follows exactly:
 * render the REAL screen, use a REAL Redux store and the REAL slice, and fake only the HTTP
 * boundary (`@services/issueService`) plus the native modules that have no JS implementation under
 * Jest. (`@testing-library/react-native` is NOT a dependency of this app despite some Tool-column
 * labels saying "RNTL" — only `react-test-renderer` is, so elements are located by component type
 * + visible label rather than by `testID`. The screens carry no `testID`s and adding them would be
 * a production-code change.)
 *
 * <p><b>Screen reality.</b> The row describes a three-step wizard (category/description -> Next ->
 * GPS confirm -> review -> Submit) with `reportNewIssueBtn`, `nextBtn`, `confirmLocationBtn`,
 * `submitFaultBtn` and `confirmationScreen`. `ReportIssueScreen.tsx` is a SINGLE scrolling form:
 * title, category chips, description, `LocationPicker`, `PhotoPicker`, and one Submit button.
 * There are no steps and no `nextBtn`/`confirmLocationBtn` to tap, so "3 steps navigable" cannot be
 * asserted — it does not exist. Every other step of the row maps directly onto the real form and is
 * exercised below, including the GPS mock at (6.9271, 79.8612) and the confirmation the user
 * actually sees (the "Issue reported successfully!" alert, which is this screen's
 * `confirmationScreen`).
 */
import React from 'react';
import {TextInput, TouchableOpacity, Text, Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';

jest.useFakeTimers({
  doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick'],
});

const GPS = {latitude: 6.9271, longitude: 79.8612};
const CATEGORY = 'broadband';
const TITLE = 'No internet';
const DESCRIPTION = 'No internet since 08:00 this morning';
const ADDRESS = 'No. 5 Main Street, Colombo 03';

const CREATED_ISSUE = {
  id: '1042',
  faultNumber: 'FLT-2026-01042',
  title: TITLE,
  description: DESCRIPTION,
  category: CATEGORY,
  status: 'pending',
  createdAt: '2026-08-05T08:05:00',
  location: {address: ADDRESS, ...GPS},
};

// The only application boundary faked: HTTP. Mocking this module also keeps axios /
// AsyncStorage / api.config out of the import graph.
const mockCreateIssue = jest.fn().mockResolvedValue(CREATED_ISSUE);
jest.mock('@services/issueService', () => ({
  __esModule: true,
  default: {
    createIssue: (...args: any[]) => mockCreateIssue(...args),
  },
}));

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: mockGoBack, navigate: jest.fn()}),
  useRoute: () => ({params: {}}),
}));

// Native modules with no JS implementation under Jest.
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: (success: any) =>
      success({coords: {latitude: 6.9271, longitude: 79.8612}}),
  },
}));
jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: 'MapView',
  Marker: 'Marker',
  PROVIDER_GOOGLE: 'google',
}));
// PhotoPicker wraps react-native-image-picker's native module; photos are optional for this row.
jest.mock('@components/common/PhotoPicker', () => 'PhotoPicker');

import ReportIssueScreen from '@screens/client/ReportIssueScreen';
import issueReducer from '@store/slices/issueSlice';

const makeStore = () => configureStore({reducer: {issues: issueReducer}});

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

const allText = (tree: any): string =>
  tree.root.findAllByType(Text).map((t: any) => textOf(t)).join(' | ');

const findButtonByLabel = (tree: any, label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find((b: any) =>
      b.findAllByType(Text).some((t: any) => textOf(t).includes(label)),
    );

/** Lets the dispatched thunk's promise chain settle over microtasks. */
const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
  });
};

const render = async (store: any) => {
  let tree: any;
  await act(async () => {
    tree = renderer.create(
      <Provider store={store}>
        <ReportIssueScreen />
      </Provider>,
    );
  });
  await flush();
  return tree;
};

describe('FAULT-006 — client reports a fault, happy path', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockCreateIssue.mockClear();
    mockGoBack.mockClear();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    // LocationPicker reverse-geocodes through OpenStreetMap; no network in a unit test.
    (global as any).fetch = jest.fn().mockResolvedValue({
      json: async () => ({display_name: ADDRESS}),
    });
  });

  afterEach(() => {
    alertSpy?.mockRestore();
    delete (global as any).fetch;
  });

  it('threeStepWizard_happyPath: category + description + GPS -> submitted, confirmation shown', async () => {
    const store = makeStore();
    const screen = await render(store);

    // ── The form the row calls "Step 1": category chip + free-text description ───────────
    const broadbandChip = findButtonByLabel(screen, 'Broadband');
    expect(broadbandChip).toBeDefined();
    await act(async () => {
      broadbandChip.props.onPress();
    });

    // Title and Description are the two plain inputs on the form, in that order.
    const titleInput = screen.root.findAllByType(TextInput)[0];
    await act(async () => {
      titleInput.props.onChangeText(TITLE);
    });

    const descriptionInput = screen.root.findAllByType(TextInput)[1];
    await act(async () => {
      descriptionInput.props.onChangeText(DESCRIPTION);
    });
    expect(DESCRIPTION.length).toBeGreaterThanOrEqual(10);

    // ── The row's "Step 2": confirm the GPS location ────────────────────────────────────
    // Auto-detect reads the mocked device position (6.9271, 79.8612) and reverse-geocodes it.
    const detectButton = findButtonByLabel(screen, 'Auto-Detect My Location');
    expect(detectButton).toBeDefined();
    await act(async () => {
      await detectButton.props.onPress();
    });
    await flush();

    // The confirmed address is shown back to the user before submitting — the row's "Step 3"
    // review of the summary.
    expect(allText(screen)).toContain(ADDRESS);

    // ── The row's "Step 3": submit ─────────────────────────────────────────────────────
    const submitButton = findButtonByLabel(screen, 'Submit Issue');
    expect(submitButton).toBeDefined();
    expect(submitButton.props.disabled).toBe(false);

    await act(async () => {
      await submitButton.props.onPress();
    });
    await flush();

    // ── The report reached the HTTP boundary with the entered values and the GPS fix ────
    expect(mockCreateIssue).toHaveBeenCalledTimes(1);
    const payload = mockCreateIssue.mock.calls[0][0];
    expect(payload.category).toBe(CATEGORY);
    expect(payload.title).toBe(TITLE);
    expect(payload.description).toBe(DESCRIPTION);
    expect(payload.location.latitude).toBeCloseTo(GPS.latitude, 4);
    expect(payload.location.longitude).toBeCloseTo(GPS.longitude, 4);
    expect(payload.location.address).toBe(ADDRESS);

    // ── The confirmation the user actually sees, carrying the created fault ─────────────
    const successAlert = alertSpy.mock.calls.find(
      (call: any[]) => call[0] === 'Success',
    );
    expect(successAlert).toBeDefined();
    expect(successAlert![1]).toContain('reported successfully');

    // The real slice ran: the new fault is in the store with its server-assigned id.
    const state = store.getState() as any;
    expect(state.issues.isLoading).toBe(false);
    expect(state.issues.error).toBeNull();
    expect(state.issues.issues.map((i: any) => i.id)).toContain('1042');

    act(() => screen.unmount());
  });
});
