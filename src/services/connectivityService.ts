/**
 * Real device connectivity, backed by @react-native-community/netinfo
 * (Critical #25 / JOB-016).
 *
 * The technician HomeScreen previously held `isOnline` as local state
 * initialised to `true` and refreshed with `setIsOnline(Math.random() > 0.1)` —
 * a simulation, not a signal. Nothing in the app could tell it was offline.
 *
 * NetInfo is a real declared dependency (package.json). It is loaded through a
 * guarded require only so that the app/test process reports "unknown" instead
 * of crashing when the native module has not been linked yet — `null` is
 * deliberately NOT treated as "online", so nothing downstream can assume
 * connectivity it has not observed.
 */

type NetInfoState = {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
};

/** `true` online, `false` offline, `null` unknown (no connectivity source). */
export type Connectivity = boolean | null;

type Listener = (status: Connectivity) => void;

let NetInfo: any = null;
try {
  const mod = require('@react-native-community/netinfo');
  NetInfo = mod?.default ?? mod;
} catch {
  NetInfo = null;
}

export const isConnectivitySourceAvailable = (): boolean =>
  typeof NetInfo?.addEventListener === 'function';

const toStatus = (state: NetInfoState | null | undefined): Connectivity => {
  if (!state || state.isConnected == null) {
    return null;
  }
  // isInternetReachable is null while NetInfo is still probing — an attached
  // network with an unresolved probe still counts as connected.
  return state.isConnected === true && state.isInternetReachable !== false;
};

/**
 * Subscribe to connectivity changes. Emits the current status immediately.
 * Returns an unsubscribe function.
 */
export const subscribeToConnectivity = (listener: Listener): (() => void) => {
  if (!isConnectivitySourceAvailable()) {
    listener(null);
    return () => undefined;
  }

  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) =>
    listener(toStatus(state)),
  );

  if (typeof NetInfo.fetch === 'function') {
    NetInfo.fetch()
      .then((state: NetInfoState) => listener(toStatus(state)))
      .catch(() => listener(null));
  }

  return typeof unsubscribe === 'function' ? unsubscribe : () => undefined;
};

export default {
  isConnectivitySourceAvailable,
  subscribeToConnectivity,
};
