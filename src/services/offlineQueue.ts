/**
 * Offline action queue (Critical #25 / JOB-016, FR-7).
 *
 * Before this existed, a mutation made without connectivity was simply dropped:
 * `technicianSlice.updateTaskStatus` did a bare `api.patch` and, on failure,
 * only `rejectWithValue(...)` — a technician who accepted a job in a basement
 * lost the acceptance outright, while `HomeScreen.handleSync` told them "All
 * data synced successfully".
 *
 * This module holds those mutations on the device (AsyncStorage, so they
 * survive the app being closed) and replays them against the real API. The
 * central rule: `triggerSync()` reports what actually happened — an entry is
 * only removed from the queue once the server has genuinely accepted it, and
 * callers can only claim success from a `SyncResult` that says so.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@services/api';

const STORAGE_KEY = '@slt/offlineQueue/v1';

export type QueuedMethod = 'post' | 'patch' | 'put';

export interface QueuedAction {
  /** Local id — unique per queued action, not a server id. */
  id: string;
  createdAt: string;
  method: QueuedMethod;
  url: string;
  body?: any;
  /** Human-readable description used in sync result messages. */
  label: string;
}

export interface SyncResult {
  /** How many queued actions this run tried to send. */
  attempted: number;
  /** How many the server genuinely accepted. */
  synced: number;
  /** How many did not go through (still offline, or server rejected them). */
  failed: number;
  /** How many are still queued after this run. */
  remaining: number;
  /** One message per failure, for surfacing to the user. */
  errors: string[];
}

type Listener = (pendingCount: number) => void;

const listeners = new Set<Listener>();

const notify = (count: number) => {
  listeners.forEach(listener => {
    try {
      listener(count);
    } catch {
      // A misbehaving subscriber must not abort the queue operation.
    }
  });
};

const read = async (): Promise<QueuedAction[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedAction[]) : [];
  } catch {
    // Unreadable/corrupt queue — report empty rather than crashing the caller.
    return [];
  }
};

const write = async (actions: QueuedAction[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  notify(actions.length);
};

/** Every action still waiting to be sent, oldest first. */
export const getPending = async (): Promise<QueuedAction[]> => read();

export const getPendingCount = async (): Promise<number> =>
  (await read()).length;

/**
 * Persist a mutation that could not reach the server. Returns the stored entry
 * so the caller can reference it; throws if it could not be persisted, because
 * an enqueue that silently didn't happen is the same lost-work bug this module
 * exists to prevent.
 */
export const enqueue = async (
  action: Omit<QueuedAction, 'id' | 'createdAt'>,
): Promise<QueuedAction> => {
  const entry: QueuedAction = {
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
  };
  const actions = await read();
  actions.push(entry);
  await write(actions);
  return entry;
};

/** Alias — some callers/tests refer to the enqueue operation as `add`. */
export const add = enqueue;

export const remove = async (id: string): Promise<void> => {
  const actions = await read();
  await write(actions.filter(a => a.id !== id));
};

export const clear = async (): Promise<void> => {
  await write([]);
};

/**
 * Replay every queued action against the real API, oldest first.
 *
 * - Accepted by the server -> removed from the queue, counted as synced.
 * - No response at all (still offline / timed out) -> kept in the queue and the
 *   run stops, since the rest will fail the same way.
 * - Rejected by the server with a response (4xx/5xx) -> removed, because
 *   replaying it again would fail identically forever, and reported in
 *   `errors` so the failure is visible instead of silent.
 */
export const triggerSync = async (): Promise<SyncResult> => {
  const actions = await read();
  const result: SyncResult = {
    attempted: 0,
    synced: 0,
    failed: 0,
    remaining: actions.length,
    errors: [],
  };

  if (actions.length === 0) {
    return result;
  }

  const survivors: QueuedAction[] = [];
  let connectivityLost = false;

  for (const action of actions) {
    if (connectivityLost) {
      survivors.push(action);
      continue;
    }
    result.attempted += 1;
    try {
      await api[action.method](action.url, action.body);
      result.synced += 1;
    } catch (error: any) {
      result.failed += 1;
      if (!error?.response) {
        connectivityLost = true;
        survivors.push(action);
        result.errors.push(`${action.label}: no connection`);
      } else {
        result.errors.push(
          `${action.label}: ${
            error.response?.data?.message || error.message || 'rejected'
          }`,
        );
      }
    }
  }

  await write(survivors);
  result.remaining = survivors.length;
  return result;
};

/** Alias — some callers/tests refer to the replay operation as `sync`. */
export const sync = triggerSync;

/** Notifies on every queue-size change so UI counters stay truthful. */
export const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  read().then(actions => listener(actions.length)).catch(() => undefined);
  return () => {
    listeners.delete(listener);
  };
};

export default {
  getPending,
  getPendingCount,
  enqueue,
  add,
  remove,
  clear,
  triggerSync,
  sync,
  subscribe,
};
