/**
 * Regression coverage for QA_Compliance_Consolidated_Report §2.3 —
 * "once-per-calendar-day BOD/EOD limit unenforced", mobile layers.
 *
 * These are reducer-level tests. The project has no @testing-library/react-native
 * installed (only react-test-renderer), and the existing __tests__/App.test.tsx
 * cannot even render because the react-native jest preset does not transform the
 * react-redux ESM build. So per the fallback path, we verify the production
 * reducer logic in technicianSlice.ts that the fix relies on, and (for the
 * technician gate) the exact boolean derivation HomeScreen uses on top of it.
 *
 * We mock @services/api so importing the slice does not pull in axios/config;
 * the thunk payload creators are never executed here — we drive the reducer
 * directly via the auto-generated .fulfilled/.rejected action creators.
 */
jest.mock('@services/api', () => ({
  __esModule: true,
  default: {get: jest.fn(), post: jest.fn(), patch: jest.fn()},
}));

import reducer, {
  performBOD,
  checkTodaysSession,
  fetchTodayAttendance,
  setHasBODToday,
} from '@store/slices/technicianSlice';
import type {TodayAttendance} from '@appTypes/technician.types';

const initial = () => reducer(undefined, {type: '@@INIT'} as any);

const attendance = (
  currentStatus: TodayAttendance['currentStatus'],
): TodayAttendance => ({
  isCheckedIn: currentStatus === 'CHECKED_IN',
  checkInTime: currentStatus === 'NOT_CHECKED_IN' ? null : '2026-07-20T08:00:00Z',
  checkOutTime: currentStatus === 'CHECKED_OUT' ? '2026-07-20T17:00:00Z' : null,
  currentStatus,
  date: '2026-07-20',
});

// Mirrors the exact derivation in HomeScreen.tsx (lines 97-99). If the stored
// status is CHECKED_OUT/CHECKED_IN, handleBODCheckIn short-circuits with an
// Alert and never dispatches submitBODCheckIn.
const gate = (state: ReturnType<typeof initial>) => {
  const todayStatus = state.todayAttendance?.currentStatus ?? 'NOT_CHECKED_IN';
  return {
    hasCheckedInToday: todayStatus !== 'NOT_CHECKED_IN',
    hasCheckedOutToday: todayStatus === 'CHECKED_OUT',
  };
};

describe('Layer 2 — Technician BOD gate is calendar-date-scoped via todayAttendance', () => {
  it('stores server-reported status across the real BOD→EOD sequence', () => {
    let state = initial();
    expect(state.todayAttendance).toBeNull();

    // NOT_CHECKED_IN — start of day, BOD allowed
    state = reducer(
      state,
      fetchTodayAttendance.fulfilled(attendance('NOT_CHECKED_IN'), 'r1', undefined),
    );
    expect(state.todayAttendance?.currentStatus).toBe('NOT_CHECKED_IN');
    expect(gate(state).hasCheckedInToday).toBe(false);
    expect(gate(state).hasCheckedOutToday).toBe(false);

    // CHECKED_IN — after BOD, second BOD blocked
    state = reducer(
      state,
      fetchTodayAttendance.fulfilled(attendance('CHECKED_IN'), 'r2', undefined),
    );
    expect(state.todayAttendance?.currentStatus).toBe('CHECKED_IN');
    expect(gate(state).hasCheckedInToday).toBe(true);

    // CHECKED_OUT — after EOD, second BOD STILL blocked (the bug scenario)
    state = reducer(
      state,
      fetchTodayAttendance.fulfilled(attendance('CHECKED_OUT'), 'r3', undefined),
    );
    expect(state.todayAttendance?.currentStatus).toBe('CHECKED_OUT');
  });

  it('BLOCKS a second same-day BOD after EOD (currentStatus CHECKED_OUT)', () => {
    // This is the exact QA bug: "Technician once-per-day BOD bypassable — resets
    // after EOD." With the fix, the server reports CHECKED_OUT for today, so the
    // gate stays closed instead of re-opening once the local checkInTime cleared.
    let state = initial();
    state = reducer(
      state,
      fetchTodayAttendance.fulfilled(attendance('CHECKED_OUT'), 'r1', undefined),
    );

    const {hasCheckedInToday, hasCheckedOutToday} = gate(state);
    // handleBODCheckIn returns early ("Day Already Completed") when either is true.
    expect(hasCheckedOutToday).toBe(true);
    expect(hasCheckedInToday).toBe(true);
    // Therefore no POST /api/attendance/check-in is dispatched — BOD is blocked.
  });

  it('resets todayAttendance to null when the fetch is rejected (no leaked stale gate)', () => {
    let state = initial();
    state = reducer(
      state,
      fetchTodayAttendance.fulfilled(attendance('CHECKED_OUT'), 'r1', undefined),
    );
    expect(state.todayAttendance).not.toBeNull();

    state = reducer(
      state,
      fetchTodayAttendance.rejected(new Error('network'), 'r2', undefined),
    );
    expect(state.todayAttendance).toBeNull();
  });
});

describe('Layer 3 — Team Lead BOD door stays closed after EOD', () => {
  it('performBOD sets hasBODToday true; checkTodaysSession after EOD keeps it true', () => {
    let state = initial();
    expect(state.hasBODToday).toBe(false);

    // BOD done
    state = reducer(state, performBOD.fulfilled({id: 1}, 'r1', {} as any));
    expect(state.hasBODToday).toBe(true);

    // EOD screen now dispatches checkTodaysSession() instead of setHasBODToday(false).
    // Today's DaySession row still exists (now CLOSED), so the GET /api/jobs/session
    // re-check resolves fulfilled → hasBODToday MUST remain true (door stays shut).
    state = reducer(
      state,
      checkTodaysSession.fulfilled({id: 1, status: 'CLOSED'}, 'r2', undefined),
    );
    expect(state.hasBODToday).toBe(true);
  });

  it('checkTodaysSession.rejected sets hasBODToday false only when no session exists today', () => {
    let state = initial();
    state = reducer(state, performBOD.fulfilled({id: 1}, 'r1', {} as any));
    expect(state.hasBODToday).toBe(true);

    // 404/400 — no row for today (e.g. genuinely a new calendar day)
    state = reducer(
      state,
      checkTodaysSession.rejected(new Error('404'), 'r2', undefined),
    );
    expect(state.hasBODToday).toBe(false);
  });

  it('regression guard: the OLD reset path would have re-opened the door', () => {
    // Documents the fixed bug. The pre-fix EODScreen dispatched setHasBODToday(false),
    // which the reducer still honours — proving why calling it post-EOD (as the old
    // code did) re-showed "Start BOD" the same day. The fix stopped calling it here.
    let state = initial();
    state = reducer(state, performBOD.fulfilled({id: 1}, 'r1', {} as any));
    expect(state.hasBODToday).toBe(true);

    state = reducer(state, setHasBODToday(false));
    expect(state.hasBODToday).toBe(false); // the bug, had EODScreen kept calling this
  });
});
