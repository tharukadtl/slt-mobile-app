/**
 * H1c — Team Lead attaches a Circuit to a fault via the cascading Opmc -> Exchange -> Cab -> Dp
 * -> Circuit picker in AssignJobsScreen.tsx.
 *
 * Same substitution as teamLeadDayCompleted.e2e.test.tsx / clientLogin.e2e.test.tsx:
 * `@testing-library/react-native` is not a dependency of this app — Jest + react-test-renderer
 * against the REAL `screens/teamlead/AssignJobsScreen.tsx`, driving real onPress handlers on the
 * real rendered tree, with only `@react-navigation/*` and `@services/api` mocked (network/nav
 * boundaries), not the screen's own logic.
 *
 * Drives the full 5-level cascade end to end against mocked API responses shaped exactly like
 * the real backend's DTOs (ExchangeDTO/CabDTO/DpDTO/CircuitDTO field names, confirmed against
 * fieldops/src/main/java/lk/slt/fieldops/dto/*.java), then asserts PATCH /api/faults/{id}/circuit
 * is called with the real selected circuitId — not just that the modal renders.
 */
import React from 'react';
import {TouchableOpacity, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';

jest.useFakeTimers();

const mockNavigate = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => {
  const ReactLocal = require('react');
  return {
    useNavigation: () => ({navigate: mockNavigate, replace: mockReplace}),
    // Real useFocusEffect is useEffect-based, so its callback runs AFTER the component body has
    // fully evaluated (load() is already assigned by then). Calling cb() synchronously during
    // render instead -- like the naive first version of this mock did -- hits load() while it's
    // still in the const's temporal dead zone. Deferring via a real useEffect matches the real
    // timing for a screen that's already focused at mount.
    useFocusEffect: (cb: () => void) => ReactLocal.useEffect(() => { cb(); }, []),
    useRoute: () => ({params: undefined}),
  };
});
jest.mock('@react-navigation/stack', () => ({}));

const FAULT = {
  id: 501,
  faultNumber: 'FLT-2026-00501',
  customerName: 'Test Customer',
  description: 'No internet',
  locationCity: 'Colombo',
  priority: 'MEDIUM',
  status: 'ASSIGNED',
  workGroupId: 9,
  workGroupName: 'Colombo Central WG',
  assignedTeamLeadId: 7,
  // no circuitCode -- the "Add Circuit" (not "change") label path
};

const OPMCS = [{id: 1, code: 'CEOP', name: 'Central'}];
const EXCHANGES = [{id: 10, code: 'BL', name: 'Beliatta'}];
const CABS = [{id: 100, code: 'BL-UPW-0309', name: 'BL-UPW-0309'}];
const DPS = [{id: 1000, code: 'U009', name: 'U009'}];
// Exactly one Circuit for this DP -- exercises the auto-select-when-singular behaviour, the same
// DP:Circuit near-1:1 shape confirmed in the real master-data import (H1a).
const CIRCUITS = [{id: 24473, code: '24473', circuitCategoryCode: 'MSAN'}];

const mockApiGet = jest.fn((path: string) => {
  if (path === '/api/faults/my-workgroup') return Promise.resolve({data: [FAULT]});
  if (path === '/api/team/members') return Promise.resolve({data: []});
  if (path === '/api/opmcs?status=ACTIVE') return Promise.resolve({data: OPMCS});
  if (path === '/api/exchanges?opmcId=1') return Promise.resolve({data: EXCHANGES});
  if (path === '/api/cabs?exchangeId=10') return Promise.resolve({data: CABS});
  if (path === '/api/dps?cabId=100') return Promise.resolve({data: DPS});
  if (path === '/api/circuits?dpId=1000') return Promise.resolve({data: CIRCUITS});
  return Promise.resolve({data: []});
});
const mockApiPatch = jest.fn(() =>
  Promise.resolve({data: {...FAULT, circuitId: 24473, circuitCode: '24473'}}),
);

jest.mock('@services/api', () => ({
  __esModule: true,
  default: {
    get: (path: string) => mockApiGet(path),
    post: jest.fn(() => Promise.resolve({data: {}})),
    patch: (path: string, body: any) => mockApiPatch(path, body),
  },
}));

import AssignJobsScreen from '@screens/teamlead/AssignJobsScreen';

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
  });
};

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.map((x: any) => String(x)).join('') : String(c);
};

const findButtonByText = (tree: any, pattern: RegExp) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find((b: any) =>
      b.findAllByType(Text).some((t: any) => pattern.test(textOf(t))),
    );

describe('H1c — Team Lead attaches a Circuit (AssignJobsScreen)', () => {
  beforeEach(() => {
    mockApiGet.mockClear();
    mockApiPatch.mockClear();
  });

  test('cascading picker resolves each level and PATCHes the real circuitId', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<AssignJobsScreen />);
    });
    await flush();

    // ── Step 1: the fault card offers "Add Circuit" (no circuit attached yet) ──────────
    const addBtn = findButtonByText(tree, /Add Circuit/i);
    expect(addBtn).toBeTruthy();

    await act(async () => {
      addBtn.props.onPress();
    });
    await flush();

    // Opmcs were fetched when the picker opened.
    expect(mockApiGet).toHaveBeenCalledWith('/api/opmcs?status=ACTIVE');

    // ── Step 2: pick the OPMC ───────────────────────────────────────────────────────────
    const opmcChip = findButtonByText(tree, /CEOP/);
    expect(opmcChip).toBeTruthy();
    await act(async () => {
      opmcChip.props.onPress();
    });
    await flush();
    expect(mockApiGet).toHaveBeenCalledWith('/api/exchanges?opmcId=1');

    // ── Step 3: pick the Exchange ────────────────────────────────────────────────────────
    const exchangeChip = findButtonByText(tree, /^BL —/);
    expect(exchangeChip).toBeTruthy();
    await act(async () => {
      exchangeChip.props.onPress();
    });
    await flush();
    expect(mockApiGet).toHaveBeenCalledWith('/api/cabs?exchangeId=10');

    // ── Step 4: pick the Cab ─────────────────────────────────────────────────────────────
    const cabChip = findButtonByText(tree, /BL-UPW-0309/);
    expect(cabChip).toBeTruthy();
    await act(async () => {
      cabChip.props.onPress();
    });
    await flush();
    expect(mockApiGet).toHaveBeenCalledWith('/api/dps?cabId=100');

    // ── Step 5: pick the DP ──────────────────────────────────────────────────────────────
    const dpChip = findButtonByText(tree, /U009/);
    expect(dpChip).toBeTruthy();
    await act(async () => {
      dpChip.props.onPress();
    });
    await flush();
    expect(mockApiGet).toHaveBeenCalledWith('/api/circuits?dpId=1000');

    // ── Step 6: exactly one Circuit for this DP -- auto-selected, no extra tap needed ─────
    // (proven by the Attach button being enabled next, not by a chip tap)

    // ── Step 7: submit ───────────────────────────────────────────────────────────────────
    const attachBtn = findButtonByText(tree, /^🔗 Attach Circuit$/);
    expect(attachBtn).toBeTruthy();
    expect(attachBtn.props.disabled).toBeFalsy();

    await act(async () => {
      attachBtn.props.onPress();
    });
    await flush();

    // ── Step 8: the real endpoint was called with the real, auto-selected circuitId ──────
    expect(mockApiPatch).toHaveBeenCalledWith('/api/faults/501/circuit', {circuitId: 24473});
  }, 30000);

  test('attach button stays disabled until a Circuit is actually selected', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<AssignJobsScreen />);
    });
    await flush();

    const addBtn = findButtonByText(tree, /Add Circuit/i);
    await act(async () => {
      addBtn.props.onPress();
    });
    await flush();

    // Nothing selected yet at any level.
    const attachBtn = findButtonByText(tree, /^🔗 Attach Circuit$/);
    expect(attachBtn).toBeTruthy();
    expect(attachBtn.props.disabled).toBeTruthy();
    expect(mockApiPatch).not.toHaveBeenCalled();
  });
});
