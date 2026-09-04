/**
 * BDA-001 (12_BILL_DISPUTE, FR-31) — the client bill breakdown: every line item, the labour
 * charge, and the FOC-excluded grand total render correctly on BillDetailScreen.
 *
 * <p><b>Tool note.</b> The Tool column says "Jest + RNTL"; `@testing-library/react-native` is not a
 * dependency of this app (`package.json` ships `react-test-renderer` only), so this follows the
 * convention every other screen test here uses — render the REAL `BillDetailScreen` with
 * `react-test-renderer`, drive it through a mocked store, and locate elements by component type +
 * visible text. Structure mirrors its siblings `BillDetailScreen.actions.test.tsx` (per-status
 * action visibility) and `BillDetailScreen.dispute.test.tsx` (dispute form validation); neither
 * renders a single material — both use `materials: []` — so the line-item half of this row is not
 * covered anywhere before this file.</p>
 *
 * <p><b>File name.</b> Column M names `BillDetailScreen.test.tsx`, which does not exist. This
 * directory's convention is one topic-suffixed file per concern (`BillDetailScreen.actions`,
 * `BillDetailScreen.dispute`), established by FLT-020, so the breakdown case gets
 * `BillDetailScreen.breakdown.test.tsx` and the mapped test name `rendersBreakdownCorrectly` is
 * kept as the `it()` label.</p>
 *
 * <p><b>Known production gap this test deliberately documents rather than hides.</b> The fixture
 * below carries a `materials` array because the row's Test Data specifies one and the app's own
 * `Bill` type (`src/types/issue.types.ts:73`) declares `materials: BillingItem[]` as REQUIRED.
 * The server cannot currently produce it: `ClientBillDTO` (fieldops) has no `materials` field at
 * all — only the two aggregate totals `materialsFOC` / `materialsChargeable` — so on a real device
 * the "Materials Used" card never renders. That is the already-investigated, deliberately-open
 * PAY-012/014/017 finding (no per-item material structure anywhere in the payment model; see
 * §4 "PAYMENT_FLOW sheet automation" in docs/QA_Compliance_Consolidated_Report.md), not a new
 * defect and not a screen bug — the screen renders per-item rows correctly the moment it is given
 * any. The second test below pins the CURRENT server contract so the two states stay
 * distinguishable: with today's real payload the card is correctly absent and the totals still
 * render.</p>
 */
import React from 'react';
import {Text, Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';

jest.useFakeTimers();

const mockDispatch = jest.fn(() => Promise.resolve({type: 'fulfilled'}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
  useRoute: () => ({params: {billId: '42'}}),
}));

// The row's Test Data: 3 materials (1 FOC), labourCharge = 1500, and a grand total that EXCLUDES
// the FOC item. Chargeable materials 2000 + 1000 = 3000, FOC 250, labour 1500.
//   grandTotal        = 3000 + 1500 = 4500   (FOC excluded)
//   FOC-inclusive sum = 4500 + 250  = 4750   (must NOT be what the screen shows)
const MATERIALS = [
  {name: 'ONT Router', quantity: 1, unitPrice: 2000, type: 'CHARGEABLE', subtotal: 2000},
  {name: 'Fiber Cable 20m', quantity: 2, unitPrice: 500, type: 'CHARGEABLE', subtotal: 1000},
  {name: 'Optical Splitter', quantity: 1, unitPrice: 250, type: 'FOC', subtotal: 250},
];

const mockBill: any = {
  id: '42',
  issueId: '7',
  issueTitle: 'Broadband fault',
  technicianName: 'Tech Tim',
  completedAt: '2026-07-01T00:00:00',
  status: 'APPROVED',
  materials: MATERIALS,
  laborCharges: 1500,
  materialsFOC: 250,
  materialsChargeable: 3000,
  totalChargeable: 4500,
  totalFOC: 250,
  grandTotal: 4500,
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

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

const allTexts = (tree: any): string[] =>
  tree.root.findAllByType(Text).map((t: any) => textOf(t));

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

describe('BDA-001 — client bill breakdown renders materials, labour and the FOC-excluded total', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDispatch.mockClear();
    mockBill.materials = MATERIALS;
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy?.mockRestore();
  });

  it('rendersBreakdownCorrectly: every line item, the labour charge and the FOC-excluded grand total', async () => {
    const tree = await render();
    const texts = allTexts(tree);
    const joined = texts.join(' | ');

    // ── Step 2a: the materials list — all three items, with name, qty x unit price and subtotal ──
    expect(joined).toContain('Materials Used');
    expect(joined).toContain('ONT Router');
    expect(joined).toContain('Fiber Cable 20m');
    expect(joined).toContain('Optical Splitter');

    expect(joined).toContain('1 x LKR 2,000.00');   // ONT Router
    expect(joined).toContain('2 x LKR 500.00');     // Fiber Cable (quantity is shown, not folded in)
    expect(joined).toContain('1 x LKR 250.00');     // Optical Splitter

    // Every item's own subtotal is on screen.
    expect(joined).toContain('LKR 2,000.00');
    expect(joined).toContain('LKR 1,000.00');
    expect(joined).toContain('LKR 250.00');

    // ── Step 2b: exactly one item is badged FOC and the other two CHARGEABLE ────────────────
    expect(texts.filter(t => t === 'FOC')).toHaveLength(1);
    expect(texts.filter(t => t === 'CHARGEABLE')).toHaveLength(2);

    // ── Step 2c: the labour charge ─────────────────────────────────────────────────────────
    expect(joined).toContain('Labor Charges');
    expect(joined).toContain('LKR 1,500.00');

    // ── Step 2d: the summary rows separate FOC from chargeable ─────────────────────────────
    expect(joined).toContain('Materials (FOC)');
    expect(joined).toContain('Materials (Chargeable)');
    expect(joined).toContain('LKR 3,000.00');       // materials chargeable
    expect(joined).toContain('Total FOC');

    // ── Step 2e: the grand total EXCLUDES the FOC item ─────────────────────────────────────
    // 3000 chargeable + 1500 labour = 4500. The FOC-inclusive figure (4750) must appear nowhere:
    // that is the whole point of the FOC/chargeable split the client is being shown.
    expect(joined).toContain('Total Chargeable');
    expect(joined).toContain('LKR 4,500.00');
    expect(joined).not.toContain('LKR 4,750.00');

    // Asserted as arithmetic, not just as a string, so the intent survives a formatting change.
    const chargeableItemsTotal = MATERIALS.filter(m => m.type === 'CHARGEABLE')
      .reduce((sum, m) => sum + m.subtotal, 0);
    expect(mockBill.grandTotal).toBe(chargeableItemsTotal + mockBill.laborCharges);
    expect(mockBill.grandTotal).not.toBe(
      chargeableItemsTotal + mockBill.laborCharges + mockBill.materialsFOC,
    );

    act(() => tree.unmount());
  });

  it('omitsTheMaterialsCardOnTodays_realServerPayload (documents the open PAY-014 per-item gap)', async () => {
    // Exactly what GET /api/payments/my-bills/{id} returns today: ClientBillDTO carries the two
    // aggregate material totals and no per-item array. This is NOT a new defect — it is the
    // already-open, deliberately-deferred PAY-012/014/017 finding — but it is pinned here so the
    // test above is not mistaken for evidence that a real client ever sees line items.
    delete mockBill.materials;

    const tree = await render();
    const joined = allTexts(tree).join(' | ');

    expect(joined).not.toContain('Materials Used');
    expect(joined).not.toContain('ONT Router');

    // The aggregate summary still renders correctly, which is what a client actually gets today.
    expect(joined).toContain('Materials (FOC)');
    expect(joined).toContain('LKR 250.00');
    expect(joined).toContain('Materials (Chargeable)');
    expect(joined).toContain('LKR 3,000.00');
    expect(joined).toContain('LKR 1,500.00');       // labour
    expect(joined).toContain('LKR 4,500.00');       // FOC-excluded grand total

    act(() => tree.unmount());
  });
});
