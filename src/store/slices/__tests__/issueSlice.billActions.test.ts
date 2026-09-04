/**
 * Reducer-level coverage for the FR-31 Client bill Accept / Report-Issue flows added to
 * issueSlice (Bill Dispute & Amendment, QA §2.1). Follows the reliable reducer-test pattern
 * documented for this app: mock @services/api so importing the slice never loads axios /
 * AsyncStorage, then drive the reducer directly with the auto-generated thunk action creators.
 *
 * These verify the STATE the BillDetailScreen reads after an accept/dispute succeeds — the
 * refreshed ClientBillDTO becomes selectedBill and, when the bill is also in the cached list,
 * that entry is updated in place so the status badge stays consistent across screens.
 */
jest.mock('@services/api', () => ({
  __esModule: true,
  default: {get: jest.fn(), post: jest.fn(), patch: jest.fn()},
}));

import reducer, {
  acceptBill,
  reportBillDispute,
} from '@store/slices/issueSlice';
import {Bill, IssueState} from '@appTypes/issue.types';

const baseBill = (over: Partial<Bill> = {}): Bill =>
  ({
    id: '42',
    issueId: '7',
    issueTitle: 'Broadband fault',
    technicianName: 'Tech Tim',
    completedAt: '2026-07-01T00:00:00',
    status: 'APPROVED',
    materials: [],
    laborHours: 0,
    laborRate: 0,
    laborCharges: 1000,
    materialsFOC: 100,
    materialsChargeable: 4000,
    totalChargeable: 5000,
    totalFOC: 100,
    grandTotal: 5000,
    ...over,
  } as Bill);

const stateWith = (bill: Bill): IssueState => ({
  issues: [],
  selectedIssue: null,
  bills: [bill],
  selectedBill: bill,
  technicianLocation: null,
  isLoading: false,
  error: null,
});

describe('issueSlice — bill accept / dispute reducers', () => {
  it('acceptBill.fulfilled replaces selectedBill and the matching list entry with the ACCEPTED bill', () => {
    const start = stateWith(baseBill({status: 'APPROVED'}));
    const accepted = baseBill({status: 'ACCEPTED'});

    const next = reducer(start, acceptBill.fulfilled(accepted, 'req', '42'));

    expect(next.isLoading).toBe(false);
    expect(next.selectedBill?.status).toBe('ACCEPTED');
    expect(next.bills[0].status).toBe('ACCEPTED');
  });

  it('reportBillDispute.fulfilled replaces selectedBill and the matching list entry with the DISPUTED bill', () => {
    const start = stateWith(baseBill({status: 'APPROVED'}));
    const disputed = baseBill({status: 'DISPUTED'});

    const next = reducer(start, reportBillDispute.fulfilled(disputed, 'req', {
      id: '42',
      category: 'WRONG_AMOUNT',
      description: 'overcharged',
    }));

    expect(next.selectedBill?.status).toBe('DISPUTED');
    expect(next.bills[0].status).toBe('DISPUTED');
  });

  it('pending sets isLoading and clears prior error; rejected surfaces the error', () => {
    const start = {...stateWith(baseBill()), error: 'old'};

    const pending = reducer(start, acceptBill.pending('req', '42'));
    expect(pending.isLoading).toBe(true);
    expect(pending.error).toBeNull();

    const rejected = reducer(
      pending,
      reportBillDispute.rejected(null, 'req', {id: '42', category: 'X', description: 'y'}, 'Failed to report issue'),
    );
    expect(rejected.isLoading).toBe(false);
    expect(rejected.error).toBe('Failed to report issue');
  });

  it('fulfilled updates selectedBill even when the bill is not in the cached list', () => {
    const start: IssueState = {...stateWith(baseBill()), bills: []};
    const accepted = baseBill({status: 'ACCEPTED'});

    const next = reducer(start, acceptBill.fulfilled(accepted, 'req', '42'));
    expect(next.selectedBill?.status).toBe('ACCEPTED');
    expect(next.bills).toHaveLength(0);
  });
});
