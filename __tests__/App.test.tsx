/**
 * @format
 */

import 'react-native';
import React from 'react';
import App from '../App';

// Note: import explicitly to use the types shipped with jest.
import {it} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer, {act} from 'react-test-renderer';

it('renders correctly', async () => {
  let tree: any;
  await act(async () => {
    tree = renderer.create(<App />);
  });
  // App.tsx's notification-permission/token requests are fire-and-forget
  // promises kicked off on mount; without this they resolve after the test
  // returns and print "Cannot log after tests are done" (Jest mocks in
  // jest.setup.js resolve on the microtask queue, not a real network delay).
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  act(() => tree.unmount());
});
