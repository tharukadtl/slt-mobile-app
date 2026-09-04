/**
 * Live-verification FR-29 Stage 2b (SRS 5.6.6) — Technician JobsMapScreen:
 * pending-job distance-vs-priority sort, top-pick highlighting, partial-failure
 * handling, and the straight-line "honesty" note.
 *
 * Renders the REAL JobsMapScreen (screens/technician/JobsMapScreen.tsx) with
 * react-test-renderer (the sanctioned approach here — @testing-library/react-native
 * is not installed), same style as NavigationScreen.honesty.test.tsx (Stage 2a).
 *
 * technicianService.getShortestPath is mocked per test so that the DISTANCE sort
 * order and the PRIORITY sort order are genuinely different (and produce
 * different top picks), otherwise the test could not distinguish the two modes.
 *
 * Mock task set (all pending, all have GPS):
 *   id  customer     priority  scheduledDate  lat  distanceKm
 *   a   Alpha Co     LOW       09:00          1    2   (closest)
 *   b   Bravo Co     HIGH      08:00          2    8
 *   c   Charlie Co   MEDIUM    10:00          3    5
 *   d   Delta Co     HIGH      11:00          4    12  (farthest)
 *
 *   PRIORITY order (HIGH→MED→LOW, HIGH tie broken by scheduledDate asc):
 *     Bravo, Delta, Charlie, Alpha   → top pick = Bravo
 *   DISTANCE order (ascending km):
 *     Alpha(2), Charlie(5), Bravo(8), Delta(12) → top pick = Alpha
 *
 * SCOPE: this is a rendered-component-level check (react-test-renderer) with
 * mocked Redux tasks, mocked geolocation and a mocked shortest-path service. It
 * proves the sort/highlight/partial-failure LOGIC and JSX conditionals are
 * correct in the rendered tree. It does NOT prove real map-pin visual placement,
 * real on-device GPS behaviour, or real network latency/behaviour — no device or
 * emulator was attached for this pass.
 */
import React from 'react';
import {Text, TouchableOpacity, PermissionsAndroid} from 'react-native';
import renderer, {act} from 'react-test-renderer';

// TouchableOpacity drives an Animated value on press; fake timers keep those
// callbacks dormant so they never setState after teardown (same convention as
// BODScreen.checkIn.test.tsx / HomeScreen.completeRouting.test.tsx).
jest.useFakeTimers();

// ── react-native-maps: host-component stand-ins so we can inspect Marker props ──
jest.mock('react-native-maps', () => {
  const React = require('react');
  const MapView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      fitToCoordinates: jest.fn(),
      animateToRegion: jest.fn(),
    }));
    return React.createElement('MapView', props, props.children);
  });
  return {
    __esModule: true,
    default: MapView,
    Marker: (props: any) => React.createElement('Marker', props, props.children),
    PROVIDER_GOOGLE: 'google',
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn(), navigate: jest.fn()}),
  // The screen calls dispatch(fetchTasks()) in a useFocusEffect; we drive tasks
  // via the mocked selector instead, so make focus-effect a no-op.
  useFocusEffect: jest.fn(),
}));
jest.mock('@react-navigation/stack', () => ({}));

// state.technician → {tasks, isLoading}. Four pending jobs (see header table).
const mockState: any = {
  technician: {
    isLoading: false,
    tasks: [
      {
        id: 'a', customerName: 'Alpha Co', status: 'assigned', priority: 'LOW',
        scheduledDate: '2026-07-23T09:00:00Z',
        location: {address: 'Addr A', latitude: 1, longitude: 1},
      },
      {
        id: 'b', customerName: 'Bravo Co', status: 'accepted', priority: 'HIGH',
        scheduledDate: '2026-07-23T08:00:00Z',
        location: {address: 'Addr B', latitude: 2, longitude: 2},
      },
      {
        id: 'c', customerName: 'Charlie Co', status: 'pending', priority: 'MEDIUM',
        scheduledDate: '2026-07-23T10:00:00Z',
        location: {address: 'Addr C', latitude: 3, longitude: 3},
      },
      {
        id: 'd', customerName: 'Delta Co', status: 'in_progress', priority: 'HIGH',
        scheduledDate: '2026-07-23T11:00:00Z',
        location: {address: 'Addr D', latitude: 4, longitude: 4},
      },
    ],
  },
};
const mockDispatch = jest.fn();
jest.mock('@store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (sel: any) => sel(mockState),
}));

// fetchTasks is imported at module load — stub it so importing the screen does
// not pull in the real slice (axios / AsyncStorage / config).
jest.mock('@store/slices/technicianSlice', () => ({
  fetchTasks: jest.fn(() => ({type: 'tech/fetchTasks'})),
}));

// Geolocation: deliver an initial fix synchronously so currentLocation is set
// before the Distance toggle is tapped. lat 6.9 is deliberately outside the
// job-marker lat set {1,2,3,4} so it never collides in order extraction.
const mockGetCurrentPosition = jest.fn((success: any) =>
  success({coords: {latitude: 6.9, longitude: 79.86}}),
);
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: (...args: any[]) => (mockGetCurrentPosition as any)(...args),
    watchPosition: jest.fn(() => 1),
    clearWatch: jest.fn(),
  },
}));

// The unit under test's distance source — driven per test.
const mockGetShortestPath = jest.fn();
jest.mock('@services/technicianService', () => ({
  __esModule: true,
  default: {getShortestPath: (...a: any[]) => (mockGetShortestPath as any)(...a)},
}));

import JobsMapScreen from '@screens/technician/JobsMapScreen';

// distanceKm keyed by the job's latitude (getShortestPath is called with the
// job's lat as the 3rd arg), so ordering is deterministic regardless of the
// order Promise.allSettled resolves in.
const DIST_BY_LAT: Record<number, number> = {1: 2, 2: 8, 3: 5, 4: 12};
const LAT_TO_CUSTOMER: Record<number, string> = {
  1: 'Alpha Co', 2: 'Bravo Co', 3: 'Charlie Co', 4: 'Delta Co',
};
const CUSTOMERS = Object.values(LAT_TO_CUSTOMER);

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.join('') : String(c ?? '');
};

const allText = (tree: any): string =>
  tree.root.findAllByType(Text).map(textOf).join(' | ');

// Marker order = the job markers (coordinate.latitude in the job set) in the
// order they appear in the tree, which is sortedTasks order.
const markerCustomerOrder = (tree: any): string[] =>
  tree.root
    .findAll((n: any) => n.type === 'Marker')
    .map((n: any) => n.props.coordinate?.latitude)
    .filter((lat: number) => LAT_TO_CUSTOMER[lat] !== undefined)
    .map((lat: number) => LAT_TO_CUSTOMER[lat]);

// Card order = the customer-name Texts in tree order (customerName only appears
// on the bottom job cards).
const cardCustomerOrder = (tree: any): string[] =>
  tree.root
    .findAllByType(Text)
    .map(textOf)
    .filter((s: string) => CUSTOMERS.includes(s));

// Which customer is the "🏆 Top Pick" marker (via its coordinate).
const topMarkerCustomer = (tree: any): string | undefined => {
  const marker = tree.root
    .findAll((n: any) => n.type === 'Marker')
    .find((m: any) =>
      m.findAllByType(Text).some((t: any) => textOf(t).includes('Top Pick')),
    );
  const lat = marker?.props.coordinate?.latitude;
  return lat !== undefined ? LAT_TO_CUSTOMER[lat] : undefined;
};

// Which customer is the "🏆 #1" bottom card.
const topCardCustomer = (tree: any): string | undefined => {
  const card = tree.root
    .findAllByType(TouchableOpacity)
    .find((c: any) =>
      c.findAllByType(Text).some((t: any) => textOf(t).includes('#1')),
    );
  return card
    ?.findAllByType(Text)
    .map(textOf)
    .find((s: string) => CUSTOMERS.includes(s));
};

const findToggle = (tree: any, label: string) =>
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

const renderScreen = async () => {
  let tree: any;
  await act(async () => {
    tree = renderer.create(<JobsMapScreen />);
  });
  // Let requestLocation()'s permission + geolocation success settle so
  // currentLocation is populated before any Distance toggle.
  await flush();
  return tree;
};

const switchToDistance = async (tree: any) => {
  const btn = findToggle(tree, '📍 Distance');
  expect(btn).toBeDefined();
  await act(async () => {
    btn.props.onPress();
  });
  // Resolve the parallel getShortestPath promises + their setState updates.
  await flush();
};

const switchToPriority = async (tree: any) => {
  const btn = findToggle(tree, '⭐ Priority');
  expect(btn).toBeDefined();
  await act(async () => {
    btn.props.onPress();
  });
  await flush();
};

describe('JobsMapScreen — distance/priority sort (FR-29 Stage 2b)', () => {
  let permSpy: jest.SpyInstance;

  beforeEach(() => {
    mockGetShortestPath.mockReset();
    mockDispatch.mockClear();
    // Android path awaits a permission grant; harmless on the ios-default preset.
    permSpy = jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED as any);
  });

  afterEach(() => {
    permSpy?.mockRestore();
    jest.clearAllTimers();
  });

  // ── Item 1: toggle re-sorts both surfaces correctly ──────────────────────
  test('Item 1 — PRIORITY order by default; DISTANCE order after toggle (markers + cards)', async () => {
    mockGetShortestPath.mockImplementation(
      (_cLat: number, _cLng: number, fLat: number) =>
        Promise.resolve({
          distanceKm: DIST_BY_LAT[fLat],
          etaMinutes: DIST_BY_LAT[fLat] * 3,
          routed: false,
        }),
    );

    const tree = await renderScreen();

    // Default PRIORITY sort: HIGH(earlier→later) → MEDIUM → LOW.
    const priorityExpected = ['Bravo Co', 'Delta Co', 'Charlie Co', 'Alpha Co'];
    expect(markerCustomerOrder(tree)).toEqual(priorityExpected);
    expect(cardCustomerOrder(tree)).toEqual(priorityExpected);

    await switchToDistance(tree);

    // DISTANCE sort ascending km: Alpha(2) Charlie(5) Bravo(8) Delta(12).
    const distanceExpected = ['Alpha Co', 'Charlie Co', 'Bravo Co', 'Delta Co'];
    expect(markerCustomerOrder(tree)).toEqual(distanceExpected);
    expect(cardCustomerOrder(tree)).toEqual(distanceExpected);
    // The two orders genuinely differ (guards against a false pass).
    expect(distanceExpected).not.toEqual(priorityExpected);

    act(() => tree.unmount());
  });

  // ── Item 2: top-rank highlighting agrees across both surfaces, per mode ───
  test('Item 2 — same task is Top Pick on marker + card, and it changes with the mode', async () => {
    mockGetShortestPath.mockImplementation(
      (_cLat: number, _cLng: number, fLat: number) =>
        Promise.resolve({
          distanceKm: DIST_BY_LAT[fLat],
          etaMinutes: DIST_BY_LAT[fLat] * 3,
          routed: false,
        }),
    );

    const tree = await renderScreen();

    // PRIORITY mode: highest-priority (earliest HIGH) = Bravo, on BOTH surfaces.
    expect(topMarkerCustomer(tree)).toBe('Bravo Co');
    expect(topCardCustomer(tree)).toBe('Bravo Co');
    expect(topMarkerCustomer(tree)).toBe(topCardCustomer(tree));

    await switchToDistance(tree);

    // DISTANCE mode: closest job = Alpha, on BOTH surfaces (changed from Bravo).
    expect(topMarkerCustomer(tree)).toBe('Alpha Co');
    expect(topCardCustomer(tree)).toBe('Alpha Co');
    expect(topMarkerCustomer(tree)).toBe(topCardCustomer(tree));

    act(() => tree.unmount());
  });

  // ── Item 3: partial failure handling ─────────────────────────────────────
  test('Item 3 — one failed lookup: no crash, others sorted, failed job shows "Distance unavailable" and sorts last', async () => {
    // Bravo (lat 2) rejects; the other three resolve. Bravo's real distance
    // (8km) would place it 3rd, so a correct "sorts last on failure" pushes it
    // from 3rd to last — a genuine test of the fallback, not a coincidence.
    mockGetShortestPath.mockImplementation(
      (_cLat: number, _cLng: number, fLat: number) => {
        if (fLat === 2) return Promise.reject(new Error('no path'));
        return Promise.resolve({
          distanceKm: DIST_BY_LAT[fLat],
          etaMinutes: DIST_BY_LAT[fLat] * 3,
          routed: false,
        });
      },
    );

    const tree = await renderScreen();
    await switchToDistance(tree);

    // (a) No crash — tree still queryable.
    const text = allText(tree);

    // (b) The three successful jobs sorted correctly relative to each other,
    //     and the failed job (Bravo) pushed to the very end.
    const expected = ['Alpha Co', 'Charlie Co', 'Delta Co', 'Bravo Co'];
    expect(cardCustomerOrder(tree)).toEqual(expected);
    expect(markerCustomerOrder(tree)).toEqual(expected);

    // (c) Failed job renders "Distance unavailable" (still present as a card,
    //     not dropped), and the successful ones render a real distance number.
    expect(text).toContain('Distance unavailable');
    expect(text).toContain('≈ 2.0 km');  // Alpha
    expect(text).toContain('≈ 5.0 km');  // Charlie
    expect(text).toContain('≈ 12.0 km'); // Delta
    // Exactly one job is unavailable.
    expect(text.match(/Distance unavailable/g)?.length).toBe(1);

    // Top pick is still the closest successful job.
    expect(topCardCustomer(tree)).toBe('Alpha Co');
    expect(topMarkerCustomer(tree)).toBe('Alpha Co');

    act(() => tree.unmount());
  });

  // ── Item 4: honesty note present in DISTANCE, absent in PRIORITY ──────────
  test('Item 4 — straight-line honesty note only shows in DISTANCE mode', async () => {
    mockGetShortestPath.mockImplementation(
      (_cLat: number, _cLng: number, fLat: number) =>
        Promise.resolve({
          distanceKm: DIST_BY_LAT[fLat],
          etaMinutes: DIST_BY_LAT[fLat] * 3,
          routed: false,
        }),
    );

    const tree = await renderScreen();

    // Default PRIORITY mode: note absent.
    expect(allText(tree)).not.toContain('Straight-line estimates');

    await switchToDistance(tree);
    // DISTANCE mode: note present (verbatim wording from the component).
    const distText = allText(tree);
    expect(distText).toContain('Straight-line estimates');
    expect(distText).toContain('not a real routed distance');

    await switchToPriority(tree);
    // Toggled back to PRIORITY: note disappears again (not merely "never shown").
    expect(allText(tree)).not.toContain('Straight-line estimates');

    act(() => tree.unmount());
  });
});
