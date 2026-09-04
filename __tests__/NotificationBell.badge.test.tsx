/**
 * NOTIF-010 (08_NOTIFICATIONS) — logged as "genuinely never-written, no substitute exists anywhere"
 * in the 2026-09-02 completeness recount. Investigated before writing: the row's cited component
 * (`NotificationBadge`) and Redux-driven API (`dispatch(markAllRead())`, a `userId` prop) do not
 * exist — but the REAL, already-built component covering the exact same behavior is
 * `src/components/common/NotificationBell.tsx`, confirmed by direct read: it derives an
 * `unreadCount` from AsyncStorage-persisted notifications, renders a real badge (capped at "9+"),
 * and `markAllAsRead()` (fired on tap) genuinely clears it — not a Redux action, an AsyncStorage
 * read/write, but the same real behavior the row describes. Not a product gap; the feature exists
 * and works, it just never had a test written against its real name/API.
 *
 * Renders the REAL component with react-test-renderer (RTL for RN is not installed, the established
 * substitution throughout this project). AsyncStorage is the official jest mock
 * (`jest.setup.js`, applies globally) — pre-populated directly, not stubbed by hand.
 */
import React from 'react';
import {TouchableOpacity, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

import NotificationBell from '@components/common/NotificationBell';

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

const notif = (id: string, isRead: boolean) => ({
  id,
  title: `Notification ${id}`,
  body: 'Body',
  type: 'STATUS_UPDATE',
  timestamp: new Date().toISOString(),
  isRead,
});

const renderBell = async () => {
  let tree: any;
  await act(async () => {
    tree = renderer.create(<NotificationBell />);
  });
  return tree;
};

const pressBell = async (tree: any) => {
  const bell = tree.root.findAllByType(TouchableOpacity)[0];
  await act(async () => {
    await bell.props.onPress();
  });
};

describe('NotificationBell — NOTIF-010 badge count and mark-all-read', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('badge reflects the real unread count from persisted notifications', async () => {
    await AsyncStorage.setItem(
      'notifications',
      JSON.stringify([
        notif('1', false), notif('2', false), notif('3', false),
        notif('4', false), notif('5', false), notif('6', false), notif('7', false),
      ]),
    );

    const tree = await renderBell();
    const texts = tree.root.findAllByType(Text).map(textOf);
    expect(texts).toContain('7');
  });

  test('badge clears (disappears) after tapping the bell, which marks all read', async () => {
    await AsyncStorage.setItem(
      'notifications',
      JSON.stringify([notif('1', false), notif('2', false)]),
    );

    const tree = await renderBell();
    expect(tree.root.findAllByType(Text).map(textOf)).toContain('2');

    await pressBell(tree);

    const textsAfter = tree.root.findAllByType(Text).map(textOf);
    expect(textsAfter).not.toContain('2');
    expect(textsAfter).not.toContain('1');

    // The clear must actually persist, not just update local state.
    const stored = JSON.parse((await AsyncStorage.getItem('notifications')) || '[]');
    expect(stored.every((n: any) => n.isRead === true)).toBe(true);
  });

  test('a count above 9 is capped at "9+", not a raw number — no crash', async () => {
    await AsyncStorage.setItem(
      'notifications',
      JSON.stringify(Array.from({length: 12}, (_, i) => notif(String(i), false))),
    );

    const tree = await renderBell();
    const texts = tree.root.findAllByType(Text).map(textOf);
    expect(texts).toContain('9+');
    expect(texts).not.toContain('12');
  });

  test('zero unread notifications renders with no badge at all', async () => {
    await AsyncStorage.setItem('notifications', JSON.stringify([notif('1', true)]));

    const tree = await renderBell();
    const texts = tree.root.findAllByType(Text).map(textOf);
    expect(texts).not.toContain('1');
  });
});
