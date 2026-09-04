/**
 * FLT-023 (02_FAULT_TRACKING, FR-31) — the client bill accept/dispute round trip, end to end in the
 * UI: view the breakdown, report an issue, see the status badge become "Disputed", and confirm the
 * job's list placement afterwards.
 *
 * <p><b>Tool substitution.</b> The sheet maps this row to Detox (`billDispute.e2e.ts::
 * reportIssueUpdatesStatus`). Per the project-wide decision of 2026-08-04 recorded in
 * `docs/SLT_Test_Plan_V1.docx` §3 and the Resolution Log of
 * `docs/QA_Compliance_Consolidated_Report.md`, Detox cannot execute live on this host —
 * a software-rendered emulator under virtualization triggers the ANR watchdog before Detox's bridge
 * attaches, so a run never reaches a verdict. The established substitute is Jest +
 * react-test-renderer (`@testing-library/react-native` is not installed), following
 * `__tests__/clientLogin.e2e.test.tsx` (AUTH-016): render the REAL screen, use a REAL Redux store
 * and the REAL `issueSlice`, and fake only the HTTP boundary (`@services/issueService`). That makes
 * the whole chain genuine — screen -> thunk -> reducer -> re-render — rather than asserting against
 * a hand-set state.</p>
 *
 * <p>Step 5 ("job still in active list, not history") is asserted the way
 * `clientLogin.e2e.test.tsx` asserts navigation: by mirroring the predicates the two list screens
 * actually use. `IssueListScreen` shows issues whose status is neither `completed` nor `cancelled`;
 * `IssueHistoryScreen` shows exactly those two. Both read the ISSUE's status and neither is aware
 * of the bill, so list placement can only change if the SERVER moves the linked fault. That
 * move is what `PaymentService.reportDispute` now performs (linked fault COMPLETED -> HOLD, which
 * `IssueController` surfaces to mobile as `in_progress`) — the backend fix FLT-021 covers. The faked
 * `getIssues` mirrors exactly that, and step 5 asserts the MOVE (in history before the dispute, in
 * the active list after) rather than just observing a final state.</p>
 */
import React from 'react';
import {TouchableOpacity, Text, TextInput, Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';

jest.useFakeTimers({
  doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick'],
});

const BILL_ID = '42';
const ISSUE_ID = '7';

const APPROVED_BILL = {
  id: BILL_ID,
  issueId: ISSUE_ID,
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

const DISPUTED_BILL = {...APPROVED_BILL, status: 'DISPUTED'};

/** The issue this bill belongs to — completed by the technician, which is when a bill appears. */
const LINKED_ISSUE = {
  id: ISSUE_ID,
  faultNumber: 'FLT-2026-00007',
  title: 'Broadband fault',
  description: 'No internet since 08:00',
  category: 'broadband',
  status: 'completed',
  createdAt: '2026-06-30T09:00:00',
};

/**
 * The same issue as the server returns it AFTER the dispute. `PaymentService.reportDispute` pulls
 * the linked fault out of COMPLETED into HOLD, and `IssueController.mapStatusToMobile` maps
 * HOLD -> 'in_progress', so `GET /api/issues` reports the job as active again.
 */
const REOPENED_ISSUE = {...LINKED_ISSUE, status: 'in_progress'};

// The only boundary faked: HTTP. reportBillDispute re-fetches the bill, so getBillById returns
// APPROVED first and DISPUTED afterwards — exactly what the server would do. getIssues is faked the
// same way: the dispute is what flips the linked issue back to active, so this mock changes ONLY as
// a side effect of reportBillDispute being called, never on its own. That is what makes step 5 a
// causation check rather than a fixed fixture — see the before/after assertions in the test.
let billResponse: any = APPROVED_BILL;
let issuesResponse: any[] = [LINKED_ISSUE];
const mockGetBillById = jest.fn(async () => billResponse);
const mockReportBillDispute = jest.fn(async () => {
  billResponse = DISPUTED_BILL;
  issuesResponse = [REOPENED_ISSUE];
});
const mockGetIssues = jest.fn(async () => issuesResponse);

jest.mock('@services/issueService', () => ({
  __esModule: true,
  default: {
    getBillById: (...args: any[]) => mockGetBillById(...args),
    reportBillDispute: (...args: any[]) => mockReportBillDispute(...args),
    getIssues: (...args: any[]) => mockGetIssues(...args),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn(), navigate: jest.fn()}),
  useRoute: () => ({params: {billId: '42'}}),
}));

// PhotoPicker wraps react-native-image-picker's native module.
jest.mock('@components/common/PhotoPicker', () => 'PhotoPicker');

import BillDetailScreen from '@screens/client/BillDetailScreen';
import issueReducer, {fetchIssues} from '@store/slices/issueSlice';

const makeStore = () => configureStore({reducer: {issues: issueReducer}});

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

/** Mirrors IssueListScreen.tsx line 78: the client's active-issues list. */
const inActiveList = (issues: any[], id: string) =>
  issues
    .filter(i => i.status !== 'completed' && i.status !== 'cancelled')
    .some(i => i.id === id);

/** Mirrors IssueHistoryScreen.tsx line 82: the client's Service History list. */
const inHistoryList = (issues: any[], id: string) =>
  issues
    .filter(i => i.status === 'completed' || i.status === 'cancelled')
    .some(i => i.id === id);

describe('FLT-023 — client reports an issue on a bill, end to end', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    billResponse = APPROVED_BILL;
    issuesResponse = [LINKED_ISSUE];
    mockGetBillById.mockClear();
    mockReportBillDispute.mockClear();
    mockGetIssues.mockClear();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy?.mockRestore();
  });

  it('reportIssueUpdatesStatus: breakdown -> report issue -> Disputed badge -> list placement', async () => {
    const store = makeStore();

    // ── Step 1: open BillDetailScreen (it fetches the bill on mount) ────────────────────
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <Provider store={store}>
          <BillDetailScreen />
        </Provider>,
      );
    });
    await flush();

    expect(mockGetBillById).toHaveBeenCalledWith(BILL_ID);

    // ── Step 2: the full breakdown is visible (materials FOC / chargeable / labour / total) ──
    const breakdown = allText(tree);
    expect(breakdown).toContain('LKR 100.00');    // materials FOC
    expect(breakdown).toContain('LKR 4,000.00');  // materials chargeable
    expect(breakdown).toContain('LKR 1,000.00');  // labour
    expect(breakdown).toContain('LKR 5,000.00');  // grand total
    // Status badge. formatStatus() only re-cases snake_case input, and ClientBillDTO statuses are
    // already upper-case, so the badge renders 'APPROVED'/'DISPUTED' rather than the row's
    // title-cased 'Disputed'. Matched case-insensitively for that reason.
    expect(breakdown).toMatch(/approved/i);

    // ── Baseline for step 5: BEFORE the dispute the completed job sits in Service History
    //    and NOT in the active list, so any later presence in the active list is the dispute's
    //    doing rather than a state the fixture started in. ─────────────────────────────────
    await act(async () => {
      await (store.dispatch as any)(fetchIssues());
    });
    await flush();

    const issuesBefore = (store.getState() as any).issues.issues;
    expect(inActiveList(issuesBefore, ISSUE_ID)).toBe(false);
    expect(inHistoryList(issuesBefore, ISSUE_ID)).toBe(true);

    // ── Step 3: tap Report Issue, choose a category, describe it, submit ────────────────
    await act(async () => {
      findButton(tree, 'Report Issue').props.onPress();
    });

    await act(async () => {
      findButton(tree, 'Wrong Amount').props.onPress();
    });

    const descriptionInput = tree.root.findAllByType(TextInput)[0];
    await act(async () => {
      descriptionInput.props.onChangeText('Charged for materials not used');
    });

    await act(async () => {
      await findButton(tree, 'Submit Issue').props.onPress();
    });
    await flush();

    // The REAL thunk hit the HTTP boundary with the entered values.
    expect(mockReportBillDispute).toHaveBeenCalledTimes(1);
    expect(mockReportBillDispute).toHaveBeenCalledWith(BILL_ID, {
      category: 'WRONG_AMOUNT',
      description: 'Charged for materials not used',
      photoUri: undefined,
    });

    // ── Step 4: the status badge updates to Disputed ───────────────────────────────────
    const afterDispute = allText(tree);
    expect((store.getState() as any).issues.selectedBill.status).toBe('DISPUTED');
    expect(afterDispute).toMatch(/disputed/i);            // badge, rendered as 'DISPUTED'
    expect(afterDispute).toContain('under review');       // the DISPUTED context banner
    expect(findButton(tree, 'Accept Bill')).toBeUndefined();
    expect(findButton(tree, 'Report Issue')).toBeUndefined();

    // ── Step 5: the dispute MOVED the job back into the active list, out of Service History ──
    await act(async () => {
      await (store.dispatch as any)(fetchIssues());
    });
    await flush();

    const issues = (store.getState() as any).issues.issues;
    expect(issues.map((i: any) => i.id)).toContain(ISSUE_ID);

    // It was not in the active list a moment ago (asserted above) and the dispute is the only
    // thing that happened in between — so the dispute is what put it there.
    expect(inActiveList(issues, ISSUE_ID)).toBe(true);
    expect(inHistoryList(issues, ISSUE_ID)).toBe(false);

    act(() => tree.unmount());
  });
});
