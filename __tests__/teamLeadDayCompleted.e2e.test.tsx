/**
 * ATT-017 (07_ATTENDANCE, FR-20) — after a Team Lead has completed EOD for the day, the dashboard
 * must show a distinct "Day Completed" state instead of the live Assign / EOD buttons, so the
 * confusing "No active session found" error is not reachable at all.
 *
 * TOOL SUBSTITUTION. The row's Tool column says "Detox" and its mapping names
 * `teamLeadDayCompleted.e2e.ts::showsCompletedStateNotError`. Detox builds but cannot run live on
 * this host (software-rendered emulator under virtualization; the ANR watchdog kills the app before
 * Detox's bridge attaches) — a project decision recorded in `docs/SLT_Test_Plan_V1.docx` §3 and the
 * Resolution Log of `docs/QA_Compliance_Consolidated_Report.md`. Substituted with Jest +
 * react-test-renderer against the REAL `screens/teamlead/HomeScreen.tsx`, the same substitution
 * `clientLogin.e2e.test.tsx` (AUTH-016) makes. `@testing-library/react-native` is genuinely not a
 * dependency of this app.
 *
 * WHAT THE ERROR IS AND WHY IT IS REACHABLE. `JobService.performEod` starts with
 * `sessionRepo.findByTeamLeadIdAndStatus(teamLeadId, ACTIVE).orElseThrow(() -> new
 * RuntimeException("No active session found. You must do BOD before EOD."))`. After EOD the
 * session is `CLOSED`, so a second EOD hits exactly that. The dashboard has no way to prevent it:
 * `checkTodaysSession` calls `GET /api/jobs/session`, which is `JobService.getTodaysSession` —
 * `findByTeamLeadIdAndSessionDate(teamLeadId, today)`, returning today's session **whatever its
 * status** — and the reducer discards the returned `DaySession` body entirely, setting only
 * `state.hasBODToday = true` (`technicianSlice.ts`, `checkTodaysSession.fulfilled`). So the Team
 * Lead screen's single boolean cannot distinguish "BOD done, day running" from "BOD and EOD both
 * done, day over", and renders the Assign/EOD pair for both.
 *
 * RELATED BUT DISTINCT COVERAGE, deliberately not duplicated: `technicianSlice.bodEod.test.ts`'s
 * "Layer 3 — Team Lead BOD door stays closed after EOD" asserts that `hasBODToday` stays TRUE after
 * EOD, which is what stops a second BOD. That fix is what makes this row's gap visible: the door is
 * correctly shut, but the screen then shows the wrong thing on the other side of it.
 */
import React from 'react';
import {TouchableOpacity, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';

jest.useFakeTimers();

// The row's Test Data: a Team Lead whose session for today has status CLOSED.
// `hasBODToday` is the ONLY thing the reducer records about it — see the header.
const mockState: any = {
  auth: {user: {id: 7, name: 'Lead Kamal'}},
  technician: {
    tasks: [] as any[],
    teamMembers: [] as any[],
    teamStats: null,
    hasBODToday: true,
    // The fix: checkTodaysSession.fulfilled now keeps the session's real
    // status instead of discarding it, so the screen can tell this apart
    // from "BOD done, day still running" (ACTIVE).
    todaySessionStatus: 'CLOSED',
    isLoading: false,
    error: null,
  },
};

const mockNavigate = jest.fn();
const mockDispatch = jest.fn(() => ({
  unwrap: () => Promise.resolve({}),
  catch: () => undefined,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
  useFocusEffect: jest.fn(),
}));
jest.mock('@react-navigation/stack', () => ({}));

jest.mock('@store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (sel: any) => sel(mockState),
}));

jest.mock('@store/slices/technicianSlice', () => {
  const makeThunk = (type: string) =>
    jest.fn((args: any) => ({type, payload: args}));
  return {
    fetchTeamTasks: makeThunk('technician/fetchTeamTasks'),
    fetchTeamMembers: makeThunk('technician/fetchTeamMembers'),
    fetchTeamStats: makeThunk('technician/fetchTeamStats'),
    fetchMyFaults: makeThunk('technician/fetchMyFaults'),
    checkTodaysSession: makeThunk('technician/checkTodaysSession'),
    assignTask: makeThunk('technician/assignTask'),
  };
});

jest.mock('@services/api', () => ({
  __esModule: true,
  default: {get: jest.fn().mockResolvedValue({data: {requests: []}})},
}));

// Host-component stand-ins, the JobsMapScreen.sort.test.tsx convention.
jest.mock('react-native-maps', () => {
  const ReactLocal = require('react');
  const MapView = ReactLocal.forwardRef((props: any, ref: any) => {
    ReactLocal.useImperativeHandle(ref, () => ({
      fitToCoordinates: jest.fn(),
      animateToRegion: jest.fn(),
    }));
    return ReactLocal.createElement('MapView', props, props.children);
  });
  return {
    __esModule: true,
    default: MapView,
    Marker: (props: any) =>
      ReactLocal.createElement('Marker', props, props.children),
    PROVIDER_GOOGLE: 'google',
  };
});

import TeamLeadHomeScreen from '@screens/teamlead/HomeScreen';

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.map((x: any) => String(x)).join('') : String(c);
};

const allText = (tree: any) =>
  tree.root.findAllByType(Text).map(textOf).join(' | ');

const tappableLabels = (tree: any) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .map((b: any) => b.findAllByType(Text).map(textOf).join(''))
    .filter(Boolean);

describe('Team Lead dashboard after EOD (ATT-017)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockDispatch.mockClear();
  });

  test('showsCompletedStateNotError', async () => {
    // ── Steps 1-2: the Team Lead opens the dashboard with today's EOD already done ──
    let tree: any;
    await act(async () => {
      tree = renderer.create(<TeamLeadHomeScreen />);
    });
    await act(async () => {
      for (let i = 0; i < 8; i++) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
      }
    });

    const screenText = allText(tree);
    const buttons = tappableLabels(tree);

    // ── Steps 3-4 ───────────────────────────────────────────────────────────────────
    // PRODUCTION CHANGE REQUIRED — see the file header for the root cause. The
    // Technician side already has exactly the state this row asks for
    // (screens/technician/HomeScreen.tsx renders "✅ Day Completed" /
    // "BOD/EOD already done for today" when todayAttendance.currentStatus is
    // CHECKED_OUT); the Team Lead side has no equivalent because its own state
    // carries no session status to branch on.
    const problems: string[] = [];

    if (!/Day Completed/i.test(screenText)) {
      problems.push(
        'no "Day Completed" state is rendered once EOD is done. Screen text: '
          + screenText.slice(0, 400),
      );
    }

    const liveEod = buttons.filter(b => /EOD/i.test(b));
    if (liveEod.length > 0) {
      problems.push(
        'the live EOD button is still offered after the day is closed, and tapping it '
          + 'navigates to the EOD screen whose submit hits POST /api/jobs/eod and fails '
          + 'with "No active session found. You must do BOD before EOD." Buttons still '
          + 'shown: ' + JSON.stringify(liveEod),
      );
    }

    const liveAssign = buttons.filter(b => /Assign/i.test(b));
    if (liveAssign.length > 0) {
      problems.push(
        'the live Assign button is still offered after the day is closed; '
          + 'JobService.createJob has the same ACTIVE-session guard and answers '
          + '"You must complete BOD before creating jobs." Buttons still shown: '
          + JSON.stringify(liveAssign),
      );
    }

    expect(problems).toEqual([]);

    act(() => tree.unmount());
  });
});
