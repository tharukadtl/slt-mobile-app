/**
 * Coverage for the FR-31 Client bill actions added to BillDetailScreen (QA §2.1, Bill Dispute &
 * Amendment). Renders the REAL BillDetailScreen with react-test-renderer (the sanctioned approach
 * here — no @testing-library/react-native) and drives it through the mocked store, mirroring
 * __tests__/BODScreen.checkIn.test.tsx.
 *
 * Verifies:
 *  - Accept Bill + Report Issue actions appear only for client-actionable statuses
 *    (APPROVED and the amended PENDING_CLIENT_REVIEW), and NOT for DISPUTED / ACCEPTED —
 *    exactly the allowed-from set the backend enforces.
 *  - The status-context banner text matches the status.
 *  - Tapping "Report Issue" reveals the form; selecting a category + typing a description +
 *    Submit dispatches reportBillDispute with the entered values.
 *  - Confirming the Accept alert dispatches acceptBill.
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
// factory (not captured from outer consts) because `import BillDetailScreen` is hoisted and would
// otherwise run this factory before outer consts initialize. acceptBill/reportBillDispute carry a
// `.fulfilled.match` because the screen branches on it.
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
import {acceptBill, reportBillDispute} from '@store/slices/issueSlice';

const mockAcceptBill = acceptBill as unknown as jest.Mock;
const mockReportBillDispute = reportBillDispute as unknown as jest.Mock;

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

const allText = (tree: any): string =>
  tree.root.findAllByType(Text).map((t: any) => textOf(t)).join(' | ');

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

describe('BillDetailScreen — bill actions per status', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDispatch.mockClear();
    mockAcceptBill.mockClear();
    mockReportBillDispute.mockClear();
    mockBill.status = 'APPROVED';
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy?.mockRestore();
  });

  test('APPROVED: shows Accept Bill and Report Issue', async () => {
    mockBill.status = 'APPROVED';
    const tree = await render();
    expect(findButton(tree, 'Accept Bill')).toBeDefined();
    expect(findButton(tree, 'Report Issue')).toBeDefined();
    act(() => tree.unmount());
  });

  test('PENDING_CLIENT_REVIEW: shows both actions and the amended-review banner', async () => {
    mockBill.status = 'PENDING_CLIENT_REVIEW';
    const tree = await render();
    expect(findButton(tree, 'Accept Bill')).toBeDefined();
    expect(findButton(tree, 'Report Issue')).toBeDefined();
    expect(allText(tree)).toContain('amended and resent');
    act(() => tree.unmount());
  });

  test('DISPUTED: no actions, shows under-review banner', async () => {
    mockBill.status = 'DISPUTED';
    const tree = await render();
    expect(findButton(tree, 'Accept Bill')).toBeUndefined();
    expect(findButton(tree, 'Report Issue')).toBeUndefined();
    expect(allText(tree)).toContain('under review');
    act(() => tree.unmount());
  });

  test('ACCEPTED: no actions, shows accepted banner', async () => {
    mockBill.status = 'ACCEPTED';
    const tree = await render();
    expect(findButton(tree, 'Accept Bill')).toBeUndefined();
    expect(findButton(tree, 'Report Issue')).toBeUndefined();
    expect(allText(tree)).toContain('accepted this bill');
    act(() => tree.unmount());
  });

  test('confirming the Accept alert dispatches acceptBill', async () => {
    mockBill.status = 'APPROVED';
    const tree = await render();

    await act(async () => {
      findButton(tree, 'Accept Bill').props.onPress();
    });

    // handleAccept opens a confirm alert; invoke its "Accept" action.
    const alertArgs = alertSpy.mock.calls[0];
    const acceptAction = alertArgs[2].find((a: any) => a.text === 'Accept');
    await act(async () => {
      await acceptAction.onPress();
    });

    expect(mockAcceptBill).toHaveBeenCalledWith('42');
  });

  test('Report Issue: reveals form and Submit dispatches reportBillDispute with entered values', async () => {
    mockBill.status = 'APPROVED';
    const tree = await render();

    // Open the form.
    await act(async () => {
      findButton(tree, 'Report Issue').props.onPress();
    });

    // Select a category chip.
    await act(async () => {
      findButton(tree, 'Wrong Amount').props.onPress();
    });

    // Type a description into the (single) TextInput.
    const input = tree.root.findAllByType(TextInput)[0];
    await act(async () => {
      input.props.onChangeText('The chargeable total looks wrong');
    });

    // Submit.
    await act(async () => {
      await findButton(tree, 'Submit Issue').props.onPress();
    });

    expect(mockReportBillDispute).toHaveBeenCalledTimes(1);
    expect(mockReportBillDispute).toHaveBeenCalledWith({
      id: '42',
      category: 'WRONG_AMOUNT',
      description: 'The chargeable total looks wrong',
      photoUri: undefined,
    });

    act(() => tree.unmount());
  });
});
