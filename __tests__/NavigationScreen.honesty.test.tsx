/**
 * Live-verification Item 4 (FR-29 Stage 2a, SRS 5.6.6) — Technician mobile
 * single-job shortest-path navigation, "honesty" UI behaviour.
 *
 * NavigationScreen no longer computes a client-side straight-line distance; it
 * calls technicianService.getShortestPath() (which POSTs to fieldops'
 * /api/location/shortest-path -> Flask /api/ai/shortest-path) and renders
 * EXACTLY what the backend returns, including being honest when the result is a
 * Haversine straight-line estimate rather than a real routed path.
 *
 * The three honesty affordances are all driven off `shortestPath?.routed`:
 *   1. Info-panel banner "≈ Approximate direction — straight-line estimate,
 *      not a turn-by-turn route" — shown ONLY when routed === false.
 *   2. Route polyline: dashed + amber (colors.warning, lineDashPattern [8,4])
 *      when routed === false; solid + primary (colors.primary, no dash) when true.
 *   3. A "≈ " prefix on the Distance stat when routed === false.
 *
 * These tests render the REAL TechnicianNavigationScreen with react-test-renderer
 * (the sanctioned approach here — @testing-library/react-native is not installed),
 * mock technicianService.getShortestPath to resolve first {routed:false} then
 * {routed:true}, and assert each affordance appears / disappears accordingly.
 *
 * NOTE: this is a rendered-component-level check (react-test-renderer), NOT an
 * on-device / emulator visual confirmation. No device was attached for this pass.
 */
import React from 'react';
import {Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {colors} from '@theme/colors';

// fitMapToCoordinates schedules a 500ms setTimeout; fake timers keep it dormant
// so it never fires setState after the test tree is torn down.
jest.useFakeTimers();

// ── react-native-maps: host-component stand-ins so we can inspect Polyline props ──
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
    Polyline: (props: any) => React.createElement('Polyline', props),
    PROVIDER_GOOGLE: 'google',
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
  useRoute: () => ({params: {taskId: '1'}}),
}));
jest.mock('@react-navigation/stack', () => ({}));

// Store state the screen selects: state.technician.tasks — one task with a
// location, matching the routed taskId so jobLocation is well-defined.
const mockState: any = {
  technician: {
    tasks: [
      {
        id: '1',
        customerName: 'Test Customer',
        location: {latitude: 6.8511, longitude: 79.8636, address: '12 Galle Rd'},
      },
    ],
  },
};
const mockDispatch = jest.fn();
jest.mock('@store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (sel: any) => sel(mockState),
}));

// markArrived is imported at module load; give it a fulfilled.match so the
// import resolves. handleMarkArrived is never invoked by these tests.
jest.mock('@store/slices/technicianSlice', () => {
  const markArrived: any = jest.fn((id: any) => ({type: 'tech/markArrived', payload: id}));
  markArrived.fulfilled = {match: jest.fn(() => false)};
  return {markArrived};
});

// Geolocation: deliver an initial fix synchronously so the screen leaves its
// loading state and calls fetchShortestPath(). watchPosition is a no-op that
// returns a watch id (so it does not trigger extra re-fetches mid-assertion).
const mockGetCurrentPosition = jest.fn((success: any) =>
  success({coords: {latitude: 6.9344, longitude: 79.8428, speed: 5}}),
);
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: (...args: any[]) => (mockGetCurrentPosition as any)(...args),
    watchPosition: jest.fn(() => 1),
    clearWatch: jest.fn(),
  },
}));

// The unit under test's data source — driven per test.
const mockGetShortestPath = jest.fn();
jest.mock('@services/technicianService', () => ({
  __esModule: true,
  default: {getShortestPath: (...a: any[]) => (mockGetShortestPath as any)(...a)},
}));

import TechnicianNavigationScreen from '@screens/technician/NavigationScreen';

const WAYPOINTS = [
  {lat: 6.9344, lng: 79.8428},
  {lat: 6.8511, lng: 79.8636},
];

// The genuine backend numbers for these coords (verified live against Flask):
// distanceKm 9.543 -> "9.5 km", etaMinutes 19.
const baseResult = {
  waypoints: WAYPOINTS,
  distanceKm: 9.543,
  etaMinutes: 19,
  algorithm: 'dijkstra (haversine-fallback, straight-line)',
  avgSpeedKmh: 30.0,
};

const allText = (tree: any): string =>
  tree.root
    .findAllByType(Text)
    .map((t: any) => {
      const c = t.props.children;
      return Array.isArray(c) ? c.join('') : String(c ?? '');
    })
    .join(' | ');

// The "main" route line is the strokeWidth-4 Polyline (the strokeWidth-6 one is
// the drop shadow). Returns its props, or undefined if not rendered.
const mainRoutePolyline = (tree: any): any =>
  tree.root
    .findAll((n: any) => n.type === 'Polyline')
    .map((n: any) => n.props)
    .find((p: any) => p.strokeWidth === 4);

const renderScreen = async () => {
  let tree: any;
  await act(async () => {
    tree = renderer.create(<TechnicianNavigationScreen />);
  });
  // Flush the awaited getShortestPath promise + its setState updates.
  await act(async () => {});
  return tree;
};

describe('NavigationScreen — shortest-path honesty UI (FR-29 Stage 2a)', () => {
  beforeEach(() => {
    mockGetShortestPath.mockReset();
    mockDispatch.mockClear();
  });
  afterEach(() => {
    jest.clearAllTimers();
  });

  test('routed:false — approximate banner shown, polyline amber+dashed, distance "≈ " prefixed', async () => {
    mockGetShortestPath.mockResolvedValue({...baseResult, routed: false});

    const tree = await renderScreen();
    const text = allText(tree);

    // 1. Honesty banner present (verbatim wording from the component).
    expect(text).toContain('Approximate direction');
    expect(text).toContain('straight-line estimate, not a');
    expect(text).toContain('turn-by-turn route');

    // 2. Main route polyline is amber (colors.warning) and dashed ([8,4]).
    const line = mainRoutePolyline(tree);
    expect(line).toBeDefined();
    expect(line.strokeColor).toBe(colors.warning); // #FFC107
    expect(line.lineDashPattern).toEqual([8, 4]);

    // 3. Distance stat carries the "≈ " prefix over the real backend number.
    expect(text).toContain('≈ 9.5 km');

    act(() => tree.unmount());
  });

  test('routed:true — no banner, polyline primary+solid, distance NOT prefixed', async () => {
    mockGetShortestPath.mockResolvedValue({...baseResult, routed: true});

    const tree = await renderScreen();
    const text = allText(tree);

    // 1. No honesty banner anywhere, and no "≈" approximation glyph at all
    //    (the prefix and banner are the only sources of "≈" in this screen).
    expect(text).not.toContain('Approximate direction');
    expect(text).not.toContain('≈');

    // 2. Main route polyline is primary (colors.primary) and solid (no dash).
    const line = mainRoutePolyline(tree);
    expect(line).toBeDefined();
    expect(line.strokeColor).toBe(colors.primary); // #003087
    expect(line.lineDashPattern).toBeUndefined();

    // 3. Distance still rendered from the real backend number, just unprefixed.
    expect(text).toContain('9.5 km');

    act(() => tree.unmount());
  });
});
