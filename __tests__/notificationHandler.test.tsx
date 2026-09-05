/**
 * NOTIF-009 (08_NOTIFICATIONS, FR-21) — tapping a push notification must route to the screen for
 * that notification's subject, carrying that subject's id.
 *
 * FILE NAME. The sheet maps this to `notificationHandler.test.js::tap_routesToCorrectScreen`. This
 * module is TypeScript throughout and every file in __tests__ is `.test.ts(x)`, so the test is
 * written as `notificationHandler.test.tsx` with the mapped name as its `it()` label. Same
 * convention as every other row automated on this project.
 *
 * WHAT "notifHandler.onTap(notification)" REALLY IS. There is no NotificationHandler class and no
 * `onTap` method. The tap handler is `src/hooks/useNotifications.ts` — a hook whose
 * `handleNotification(data)` callback is registered with `notificationService.initialize(...)` and
 * then invoked by Firebase for all three arrival paths (`onMessage` foreground,
 * `onNotificationOpenedApp` background tap, and `getInitialNotification` cold start). Registering
 * the callback and calling it is therefore exactly the "tap" this row describes. The hook is driven
 * through a host component, which is how a hook is exercised with react-test-renderer.
 *
 * SCREEN NAMES. The row expects `FaultDetail` / `{faultId}` and `PaymentDetail` / `{paymentId}`.
 * Neither route exists: `src/types/navigation.types.ts` declares `IssueDetail: {issueId: string}`
 * and `BillDetail: {billId: string}`, which are the real destinations for a fault and a bill. The
 * assertions below use the real route names and params — asserting a route that cannot exist would
 * make the test fail for the wrong reason.
 *
 * NOTIFICATION TYPES. The types asserted are the ones the backend actually emits —
 * `Notification.NotificationType` in fieldops is FAULT_REPORTED / FAULT_ASSIGNED /
 * FAULT_IN_PROGRESS / FAULT_COMPLETED / PAYMENT_APPROVED / PAYMENT_REJECTED / ... — not the
 * hook's own private vocabulary. That mismatch is precisely what this row exists to catch, so the
 * test drives the real payloads and lets the routing verdict fall where it falls.
 *
 * TOOL: Jest + react-test-renderer, the sanctioned substitute on this project (Detox cannot run on
 * this host); `@testing-library/react-native` is not a dependency of this module.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Text} from 'react-native';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

// Capture the callback the hook registers, so it can be invoked as Firebase would on a tap.
let registeredHandler: ((data: any) => void) | null = null;

jest.mock('@services/notificationService', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(async (onNotification: (data: any) => void) => {
      registeredHandler = onNotification;
    }),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const useNotifications = require('@hooks/useNotifications').default;

const Host = () => {
  useNotifications();
  return <Text>host</Text>;
};

const FAULT_ID = '1042';
const PAYMENT_ID = '15';

/** Mounts the hook and hands back the tap callback it registered. */
const mountAndGetHandler = () => {
  let tree: any;
  act(() => {
    tree = renderer.create(<Host />);
  });
  expect(typeof registeredHandler).toBe('function');
  return {tree, tap: (data: any) => act(() => registeredHandler!(data))};
};

describe('NOTIF-009 — notification tap routing', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    registeredHandler = null;
  });

  it('tap_routesToCorrectScreen', () => {
    const {tree, tap} = mountAndGetHandler();

    try {
      // ── Steps 1-3: a FAULT_ASSIGNED push, tapped ────────────────────────────────────────
      tap({
        type: 'FAULT_ASSIGNED',
        referenceType: 'FAULT',
        referenceId: FAULT_ID,
        issueId: FAULT_ID,
        title: 'Fault Assigned to You',
        body: `Fault #FLT-2026-0${FAULT_ID} has been assigned to your team.`,
      });

      // The real route for a fault is IssueDetail/{issueId} (the sheet's FaultDetail/{faultId}
      // does not exist in navigation.types.ts).
      expect(mockNavigate).toHaveBeenCalledWith('IssueDetail', {issueId: FAULT_ID});

      // ── Steps 4-5: a PAYMENT_APPROVED push, tapped ──────────────────────────────────────
      mockNavigate.mockClear();
      tap({
        type: 'PAYMENT_APPROVED',
        referenceType: 'PAYMENT',
        referenceId: PAYMENT_ID,
        billId: PAYMENT_ID,
        title: 'Payment Approved',
        body: 'Payment PAY-2026-00015 has been approved and billed.',
      });

      // The real route for a bill is BillDetail/{billId} (the sheet's PaymentDetail/{paymentId}
      // does not exist either).
      expect(mockNavigate).toHaveBeenCalledWith('BillDetail', {billId: PAYMENT_ID});
    } finally {
      act(() => tree.unmount());
    }
  });

  /**
   * Resolved 2026-09-05: useNotifications.ts now keys on referenceType (the backend's real,
   * stable category field, sent as an FCM data entry by NotificationService.sendPush) instead of
   * the private type vocabulary this test used to drive (STATUS_UPDATE/TECHNICIAN_ASSIGNED/
   * JOB_COMPLETED/BILLING — never sent by the backend for these; also missing referenceId/
   * referenceType entirely, which routing now requires). That vocabulary is retired, not a second
   * valid input shape, so this test is no longer meaningful and was removed rather than kept green
   * by resurrecting dead code paths. The real contract is the first test above, which drives the
   * hook with the backend's actual payload shape end-to-end.
   */
});
