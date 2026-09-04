/**
 * FLT-020 (02_FAULT_TRACKING, FR-31) — reporting an issue on a bill requires BOTH a category and a
 * description; a blank category must be blocked client-side, and a complete form must dispatch the
 * dispute.
 *
 * <p><b>Tool note.</b> The Tool column says "Jest + RNTL". `@testing-library/react-native` is not a
 * dependency of this app (`package.json` ships `react-test-renderer` only), so this follows the
 * convention every other screen test here uses — render the REAL `BillDetailScreen` with
 * `react-test-renderer`, drive it through a mocked store, and locate elements by component type +
 * visible label. Structure mirrors its sibling `__tests__/BillDetailScreen.actions.test.tsx`, which
 * covers the per-status visibility of the actions and the happy-path dispatch; the validation
 * behaviour asserted here is not covered there.</p>
 *
 * <p><b>Message wording.</b> The row's draft assertion looks for `'Category is required'`. The
 * screen's actual guards (`BillDetailScreen.handleSubmitReport`) raise
 * `Alert.alert('Error', 'Please select an issue category')` and
 * `Alert.alert('Error', 'Please describe the issue')`, so those are what is asserted.</p>
 */
import React from 'react';
import {TouchableOpacity, Text, TextInput, Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';

jest.useFakeTimers();

const mockDispatch = jest.fn(() => Promise.resolve({type: 'fulfilled'}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
  useRoute: () => ({params: {billId: '42'}}),
}));

const mockBill: any = {
  id: '42',
  issueId: '7',
  issueTitle: 'Broadband fault',
  technicianName: 'Tech Tim',
  completedAt: '2026-07-01T00:00:00',
  status: 'APPROVED',
  materials: [],
  laborCharges: 1000,
  materialsFOC: 100,
  materialsChargeable: 4000,
  totalChargeable: 5000,
  totalFOC: 100,
  grandTotal: 5000,
};
const mockState: any = {issues: {selectedBill: mockBill, isLoading: false}};

jest.mock('@store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (sel: any) => sel(mockState),
}));

// PhotoPicker pulls in react-native-image-picker's native module — stub it out.
jest.mock('@components/common/PhotoPicker', () => 'PhotoPicker');

// Slice thunks are mocked so the real slice/axios/AsyncStorage never load. Defined INSIDE the
// factory because `import BillDetailScreen` is hoisted.
jest.mock('@store/slices/issueSlice', () => {
  const accept: any = jest.fn((id: any) => ({type: 'accept', payload: id}));
  accept.fulfilled = {match: () => true};
  const report: any = jest.fn((args: any) => ({type: 'report', payload: args}));
  report.fulfilled = {match: () => true};
  return {
    fetchBillById: jest.fn((id: any) => ({type: 'fetchBillById', payload: id})),
    acceptBill: accept,
    reportBillDispute: report,
  };
});

import BillDetailScreen from '@screens/client/BillDetailScreen';
import {reportBillDispute} from '@store/slices/issueSlice';

const mockReportBillDispute = reportBillDispute as unknown as jest.Mock;

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

const findButton = (tree: any, label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find((b: any) =>
      b.findAllByType(Text).some((t: any) => textOf(t).includes(label)),
    );

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
  });
};

const render = async () => {
  let tree: any;
  await act(async () => {
    tree = renderer.create(<BillDetailScreen />);
  });
  await flush();
  return tree;
};

/** The alert text of the last Alert.alert('Error', ...) call, or undefined. */
const lastErrorAlert = (spy: jest.SpyInstance): string | undefined => {
  const errors = spy.mock.calls.filter((call: any[]) => call[0] === 'Error');
  return errors.length ? errors[errors.length - 1][1] : undefined;
};

describe('FLT-020 — bill dispute requires a category and a description', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDispatch.mockClear();
    mockReportBillDispute.mockClear();
    mockBill.status = 'APPROVED';
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy?.mockRestore();
  });

  it('blocksEmptyCategory: submitting without a category is blocked and dispatches nothing', async () => {
    const tree = await render();

    // ── Step 1: tap "Report Issue" to reveal the form ────────────────────────────────────
    const reportButton = findButton(tree, 'Report Issue');
    expect(reportButton).toBeDefined();
    await act(async () => {
      reportButton.props.onPress();
    });

    const submitButton = findButton(tree, 'Submit Issue');
    expect(submitButton).toBeDefined();

    // ── Step 2: with the category blank, submission is blocked ──────────────────────────
    // The button is disabled while either field is empty — the first client-side guard.
    expect(submitButton.props.disabled).toBe(true);

    // And the handler itself refuses, even if the press gets through (the second guard).
    await act(async () => {
      await submitButton.props.onPress();
    });
    await flush();

    // ── Step 3: the block is visible to the user and nothing was dispatched ─────────────
    expect(lastErrorAlert(alertSpy)).toBe('Please select an issue category');
    expect(mockReportBillDispute).not.toHaveBeenCalled();

    // A description without a category is still blocked — it is the category that is missing.
    const descriptionInput = tree.root.findAllByType(TextInput)[0];
    await act(async () => {
      descriptionInput.props.onChangeText('Charged for materials not used');
    });
    await act(async () => {
      await findButton(tree, 'Submit Issue').props.onPress();
    });
    await flush();

    expect(lastErrorAlert(alertSpy)).toBe('Please select an issue category');
    expect(mockReportBillDispute).not.toHaveBeenCalled();

    // The mirror case: a category with no description is blocked on the description.
    await act(async () => {
      findButton(tree, 'Wrong Amount').props.onPress();
    });
    await act(async () => {
      descriptionInput.props.onChangeText('   ');
    });
    await act(async () => {
      await findButton(tree, 'Submit Issue').props.onPress();
    });
    await flush();

    expect(lastErrorAlert(alertSpy)).toBe('Please describe the issue');
    expect(mockReportBillDispute).not.toHaveBeenCalled();

    // ── Steps 4-5: with both fields filled, the dispute is dispatched ───────────────────
    await act(async () => {
      descriptionInput.props.onChangeText('Charged for materials not used');
    });

    const readySubmit = findButton(tree, 'Submit Issue');
    expect(readySubmit.props.disabled).toBe(false);

    await act(async () => {
      await readySubmit.props.onPress();
    });
    await flush();

    expect(mockReportBillDispute).toHaveBeenCalledTimes(1);
    expect(mockReportBillDispute).toHaveBeenCalledWith({
      id: '42',
      category: 'WRONG_AMOUNT',
      description: 'Charged for materials not used',
      photoUri: undefined,
    });

    act(() => tree.unmount());
  });
});
