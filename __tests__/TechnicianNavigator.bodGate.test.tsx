/**
 * Regression coverage for QA_Compliance_Consolidated_Report Critical Issue #10 —
 * "Technician app has no BOD gate — job list fully interactive with zero
 * check-in enforcement", Mobile (Technician) layer.
 *
 * Fix under test: TechnicianNavigator.tsx now sets initialRouteName="BODGate"
 * and its first screen is the inline TechnicianBODGateScreen, which on mount
 * dispatches fetchTodayAttendance().unwrap() and:
 *   - currentStatus === 'NOT_CHECKED_IN'  -> navigation.replace('BOD')
 *   - currentStatus 'CHECKED_IN'/'CHECKED_OUT' -> navigation.replace('TechnicianTabs')
 *   - fetch rejected / any error          -> navigation.replace('BOD')  (fail-closed)
 *
 * This exercises the REAL inline gate component (it is not exported, so we render
 * the real <TechnicianNavigator/> and let the stack mount its initial route).
 * The stack navigator is mocked to render only the child whose `name` equals the
 * navigator's `initialRouteName` prop — so if the production initialRouteName were
 * anything other than "BODGate", the gate effect would never run and mockReplace
 * would never be called, failing these tests. That makes this an implicit check of
 * the initialRouteName fix in addition to the gate's routing logic.
 *
 * Tooling: react-test-renderer only (no @testing-library/react-native installed),
 * matching the established convention in this module's other __tests__.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';

const mockReplace = jest.fn();

// dispatch(fetchTodayAttendance()).unwrap() -> unwrapImpl(). Set per test.
let unwrapImpl: () => Promise<any>;
const mockDispatch = jest.fn(() => ({unwrap: () => unwrapImpl()}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({replace: mockReplace}),
}));

// Stack.Navigator renders ONLY the child screen matching its initialRouteName.
// This is where the fix's initialRouteName="BODGate" is implicitly asserted.
jest.mock('@react-navigation/stack', () => {
  const ReactLib = require('react');
  return {
    createStackNavigator: () => ({
      Navigator: ({initialRouteName, children}: any) => {
        const arr = ReactLib.Children.toArray(children);
        const initial =
          arr.find((c: any) => c.props.name === initialRouteName) || arr[0];
        return ReactLib.createElement(initial.props.component);
      },
      Screen: () => null,
    }),
  };
});

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: () => null,
    Screen: () => null,
  }),
}));

jest.mock('@store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (sel: any) => sel({}),
}));

jest.mock('@store/slices/technicianSlice', () => ({
  fetchTodayAttendance: jest.fn(() => ({type: 'technician/fetchTodayAttendance'})),
}));

// Leaf screens are only referenced as `component` props (never rendered here,
// since the mocked Navigator only mounts the initial "BODGate" route). Mock them
// so their import-time side effects (axios/config/maps) don't load.
jest.mock('@screens/technician/HomeScreen', () => () => null);
jest.mock('@screens/technician/TaskListScreen', () => () => null);
jest.mock('@screens/technician/TaskDetailScreen', () => () => null);
jest.mock('@screens/technician/NavigationScreen', () => () => null);
jest.mock('@screens/technician/JobsMapScreen', () => () => null);
jest.mock('@screens/technician/ResourceManagementScreen', () => () => null);
jest.mock('@screens/technician/KPITargetsScreen', () => () => null);
jest.mock('@screens/technician/ProfileScreen', () => () => null);
jest.mock('@screens/technician/TechEditProfileScreen', () => () => null);
jest.mock('@screens/technician/TechNotificationSettingsScreen', () => () => null);
jest.mock('@screens/technician/TechLanguageSettingsScreen', () => () => null);
jest.mock('@screens/technician/UpdateStatusScreen', () => () => null);
jest.mock('@screens/technician/MaterialsScreen', () => () => null);
jest.mock('@screens/technician/SignatureScreen', () => () => null);
jest.mock('@screens/technician/BODScreen', () => () => null);

import TechnicianNavigator from '@navigation/TechnicianNavigator';

const renderGate = async (impl: () => Promise<any>) => {
  unwrapImpl = impl;
  let tree: any;
  await act(async () => {
    tree = renderer.create(<TechnicianNavigator />);
  });
  // Flush the .then/.catch microtasks off the unwrap() promise.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return tree;
};

describe('Technician BOD gate — Critical Issue #10 access-control enforcement', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockDispatch.mockClear();
  });

  test('NOT_CHECKED_IN -> routes to BOD (job list stays unreachable)', async () => {
    const tree = await renderGate(() =>
      Promise.resolve({currentStatus: 'NOT_CHECKED_IN'}),
    );
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('BOD');
    // Must NOT let the user into the tabs (job list) before checking in.
    expect(mockReplace).not.toHaveBeenCalledWith('TechnicianTabs');
    act(() => tree.unmount());
  });

  test('CHECKED_IN -> routes to TechnicianTabs (dashboard/job list)', async () => {
    const tree = await renderGate(() =>
      Promise.resolve({currentStatus: 'CHECKED_IN'}),
    );
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('TechnicianTabs');
    act(() => tree.unmount());
  });

  test('CHECKED_OUT -> routes to TechnicianTabs (already did BOD today)', async () => {
    const tree = await renderGate(() =>
      Promise.resolve({currentStatus: 'CHECKED_OUT'}),
    );
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('TechnicianTabs');
    act(() => tree.unmount());
  });

  test('fetch rejected -> fail-closed to BOD (no bypass into tabs on error)', async () => {
    const tree = await renderGate(() => Promise.reject(new Error('network')));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('BOD');
    expect(mockReplace).not.toHaveBeenCalledWith('TechnicianTabs');
    act(() => tree.unmount());
  });
});
