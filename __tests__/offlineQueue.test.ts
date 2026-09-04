/**
 * JOB-016 (03_JOB_LIFECYCLE, FR-7) — accepting a job while offline must be queued locally and
 * replayed when connectivity returns, then the queue cleared.
 *
 * WHAT THIS TEST FOUND: there is no offline capability in this app at all.
 *   - `@react-native-community/netinfo` is not a dependency (package.json), so the app cannot
 *     detect that it is offline. TechnicianHomeScreen's `isOnline` flag is local component state
 *     that is initialised to `true` and never driven by any real connectivity source, and its
 *     `pendingSyncs` counter is only ever reset by the "Sync" button (`handleSync` sets it to 0 and
 *     shows "All data synced successfully" without syncing anything).
 *   - There is no SQLite dependency and no persisted queue module of any kind.
 *   - `technicianSlice.updateTaskStatus` does a bare `api.patch(...)` and, on failure,
 *     `rejectWithValue(error.message)`. The action is dropped; nothing retains it for replay. A
 *     technician who accepts a job in a basement loses the acceptance.
 *
 * Because the module the row names does not exist, this cannot be written as an ordinary
 * import-and-call test — a static import of a queue module would fail at transform time, which is
 * a test that never runs rather than a test that fails. It instead resolves the offline
 * infrastructure dynamically so it EXECUTES and returns a real verdict: it fails today, naming
 * exactly what is missing, and will pass unchanged once the queue exists. It deliberately does not
 * assert the absence of the feature, which would lock the gap in as correct behaviour.
 *
 * PRODUCTION CHANGE REQUIRED: a connectivity source (@react-native-community/netinfo), a persisted
 * offline action queue (src/services/offlineQueue), and a sync trigger that replays queued status
 * updates and clears the queue on success. Out of scope for this suite (test code only).
 */

const OFFLINE_QUEUE_MODULES = [
  '@services/offlineQueue',
  '@services/offlineQueueService',
  '@store/slices/offlineQueueSlice',
];

const CONNECTIVITY_MODULES = ['@react-native-community/netinfo'];

const resolves = (moduleName: string): boolean => {
  try {
    require.resolve(moduleName);
    return true;
  } catch {
    return false;
  }
};

/** The queue module, whichever name it ends up shipping under. */
const loadOfflineQueue = (): any | null => {
  for (const name of OFFLINE_QUEUE_MODULES) {
    if (!resolves(name)) continue;
    try {
      const mod = require(name);
      return mod?.default ?? mod;
    } catch {
      return null;
    }
  }
  return null;
};

describe('JOB-016 — offline job accept is queued and synced on reconnect', () => {
  test('acceptJobOffline_queuesAndSyncs', () => {
    const connectivity = CONNECTIVITY_MODULES.filter(resolves);
    const queue = loadOfflineQueue();

    const failures: string[] = [];
    const check = (ok: boolean, message: string) => {
      if (!ok) failures.push(message);
    };

    // ── Step 1: the app must be able to know it is offline ──────────────────────────────
    check(
      connectivity.length > 0,
      'JOB-016 step 1 mocks NetInfo as offline. No connectivity library is installed '
        + `(looked for: ${CONNECTIVITY_MODULES.join(', ')}). TechnicianHomeScreen's isOnline flag `
        + 'is local state initialised to true and never driven by real connectivity, so the app '
        + 'cannot detect being offline in the first place. PRODUCTION CHANGE REQUIRED.',
    );

    // ── Steps 2-3: the accept must land in a persisted queue ────────────────────────────
    check(
      queue != null,
      'JOB-016 steps 2-3 require the offline accept to be stored in a local queue. No offline '
        + `queue module exists (looked for: ${OFFLINE_QUEUE_MODULES.join(', ')}), and there is no `
        + 'SQLite dependency. technicianSlice.updateTaskStatus calls api.patch directly and, on '
        + 'network failure, only rejectWithValue(error.message) — the action is dropped and the '
        + 'technician\'s acceptance is lost. PRODUCTION CHANGE REQUIRED.',
    );

    // ── Steps 4-7: reconnect must replay the queue and then clear it ────────────────────
    const api = queue ?? {};
    check(
      typeof api.enqueue === 'function' || typeof api.add === 'function',
      'The offline queue must expose a way to enqueue a pending action (enqueue/add). '
        + 'PRODUCTION CHANGE REQUIRED.',
    );
    check(
      typeof api.triggerSync === 'function' || typeof api.sync === 'function',
      'JOB-016 step 5 calls triggerSync(). No such trigger exists — HomeScreen.handleSync only '
        + 'sets pendingSyncs to 0 and shows "All data synced successfully" without replaying '
        + 'anything, which reports success for work that never happened. PRODUCTION CHANGE '
        + 'REQUIRED.',
    );
    check(
      typeof api.clear === 'function' || typeof api.getPending === 'function',
      'JOB-016 step 7 asserts the queue is cleared after a successful sync, so the queue must be '
        + 'inspectable/clearable. PRODUCTION CHANGE REQUIRED.',
    );

    expect(failures).toEqual([]);
  });
});
