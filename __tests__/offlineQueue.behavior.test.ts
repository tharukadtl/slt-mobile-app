/**
 * Critical #25 / JOB-016 — behaviour of the offline queue itself.
 *
 * offlineQueue.test.ts checks that the offline infrastructure EXISTS (it can
 * only assert method names, since it resolves the module dynamically). This
 * suite exercises the real module against a mocked API and the AsyncStorage
 * jest mock, so the queue has to actually persist, actually replay, and
 * actually report what happened — not merely expose the right function names.
 *
 * It also covers the slice half: `technicianSlice.updateTaskStatus` used to drop
 * a status update outright when the request never reached the server, which is
 * how a technician's job acceptance was lost in a basement.
 */
jest.mock('@services/api', () => ({
  __esModule: true,
  default: {get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn()},
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@services/api';
import offlineQueue, {
  enqueue,
  getPending,
  triggerSync,
  clear,
} from '@services/offlineQueue';
import {updateTaskStatus} from '@store/slices/technicianSlice';

const apiMock = api as unknown as {patch: jest.Mock};

/** An axios error that never reached the server (offline) has no `response`. */
const networkError = () => Object.assign(new Error('Network Error'), {});
/** A server that answered and refused has one. */
const serverError = (message: string) =>
  Object.assign(new Error('Request failed'), {
    response: {status: 400, data: {message}},
  });

const dispatchThunk = async (thunk: any) => {
  const dispatch = jest.fn();
  return thunk(dispatch, () => ({}), undefined);
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await clear();
  apiMock.patch.mockReset();
});

describe('offlineQueue — persistence and replay', () => {
  test('enqueue persists across a fresh read of storage', async () => {
    await enqueue({
      method: 'patch',
      url: '/api/jobs/7/status',
      body: {status: 'ACCEPTED'},
      label: 'Job 7 → ACCEPTED',
    });

    // Read back through AsyncStorage, not through in-memory state — an
    // in-memory-only queue would die with the app process.
    const raw = await AsyncStorage.getItem('@slt/offlineQueue/v1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toHaveLength(1);
    expect(JSON.parse(raw as string)[0].url).toBe('/api/jobs/7/status');
  });

  test('an empty queue reports zero work — it cannot report a success', async () => {
    const result = await triggerSync();
    expect(result).toEqual({
      attempted: 0,
      synced: 0,
      failed: 0,
      remaining: 0,
      errors: [],
    });
    expect(apiMock.patch).not.toHaveBeenCalled();
  });

  test('successful replay sends the queued request and clears the queue', async () => {
    await enqueue({
      method: 'patch',
      url: '/api/jobs/7/status',
      body: {status: 'ACCEPTED'},
      label: 'Job 7 → ACCEPTED',
    });
    apiMock.patch.mockResolvedValue({data: {id: 7, status: 'ACCEPTED'}});

    const result = await triggerSync();

    expect(apiMock.patch).toHaveBeenCalledWith('/api/jobs/7/status', {
      status: 'ACCEPTED',
    });
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.remaining).toBe(0);
    expect(await getPending()).toHaveLength(0);
  });

  test('still offline — the work is kept, not dropped, and not reported synced', async () => {
    await enqueue({
      method: 'patch',
      url: '/api/jobs/7/status',
      body: {status: 'ACCEPTED'},
      label: 'Job 7 → ACCEPTED',
    });
    apiMock.patch.mockRejectedValue(networkError());

    const result = await triggerSync();

    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.remaining).toBe(1);
    expect(await getPending()).toHaveLength(1);
  });

  test('server refuses the replay — the failure is surfaced, not swallowed', async () => {
    await enqueue({
      method: 'patch',
      url: '/api/jobs/7/status',
      body: {status: 'ACCEPTED'},
      label: 'Job 7 → ACCEPTED',
    });
    apiMock.patch.mockRejectedValue(serverError('Job already completed'));

    const result = await triggerSync();

    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors.join('\n')).toContain('Job already completed');
    // Removed, because replaying a 400 would fail identically forever — but
    // only after the reason was reported.
    expect(result.remaining).toBe(0);
  });

  test('subscribers see the real pending count', async () => {
    const seen: number[] = [];
    const unsubscribe = offlineQueue.subscribe(count => seen.push(count));
    await enqueue({
      method: 'patch',
      url: '/api/jobs/9/status',
      body: {status: 'HOLD'},
      label: 'Job 9 → HOLD',
    });
    unsubscribe();
    expect(seen).toContain(1);
  });
});

describe('technicianSlice.updateTaskStatus — no longer drops offline updates', () => {
  test('a request that never reached the server is queued for replay', async () => {
    apiMock.patch.mockRejectedValue(networkError());

    const action = await dispatchThunk(
      updateTaskStatus({id: '7', status: 'ACCEPTED'}),
    );

    // Still a rejection — the update has NOT been applied server-side, and the
    // caller must not be told otherwise.
    expect(action.type).toBe('technician/updateTaskStatus/rejected');
    expect(action.payload).toContain('QUEUED_OFFLINE');

    // ...but the work survived, which is the whole point of the fix.
    const pending = await getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].url).toBe('/api/jobs/7/status');
    expect(pending[0].body).toEqual({status: 'ACCEPTED'});
  });

  test('a genuine server rejection fails loudly and is NOT queued', async () => {
    apiMock.patch.mockRejectedValue(serverError('Invalid status transition'));

    const action = await dispatchThunk(
      updateTaskStatus({id: '7', status: 'COMPLETED'}),
    );

    expect(action.type).toBe('technician/updateTaskStatus/rejected');
    expect(action.payload).toBe('Invalid status transition');
    expect(await getPending()).toHaveLength(0);
  });
});
