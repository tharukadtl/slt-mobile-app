/**
 * Regression coverage for QA Critical Issue #15 (QA_Compliance_Consolidated_Report.md
 * §3): the tap-to-call button was supposed to be removed from the Client app's
 * TechnicianTrackingScreen in SRS v1.1, but a live "📞 Call" button wired to
 * Linking.openURL('tel:...') survived the removal.
 *
 * Renders the REAL TechnicianTrackingScreen with react-test-renderer (the
 * sanctioned approach here — @testing-library/react-native is not installed),
 * with an active technicianLocation (the state that used to render the call
 * button), and asserts:
 *  - No "Call" text/button is rendered anywhere in the tree.
 *  - Linking.openURL is never invoked, even though technicianPhone is present
 *    on technicianLocation (proving the removal isn't just hiding a phone
 *    number that's still wired to a tappable element elsewhere).
 *  - The rest of the technician card (name, status, last-updated) still
 *    renders — this is a targeted removal, not a broken screen.
 */
import React from 'react';
import {Text} from 'react-native';
import {Linking} from 'react-native';
import renderer, {act} from 'react-test-renderer';

jest.mock('react-native-maps', () => {
  const React = require('react');
  const MapView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({fitToCoordinates: jest.fn()}));
    return React.createElement('MapView', props, props.children);
  });
  return {
    __esModule: true,
    default: MapView,
    Marker: (props: any) => React.createElement('Marker', props, props.children),
    Polyline: (props: any) => React.createElement('Polyline', props),
    PROVIDER_GOOGLE: 'google',
    AnimatedRegion: jest.fn(),
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
  useRoute: () => ({params: {issueId: '7'}}),
}));

const mockDispatch = jest.fn();
const mockState: any = {
  issues: {
    isLoading: false,
    selectedIssue: {
      status: 'travelling',
      location: {latitude: 6.93, longitude: 79.85, address: '123 Main St'},
    },
    technicianLocation: {
      technicianName: 'Tech Tim',
      technicianPhone: '+94771234567', // present on purpose — proves removal isn't data-driven
      latitude: 6.9271,
      longitude: 79.8612,
      eta: 12,
      distance: '3.2 km',
      lastUpdated: '2 mins ago',
    },
  },
};
jest.mock('@store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (sel: any) => sel(mockState),
}));

jest.mock('@store/slices/issueSlice', () => ({
  fetchIssueById: jest.fn((id: any) => ({type: 'issues/fetchById', payload: id})),
  fetchTechnicianLocation: jest.fn((id: any) => ({type: 'issues/fetchTechLocation', payload: id})),
}));

import TechnicianTrackingScreen from '@screens/client/TechnicianTrackingScreen';

const allText = (tree: any): string =>
  tree.root
    .findAllByType(Text)
    .map((t: any) => {
      const c = t.props.children;
      return Array.isArray(c) ? c.join('') : String(c ?? '');
    })
    .join(' | ');

describe('TechnicianTrackingScreen — tap-to-call button removed (QA Critical #15)', () => {
  let openURLSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDispatch.mockClear();
    openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any);
    jest.useFakeTimers();
  });

  afterEach(() => {
    openURLSpy.mockRestore();
    jest.useRealTimers();
  });

  test('no Call button/text is rendered, and Linking.openURL is never called', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<TechnicianTrackingScreen />);
    });

    const text = allText(tree);
    expect(text).not.toMatch(/call/i);
    expect(openURLSpy).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });

  test('the rest of the technician card still renders correctly', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<TechnicianTrackingScreen />);
    });

    const text = allText(tree);
    expect(text).toContain('Tech Tim');
    expect(text).toContain('Updated: 2 mins ago');
    expect(text).toContain('TRAVELLING');

    act(() => tree.unmount());
  });
});
