import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TechnicianStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {
  fetchTasks,
  fetchTodayAttendance,
  submitBODCheckIn,
  submitEODCheckOut,
  setHasBODToday,
  updateTaskStatus,
  QUEUED_OFFLINE,
} from '@store/slices/technicianSlice';
import Geolocation from '@react-native-community/geolocation';
import {Task, MaterialRequestSummary} from '@appTypes/technician.types';
import technicianService from '@services/technicianService';
import offlineQueue from '@services/offlineQueue';
import {subscribeToConnectivity} from '@services/connectivityService';
import {
  RejectionCategory,
  ObservedIssueType,
  REJECTION_CATEGORIES,
  OBSERVED_ISSUE_TYPES,
} from '../../constants/rejectionCategories';

type TechnicianHomeNavigationProp =
  StackNavigationProp<TechnicianStackParamList>;

// SRS 5.3.1.4 — EOD Pending-Task Handover. Matches the backend's
// AttendanceService.OPEN_JOB_STATUSES exactly (same 4 statuses the old
// bulk-return query used) — a job in any other status is either already
// closed out (completed/cancelled) or already rejected, neither of which
// needs an EOD handover reason.
const OPEN_TASK_STATUSES = ['pending', 'accepted', 'in_progress', 'hold'];

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'HIGH': return colors.error;
    case 'MEDIUM': return colors.warning;
    case 'LOW': return colors.success;
    default: return colors.secondary;
  }
};

const getPriorityIcon = (priority?: string) => {
  switch (priority) {
    case 'HIGH': return '🔴';
    case 'MEDIUM': return '🟡';
    case 'LOW': return '🟢';
    default: return '⚪';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return colors.warning;
    case 'assigned': return colors.info;
    case 'accepted': return colors.secondary;
    case 'travelling': return colors.warning;
    case 'in_progress': return colors.accent;
    case 'hold': return colors.warning;
    case 'completed': return colors.success;
    case 'rejected': return colors.error;
    case 'cancelled': return colors.textSecondary;
    default: return colors.textSecondary;
  }
};

const getCategoryIcon = (category?: string) => {
  switch (category?.toLowerCase()) {
    case 'broadband': return '🌐';
    case 'fiber': return '🔌';
    case 'telephone': return '📞';
    case 'television': return '📺';
    default: return '🔧';
  }
};

const TechnicianHomeScreen = () => {
  const navigation = useNavigation<TechnicianHomeNavigationProp>();
  const dispatch = useAppDispatch();
  const {user} = useAppSelector(state => state.auth);
  const {tasks, bodCheckIn, todayAttendance, isLoading, error: tasksError} =
    useAppSelector(state => state.technician);

  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(
    bodCheckIn?.checkInTime || null,
  );
  // ATT-008 — daily mileage. Required client-side before BOD/EOD completes,
  // same gating pattern as requestLocationPermission below (Alert + return).
  const [odometerStartInput, setOdometerStartInput] = useState('');
  const [odometerEndInput, setOdometerEndInput] = useState('');

  // Calendar-date-scoped BOD/EOD status, sourced from the backend (not a
  // local flag) — this is what can't be bypassed by an EOD resetting local
  // state, since the server only reports CHECKED_IN/CHECKED_OUT for today.
  const todayStatus = todayAttendance?.currentStatus ?? 'NOT_CHECKED_IN';
  const hasCheckedInToday = todayStatus !== 'NOT_CHECKED_IN';
  const hasCheckedOutToday = todayStatus === 'CHECKED_OUT';
  // Real connectivity (Critical #25): `null` means no connectivity source has
  // reported yet — deliberately not the same as "online", so nothing here
  // assumes a connection it hasn't observed.
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  // Real count of mutations held on-device, driven by the offline queue itself
  // rather than a counter the UI is free to reset.
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString(),
  );
  const [reasonModal, setReasonModal] = useState<{
    visible: boolean;
    taskId: string;
    targetStatus: string;
    label: string;
    reason: string;
    // SRS 5.3.1.2 — only used/shown when targetStatus is 'REJECTED'.
    category: RejectionCategory | null;
    observedIssueType: ObservedIssueType | null;
    linkedMaterialRequestId: number | null;
  }>({
    visible: false,
    taskId: '',
    targetStatus: '',
    label: '',
    reason: '',
    category: null,
    observedIssueType: null,
    linkedMaterialRequestId: null,
  });
  const [outstandingRequests, setOutstandingRequests] = useState<MaterialRequestSummary[]>([]);
  const [loadingOutstandingRequests, setLoadingOutstandingRequests] = useState(false);

  // SRS 5.3.1.4 — EOD Pending-Task Handover modal state: one reason per
  // still-open job, keyed by task id.
  const [eodHandoverModal, setEodHandoverModal] = useState<{
    visible: boolean;
    reasons: Record<string, string>;
  }>({visible: false, reasons: {}});
  // Duration is computed once in handleEODCheckOut and reused by
  // performCheckOut whichever path (native Alert or handover modal) confirms.
  const pendingCheckOutDuration = useRef<{hours: number; minutes: number}>({
    hours: 0,
    minutes: 0,
  });

  // Re-fetch jobs and today's BOD/EOD status every time this screen comes into
  // focus (e.g. after team lead assigns, or after the device clock rolls to a
  // new calendar day) so the gate below always reflects the server's truth.
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchTasks());
      dispatch(fetchTodayAttendance());
    }, [dispatch]),
  );

  useEffect(() => {
    if (todayStatus === 'CHECKED_IN' && todayAttendance?.checkInTime) {
      setCheckInTime(todayAttendance.checkInTime);
    } else if (todayStatus !== 'CHECKED_IN') {
      setCheckInTime(null);
    }
  }, [todayStatus, todayAttendance?.checkInTime]);

  useEffect(() => {
    // Update clock every second
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    // Real connectivity, from NetInfo — replaces a `Math.random()` simulation
    // that meant the app could never actually tell it was offline.
    const unsubscribeConnectivity = subscribeToConnectivity(setIsOnline);
    // Real pending-sync count, from the persisted offline queue.
    const unsubscribeQueue = offlineQueue.subscribe(setPendingSyncs);

    return () => {
      clearInterval(clockInterval);
      unsubscribeConnectivity();
      unsubscribeQueue();
    };
  }, []);

  // Sort tasks by priority and scheduled time
  const sortedTasks = [...tasks].sort((a, b) => {
    const priorityOrder = {HIGH: 0, MEDIUM: 1, LOW: 2};
    const aPriority =
      priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3;
    const bPriority =
      priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return (
      new Date(a.scheduledDate).getTime() -
      new Date(b.scheduledDate).getTime()
    );
  });

  const completedJobs = tasks.filter(
    t => t.status === 'completed',
  ).length;
  const totalJobs = tasks.length;
  const remainingJobs = totalJobs - completedJobs;
  const inProgressJobs = tasks.filter(
    t => t.status === 'in_progress',
  ).length;
  const completionRate =
    totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

  const avgCompletionTime = 2.3; // Mock data

  const allJobsCompleted =
    totalJobs > 0 && completedJobs === totalJobs;

  // SRS 5.3.1.4 — jobs still open at EOD, each needing its own mandatory
  // handover reason (not one blanket reason for all of them).
  const openTasks = tasks.filter(t => OPEN_TASK_STATUSES.includes(t.status));

  const requestLocationPermission = async (): Promise<boolean> => {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'SLT App needs location access for check-in',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const getAddressFromCoords = async (
    lat: number,
    lng: number,
  ): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        {headers: {'User-Agent': 'SLTMobileApp/1.0'}},
      );
      const data = await response.json();
      return (
        data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      );
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  };

  const handleBODCheckIn = async () => {
    if (hasCheckedOutToday) {
      Alert.alert(
        'Day Already Completed',
        'You have already completed BOD and EOD for today. Check back tomorrow.',
      );
      return;
    }
    if (hasCheckedInToday) {
      Alert.alert(
        'Already Checked In',
        checkInTime
          ? `You checked in at ${new Date(checkInTime).toLocaleTimeString()}`
          : 'You have already checked in today.',
      );
      return;
    }

    const odometerStart = parseInt(odometerStartInput, 10);
    if (!odometerStartInput.trim() || Number.isNaN(odometerStart)) {
      Alert.alert('Odometer Required', 'Please enter your starting odometer reading before checking in.');
      return;
    }

    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert('Error', 'Location permission required for check-in');
      return;
    }

    setIsCheckingIn(true);
    Geolocation.getCurrentPosition(
      async position => {
        const {latitude, longitude} = position.coords;
        const address = await getAddressFromCoords(
          latitude,
          longitude,
        );

        Alert.alert(
          'BOD Check-In',
          `Location: ${address.substring(0, 100)}\nTime: ${new Date().toLocaleTimeString()}`,
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Check In ✅',
              onPress: async () => {
                try {
                  await dispatch(
                    submitBODCheckIn({latitude, longitude, address, odometerStart}),
                  ).unwrap();
                } catch (err: any) {
                  // Don't claim success on a rejected check-in — mirrors the
                  // performCheckOut guard below (Critical #16/#19).
                  setIsCheckingIn(false);
                  Alert.alert(
                    'Check-In Failed',
                    typeof err === 'string' ? err : 'Please try again.',
                  );
                  return;
                }
                dispatch(setHasBODToday(true));
                setCheckInTime(new Date().toISOString());
                setIsCheckingIn(false);
                dispatch(fetchTasks());
                dispatch(fetchTodayAttendance());
                Alert.alert(
                  '✅ Checked In Successfully',
                  `Time: ${new Date().toLocaleTimeString()}\nHave a great day!`,
                );
              },
            },
          ],
        );
        setIsCheckingIn(false);
      },
      error => {
        setIsCheckingIn(false);
        // Fallback check-in without location
        Alert.alert(
          'Location Unavailable',
          'Check in without location?',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Check In Anyway',
              onPress: async () => {
                // This path must hit the backend like the GPS-success branch
                // above — alerting "Checked In" without dispatching would
                // leave the technician not checked in server-side.
                setIsCheckingIn(true);
                try {
                  await dispatch(
                    submitBODCheckIn({
                      // null, not (0,0) — a fake coordinate would be
                      // indistinguishable from a real check-in at 0°N 0°E.
                      // AttendanceDTO.CheckInRequest accepts null for exactly
                      // this case (same rule as BODScreen's fallback).
                      latitude: null,
                      longitude: null,
                      address: 'Location unavailable',
                      odometerStart,
                    }),
                  ).unwrap();
                } catch (err: any) {
                  setIsCheckingIn(false);
                  Alert.alert(
                    'Check-In Failed',
                    typeof err === 'string' ? err : 'Please try again.',
                  );
                  return;
                }
                dispatch(setHasBODToday(true));
                setCheckInTime(new Date().toISOString());
                setIsCheckingIn(false);
                dispatch(fetchTasks());
                dispatch(fetchTodayAttendance());
                Alert.alert(
                  '✅ Checked In',
                  'Location unavailable — checked in without GPS',
                );
              },
            },
          ],
        );
      },
      {enableHighAccuracy: true, timeout: 15000},
    );
  };

  // Fetches location, dispatches the actual checkout, and shows the result —
  // shared by both the "no open jobs" native-Alert path and the "open jobs,
  // reasons collected" modal path below.
  const performCheckOut = (
    hours: number,
    minutes: number,
    openJobReasons?: {jobId: string; reason: string}[],
  ) => {
    // Validated non-empty/numeric by handleEODCheckOut before either caller
    // (the plain confirm below, or the EOD handover modal) ever reaches here.
    const odometerEnd = parseInt(odometerEndInput, 10);
    setIsCheckingOut(true);
    Geolocation.getCurrentPosition(
      async position => {
        const {latitude, longitude} = position.coords;
        const address = await getAddressFromCoords(latitude, longitude);
        let result: any;
        try {
          result = await dispatch(
            submitEODCheckOut({latitude, longitude, address, openJobReasons, odometerEnd}),
          ).unwrap();
        } catch (err: any) {
          // Don't claim success on a rejected checkout (e.g. the backend's
          // own mandatory-reason check failing a race) — that would be
          // exactly the "fake success on a real failure" pattern flagged as
          // Critical #16 elsewhere in this app.
          setIsCheckingOut(false);
          Alert.alert('Check-Out Failed', typeof err === 'string' ? err : 'Please try again.');
          return;
        }
        setCheckInTime(null);
        setIsCheckingOut(false);
        dispatch(fetchTodayAttendance());
        // Mileage only exists when both readings exist — real, computed by
        // the backend (AttendanceService.mapToResponse), never guessed here.
        const mileageLine =
          result?.distanceKm != null ? `\nMileage: ${result.distanceKm} km` : '';
        Alert.alert(
          '✅ Checked Out',
          `Total: ${hours}h ${minutes}m\nCompleted: ${completedJobs} jobs\nGood work today!${mileageLine}`,
        );
      },
      async error => {
        // This path must hit the backend like the GPS-success branch above —
        // alerting "Checked Out" without dispatching left the technician still
        // checked in server-side while being told otherwise (Critical #29).
        let result: any;
        try {
          result = await dispatch(
            submitEODCheckOut({
              // null, not (0,0) — a fake coordinate would be indistinguishable
              // from a real check-out at 0°N 0°E. AttendanceDTO.CheckOutRequest
              // accepts null for exactly this case (same rule as check-in).
              latitude: null,
              longitude: null,
              address: 'Location unavailable',
              openJobReasons,
              odometerEnd,
            }),
          ).unwrap();
        } catch (err: any) {
          setIsCheckingOut(false);
          Alert.alert('Check-Out Failed', typeof err === 'string' ? err : 'Please try again.');
          return;
        }
        setCheckInTime(null);
        setIsCheckingOut(false);
        dispatch(fetchTodayAttendance());
        const mileageLine =
          result?.distanceKm != null ? `\nMileage: ${result.distanceKm} km` : '';
        Alert.alert('✅ Checked Out', `Total: ${hours}h ${minutes}m${mileageLine}`);
      },
      {enableHighAccuracy: true, timeout: 10000},
    );
  };

  const handleEODCheckOut = async () => {
    if (hasCheckedOutToday) {
      Alert.alert('Error', 'You have already checked out today.');
      return;
    }
    if (!checkInTime) {
      Alert.alert('Error', 'You have not checked in today');
      return;
    }
    if (!odometerEndInput.trim() || Number.isNaN(parseInt(odometerEndInput, 10))) {
      Alert.alert('Odometer Required', 'Please enter your ending odometer reading before checking out.');
      return;
    }

    const checkIn = new Date(checkInTime);
    const now = new Date();
    const diffMs = now.getTime() - checkIn.getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);

    // SRS 5.3.1.4 — jobs still open need a mandatory per-job reason before
    // check-out can proceed, collected via a dedicated modal rather than the
    // plain native confirm below (which can't hold multiple text inputs).
    if (openTasks.length > 0) {
      setEodHandoverModal({
        visible: true,
        reasons: Object.fromEntries(openTasks.map(t => [t.id, ''])),
      });
      // Stash the duration for performCheckOut once the modal is confirmed.
      pendingCheckOutDuration.current = {hours, minutes};
      return;
    }

    Alert.alert(
      'EOD Check-Out',
      `Working time: ${hours}h ${minutes}m\nCompleted: ${completedJobs}/${totalJobs} jobs\n\nConfirm check-out?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Check Out 🌆',
          style: 'destructive',
          onPress: () => performCheckOut(hours, minutes),
        },
      ],
    );
  };

  const submitEodHandoverAndCheckOut = () => {
    const missing = openTasks.filter(t => !eodHandoverModal.reasons[t.id]?.trim());
    if (missing.length > 0) {
      Alert.alert(
        'Reason Required',
        `Please explain why each open job wasn't completed. Missing: ${missing
          .map(t => t.jobNumber || `#${t.id}`)
          .join(', ')}`,
      );
      return;
    }
    const openJobReasons = openTasks.map(t => ({
      jobId: t.id,
      reason: eodHandoverModal.reasons[t.id].trim(),
    }));
    setEodHandoverModal({visible: false, reasons: {}});
    const {hours, minutes} = pendingCheckOutDuration.current;
    performCheckOut(hours, minutes, openJobReasons);
  };

  // Critical #25 — this used to set pendingSyncs to 0 and alert "All data
  // synced successfully" without sending anything. Every branch below now
  // reports what actually happened, and the success branch is only reachable
  // after the queue has genuinely been drained by the server.
  const handleSync = async () => {
    if (isSyncing) {
      return;
    }
    const pending = await offlineQueue.getPending();
    setPendingSyncs(pending.length);

    if (pending.length === 0) {
      Alert.alert(
        'Nothing to Sync',
        'There are no pending changes saved on this device.',
      );
      return;
    }
    if (isOnline === false) {
      Alert.alert(
        'Cannot Sync While Offline',
        `${pending.length} pending change(s) are saved on this device and will be sent once you are back online.`,
      );
      return;
    }

    setIsSyncing(true);
    const result = await offlineQueue.triggerSync();
    setIsSyncing(false);
    setPendingSyncs(result.remaining);

    if (result.synced > 0) {
      // Pull the server's own view back in, so the screen reflects what was
      // actually accepted rather than the local optimistic guess.
      dispatch(fetchTasks());
    }

    if (result.synced > 0 && result.failed === 0 && result.remaining === 0) {
      Alert.alert(
        'Synced',
        `${result.synced} pending change(s) synced successfully`,
      );
      return;
    }

    Alert.alert(
      'Sync Incomplete',
      [
        `${result.synced} of ${result.attempted} change(s) synced.`,
        result.remaining > 0
          ? `${result.remaining} still pending on this device.`
          : null,
        ...result.errors,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  };

  // A status update that couldn't reach the server is now held in the offline
  // queue rather than dropped (Critical #25). Say which of the two happened —
  // "saved, will send" is a materially different outcome from "failed".
  const reportUpdateFailure = (err: any) => {
    const message = typeof err === 'string' ? err : 'Please try again.';
    const prefix = `${QUEUED_OFFLINE}:`;
    if (QUEUED_OFFLINE && message.startsWith(prefix)) {
      Alert.alert('Saved On This Device', message.slice(prefix.length).trim());
      return;
    }
    Alert.alert('Error', message);
  };

  const handleQuickAction = (taskId: string, status: string) => {
    dispatch(updateTaskStatus({id: taskId, status}))
      .unwrap()
      .catch(reportUpdateFailure);
  };

  const openReasonModal = (taskId: string, targetStatus: string, label: string) => {
    setReasonModal({
      visible: true,
      taskId,
      targetStatus,
      label,
      reason: '',
      category: null,
      observedIssueType: null,
      linkedMaterialRequestId: null,
    });
    setOutstandingRequests([]);
  };

  // Only REJECTED goes through the SRS 5.3.1.2 categorization step — HOLD
  // keeps its existing single-field flow unchanged.
  const isRejectFlow = reasonModal.targetStatus === 'REJECTED';

  const selectRejectionCategory = async (category: RejectionCategory) => {
    setReasonModal(m => ({...m, category, observedIssueType: null, linkedMaterialRequestId: null}));
    if (category === 'MATERIAL_DELAY') {
      setLoadingOutstandingRequests(true);
      try {
        const all = await technicianService.getMyOutstandingMaterialRequests();
        setOutstandingRequests(all.filter(r => r.taskId === reasonModal.taskId));
      } catch {
        setOutstandingRequests([]);
      } finally {
        setLoadingOutstandingRequests(false);
      }
    }
  };

  const submitWithReason = () => {
    if (isRejectFlow && !reasonModal.category) {
      Alert.alert('Category Required', 'Please select why this job is being rejected.');
      return;
    }
    if (isRejectFlow && reasonModal.category === 'ISSUE_MISMATCH' && !reasonModal.observedIssueType) {
      Alert.alert('Issue Type Required', 'Please select the issue type you actually observed on-site.');
      return;
    }
    if (!reasonModal.reason.trim()) {
      Alert.alert('Reason Required', 'Please enter a reason to continue.');
      return;
    }
    dispatch(updateTaskStatus({
      id: reasonModal.taskId,
      status: reasonModal.targetStatus,
      reason: reasonModal.reason.trim(),
      ...(isRejectFlow && reasonModal.category
        ? {rejectionCategory: reasonModal.category}
        : {}),
      ...(isRejectFlow && reasonModal.observedIssueType
        ? {observedIssueType: reasonModal.observedIssueType}
        : {}),
      ...(isRejectFlow && reasonModal.linkedMaterialRequestId != null
        ? {linkedMaterialRequestId: reasonModal.linkedMaterialRequestId}
        : {}),
    }))
      .unwrap()
      .catch(reportUpdateFailure);
    setReasonModal(m => ({...m, visible: false}));
  };

  const renderJobActions = (task: Task) => {
    const s = task.status;
    if (s === 'completed' || s === 'cancelled') return null;

    const rejectBtn = s !== 'rejected' && (
      <TouchableOpacity
        style={styles.rejectButton}
        onPress={() => openReasonModal(task.id, 'REJECTED', 'Reject Job')}>
        <Text style={styles.rejectButtonText}>❌ Reject</Text>
      </TouchableOpacity>
    );

    if (s === 'pending' || s === 'assigned') {
      return (
        <View style={styles.jobActions}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleQuickAction(task.id, 'ACCEPTED')}>
            <Text style={styles.acceptButtonText}>✅ Accept</Text>
          </TouchableOpacity>
          {rejectBtn}
        </View>
      );
    }

    if (s === 'accepted') {
      return (
        <View style={styles.jobActions}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => handleQuickAction(task.id, 'IN_PROGRESS')}>
            <Text style={styles.startButtonText}>🔧 Start Work</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.holdButton}
            onPress={() => openReasonModal(task.id, 'HOLD', 'Put on Hold')}>
            <Text style={styles.holdButtonText}>⏸ Hold</Text>
          </TouchableOpacity>
          {rejectBtn}
        </View>
      );
    }

    if (s === 'in_progress') {
      return (
        <View style={styles.jobActions}>
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() =>
              // Completing a job requires after-photos + a real signature
              // (FR-9) — that flow lives in TaskDetailScreen, not here, so
              // route there instead of completing directly from this card.
              navigation.navigate('TaskDetail', {taskId: task.id})
            }>
            <Text style={styles.completeButtonText}>✅ Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.holdButton}
            onPress={() => openReasonModal(task.id, 'HOLD', 'Put on Hold')}>
            <Text style={styles.holdButtonText}>⏸ Hold</Text>
          </TouchableOpacity>
          {rejectBtn}
        </View>
      );
    }

    if (s === 'hold') {
      return (
        <View style={styles.jobActions}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => handleQuickAction(task.id, 'IN_PROGRESS')}>
            <Text style={styles.startButtonText}>▶️ Resume</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() =>
              // Completing a job requires after-photos + a real signature
              // (FR-9) — that flow lives in TaskDetailScreen, not here, so
              // route there instead of completing directly from this card.
              navigation.navigate('TaskDetail', {taskId: task.id})
            }>
            <Text style={styles.completeButtonText}>✅ Complete</Text>
          </TouchableOpacity>
          {rejectBtn}
        </View>
      );
    }

    if (s === 'rejected') {
      return (
        <View style={styles.rejectedBanner}>
          <Text style={styles.rejectedBannerText}>
            ❌ Rejected{task.rejectionReason ? ` — ${task.rejectionReason}` : ''}
          </Text>
        </View>
      );
    }

    return null;
  };

  const renderJobCard = (task: Task) => (
    <View
      key={task.id}
      style={[
        styles.jobCard,
        {borderLeftColor: getPriorityColor(task.priority)},
        task.status === 'completed' && styles.jobCardCompleted,
      ]}>
      {/* Job Header */}
      <View style={styles.jobHeader}>
        <View style={styles.jobHeaderLeft}>
          <Text style={styles.priorityIcon}>
            {getPriorityIcon(task.priority)}
          </Text>
          <Text style={styles.categoryIcon}>
            {getCategoryIcon(task.category)}
          </Text>
          <View>
            <Text style={styles.jobId}>#{task.id}</Text>
            <Text style={styles.jobTime}>
              🕐 {task.scheduledDate}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.jobStatusBadge,
            {
              backgroundColor:
                getStatusColor(task.status) + '20',
            },
          ]}>
          <Text
            style={[
              styles.jobStatusText,
              {color: getStatusColor(task.status)},
            ]}>
            {task.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Customer Info */}
      <Text style={styles.customerName}>
        👤 {task.customerName || 'Customer'}
      </Text>
      <Text style={styles.jobAddress} numberOfLines={1}>
        📍 {task.location?.address}
      </Text>
      {task.category && (
        <Text style={styles.jobCategory}>
          🔧 {task.category} • Est. {task.estimatedDuration}h
        </Text>
      )}

      {/* Priority Badge */}
      {task.priority && (
        <View
          style={[
            styles.priorityBadge,
            {
              backgroundColor:
                getPriorityColor(task.priority) + '15',
              borderColor: getPriorityColor(task.priority),
            },
          ]}>
          <Text
            style={[
              styles.priorityBadgeText,
              {color: getPriorityColor(task.priority)},
            ]}>
            {task.priority} PRIORITY
          </Text>
        </View>
      )}

      {/* Navigate + Detail row */}
      <View style={styles.jobActionsTop}>
        <TouchableOpacity
          style={styles.navigateButton}
          onPress={() =>
            navigation.navigate('Navigation', {taskId: task.id})
          }>
          <Text style={styles.navigateButtonText}>🗺️ Navigate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.detailButton}
          onPress={() =>
            navigation.navigate('TaskDetail', {taskId: task.id})
          }>
          <Text style={styles.detailButtonText}>📋 Details</Text>
        </TouchableOpacity>
      </View>

      {/* Status-contextual action buttons */}
      {renderJobActions(task)}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Offline Banner */}
      {isOnline === false && (
        <TouchableOpacity
          style={styles.offlineBanner}
          onPress={handleSync}>
          <Text style={styles.offlineBannerText}>
            📵 Offline Mode
            {pendingSyncs > 0
              ? ` — ${pendingSyncs} change(s) saved on this device`
              : ' — changes will be saved until you reconnect'}
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => dispatch(fetchTasks())}
          />
        }>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>
                {new Date().getHours() < 12
                  ? '🌅 Good Morning'
                  : new Date().getHours() < 17
                  ? '☀️ Good Afternoon'
                  : '🌆 Good Evening'}
              </Text>
              <Text style={styles.technicianName}>
                {user?.name || 'Technician'}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.currentTime}>{currentTime}</Text>
              {/* Online Status */}
              <View
                style={[
                  styles.onlineStatus,
                  {
                    // Three real states — "unknown" is not painted green, so
                    // the pill can no longer claim a connection the app has
                    // not actually observed (Critical #25).
                    backgroundColor:
                      isOnline === true
                        ? colors.success
                        : isOnline === false
                        ? colors.error
                        : colors.textSecondary,
                  },
                ]}>
                <Text style={styles.onlineStatusText}>
                  {isOnline === true
                    ? '🟢 Online'
                    : isOnline === false
                    ? '🔴 Offline'
                    : '⚪ Checking…'}
                </Text>
              </View>
            </View>
          </View>

          {/* BOD/EOD Check-in */}
          {hasCheckedOutToday ? (
            <View style={styles.checkedInCard}>
              <View style={styles.checkedInInfo}>
                <Text style={styles.checkedInText}>
                  ✅ Day Completed
                </Text>
                <Text style={styles.checkedInTime}>
                  BOD/EOD already done for today
                </Text>
              </View>
            </View>
          ) : !checkInTime ? (
            <View>
              <TextInput
                style={styles.odometerInput}
                placeholder="Starting odometer reading (km)"
                placeholderTextColor={colors.textLight}
                keyboardType="number-pad"
                value={odometerStartInput}
                onChangeText={setOdometerStartInput}
              />
              <TouchableOpacity
                style={styles.bodButton}
                onPress={handleBODCheckIn}
                disabled={isCheckingIn}>
                {isCheckingIn ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Text style={styles.bodButtonIcon}>🌅</Text>
                    <View>
                      <Text style={styles.bodButtonTitle}>
                        BOD Check-In
                      </Text>
                      <Text style={styles.bodButtonSubtitle}>
                        Tap to start your day
                      </Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.checkedInCard}>
              <View style={styles.checkedInInfo}>
                <Text style={styles.checkedInText}>
                  ✅ Checked In
                </Text>
                <Text style={styles.checkedInTime}>
                  at{' '}
                  {new Date(checkInTime).toLocaleTimeString()}
                </Text>
                <TextInput
                  style={styles.odometerInput}
                  placeholder="Ending odometer reading (km)"
                  placeholderTextColor={colors.textLight}
                  keyboardType="number-pad"
                  value={odometerEndInput}
                  onChangeText={setOdometerEndInput}
                />
              </View>
              <TouchableOpacity
                style={styles.eodButton}
                onPress={handleEODCheckOut}
                disabled={isCheckingOut}>
                {isCheckingOut ? (
                  <ActivityIndicator
                    color={colors.white}
                    size="small"
                  />
                ) : (
                  <Text style={styles.eodButtonText}>
                    🌆 Checkout
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Jobs Progress Bar */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Today's Progress</Text>
            <Text style={styles.progressCount}>
              {completedJobs}/{totalJobs} Jobs
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${completionRate}%`,
                  backgroundColor:
                    completionRate === 100
                      ? colors.success
                      : colors.primary,
                },
              ]}
            />
          </View>
          <View style={styles.progressStats}>
            <Text style={styles.progressStat}>
              ✅ {completedJobs} Done
            </Text>
            <Text style={styles.progressStat}>
              🔧 {inProgressJobs} Active
            </Text>
            <Text style={styles.progressStat}>
              ⏳ {remainingJobs - inProgressJobs} Remaining
            </Text>
          </View>
        </View>

        {/* Personal KPI Widget */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiTitle}>📊 My Performance Today</Text>
          <View style={styles.kpiGrid}>
            <View
              style={[
                styles.kpiItem,
                {backgroundColor: colors.primary},
              ]}>
              <Text style={styles.kpiValue}>{completedJobs}</Text>
              <Text style={styles.kpiLabel}>Completed</Text>
            </View>
            <View
              style={[
                styles.kpiItem,
                {backgroundColor: colors.warning},
              ]}>
              <Text style={styles.kpiValue}>{inProgressJobs}</Text>
              <Text style={styles.kpiLabel}>In Progress</Text>
            </View>
            <View
              style={[
                styles.kpiItem,
                {backgroundColor: colors.success},
              ]}>
              <Text style={styles.kpiValue}>
                {avgCompletionTime}h
              </Text>
              <Text style={styles.kpiLabel}>Avg Time</Text>
            </View>
            <View
              style={[
                styles.kpiItem,
                {backgroundColor: colors.secondary},
              ]}>
              <Text style={styles.kpiValue}>
                {completionRate.toFixed(0)}%
              </Text>
              <Text style={styles.kpiLabel}>Rate</Text>
            </View>
          </View>
        </View>

        {/* Sync Status */}
        {pendingSyncs > 0 && (
          <TouchableOpacity
            style={styles.syncBanner}
            onPress={handleSync}
            disabled={isSyncing}>
            <Text style={styles.syncBannerText}>
              {isSyncing
                ? `🔄 Syncing ${pendingSyncs} pending change(s)…`
                : `🔄 ${pendingSyncs} change(s) pending sync — Tap to sync`}
            </Text>
          </TouchableOpacity>
        )}

        {/* Job Cards */}
        <View style={styles.jobsSection}>
          <View style={styles.jobsSectionHeader}>
            <Text style={styles.jobsSectionTitle}>
              Today's Jobs ({sortedTasks.length})
            </Text>
            <View style={styles.jobsSectionHeaderActions}>
              <TouchableOpacity
                onPress={() => navigation.navigate('JobsMap')}>
                <Text style={styles.refreshText}>🗺️ Map View</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => dispatch(fetchTasks())}>
                <Text style={styles.refreshText}>🔄 Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{marginTop: 32}} />
          ) : tasksError ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>⚠️</Text>
              <Text style={styles.emptyText}>Could not load jobs</Text>
              <Text style={styles.emptySubText}>{tasksError}</Text>
              <TouchableOpacity onPress={() => dispatch(fetchTasks())} style={{marginTop: 12}}>
                <Text style={[styles.refreshText, {fontSize: 14}]}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : sortedTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No jobs assigned yet</Text>
              <Text style={styles.emptySubText}>
                Jobs assigned by your team lead will appear here.{'\n'}Pull down to refresh.
              </Text>
            </View>
          ) : (
            sortedTasks.map(renderJobCard)
          )}

          {/* EOD checkout button — always visible when checked in */}
          {checkInTime && (
            <TouchableOpacity
              style={[
                styles.eodBottomButton,
                {backgroundColor: allJobsCompleted ? colors.success : colors.warning},
              ]}
              onPress={handleEODCheckOut}
              disabled={isCheckingOut}>
              {isCheckingOut ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.eodBottomButtonIcon}>🌆</Text>
                  <View>
                    <Text style={styles.eodBottomButtonTitle}>
                      {allJobsCompleted ? 'All Jobs Done! Checkout' : 'End Shift & Checkout'}
                    </Text>
                    <Text style={styles.eodBottomButtonSubtitle}>
                      {allJobsCompleted
                        ? 'Great work today!'
                        : 'Open jobs will return to team lead'}
                    </Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Reason Modal — for Reject / Hold actions */}
      <Modal
        visible={reasonModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setReasonModal(m => ({...m, visible: false}))}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{reasonModal.label}</Text>
            <Text style={styles.modalSubtitle}>
              {isRejectFlow
                ? 'This job will be returned to your team lead with your reason.'
                : 'Job will be paused. You can resume it at any time.'}
            </Text>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {isRejectFlow && (
                <>
                  {/* Step 1 — SRS 5.3.1.2: categorize why, not just a free-text reject */}
                  <Text style={styles.modalSectionLabel}>Why is this being rejected?</Text>
                  <View style={styles.categoryRow}>
                    {REJECTION_CATEGORIES.map(c => (
                      <TouchableOpacity
                        key={c.value}
                        style={[
                          styles.categoryChip,
                          reasonModal.category === c.value && styles.categoryChipSelected,
                        ]}
                        onPress={() => selectRejectionCategory(c.value)}>
                        <Text style={styles.categoryChipIcon}>{c.icon}</Text>
                        <Text
                          style={[
                            styles.categoryChipText,
                            reasonModal.category === c.value && styles.categoryChipTextSelected,
                          ]}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Step 2a — Issue Mismatch: which issue type was actually observed */}
                  {reasonModal.category === 'ISSUE_MISMATCH' && (
                    <>
                      <Text style={styles.modalSectionLabel}>Observed issue type</Text>
                      <View style={styles.categoryRow}>
                        {OBSERVED_ISSUE_TYPES.map(t => (
                          <TouchableOpacity
                            key={t.value}
                            style={[
                              styles.categoryChip,
                              reasonModal.observedIssueType === t.value && styles.categoryChipSelected,
                            ]}
                            onPress={() =>
                              setReasonModal(m => ({...m, observedIssueType: t.value}))
                            }>
                            <Text style={styles.categoryChipIcon}>{t.icon}</Text>
                            <Text
                              style={[
                                styles.categoryChipText,
                                reasonModal.observedIssueType === t.value &&
                                  styles.categoryChipTextSelected,
                              ]}>
                              {t.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Step 2b — Material Delay: link an outstanding request if one exists */}
                  {reasonModal.category === 'MATERIAL_DELAY' && (
                    <>
                      <Text style={styles.modalSectionLabel}>Linked material request</Text>
                      {loadingOutstandingRequests ? (
                        <ActivityIndicator color={colors.primary} style={{marginVertical: spacing.sm}} />
                      ) : outstandingRequests.length === 0 ? (
                        <Text style={styles.noRequestsText}>
                          No outstanding material request found under your account for this job.
                          If your team lead submitted one on your behalf, describe it in the notes
                          below — you can still reject without a linked reference.
                        </Text>
                      ) : (
                        outstandingRequests.map(r => (
                          <TouchableOpacity
                            key={r.id}
                            style={[
                              styles.requestRow,
                              reasonModal.linkedMaterialRequestId === r.id && styles.requestRowSelected,
                            ]}
                            onPress={() =>
                              setReasonModal(m => ({...m, linkedMaterialRequestId: r.id}))
                            }>
                            <View
                              style={[
                                styles.radio,
                                reasonModal.linkedMaterialRequestId === r.id && styles.radioSelected,
                              ]}>
                              {reasonModal.linkedMaterialRequestId === r.id && (
                                <View style={styles.radioDot} />
                              )}
                            </View>
                            <View style={{flex: 1}}>
                              <Text style={styles.requestNumber}>{r.requestNumber}</Text>
                              <Text style={styles.requestMeta}>
                                {r.status} · {r.totalItems} item{r.totalItems === 1 ? '' : 's'}
                                {r.submittedTimeAgo ? ` · ${r.submittedTimeAgo}` : ''}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))
                      )}
                    </>
                  )}

                  {reasonModal.category && (
                    <Text style={styles.modalSectionLabel}>Details</Text>
                  )}
                </>
              )}

              <TextInput
                style={styles.reasonInput}
                placeholder="Enter reason..."
                placeholderTextColor={colors.textLight}
                multiline
                numberOfLines={4}
                value={reasonModal.reason}
                onChangeText={t => setReasonModal(m => ({...m, reason: t}))}
                autoFocus={!isRejectFlow}
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setReasonModal(m => ({...m, visible: false}))}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  {backgroundColor: reasonModal.targetStatus === 'REJECTED' ? colors.error : colors.warning},
                ]}
                onPress={submitWithReason}>
                <Text style={styles.modalConfirmText}>
                  {reasonModal.targetStatus === 'REJECTED' ? '❌ Confirm Reject' : '⏸ Confirm Hold'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* EOD Pending-Task Handover Modal (SRS 5.3.1.4) — one mandatory reason
          per job still open at checkout, not one blanket reason for all. */}
      <Modal
        visible={eodHandoverModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setEodHandoverModal({visible: false, reasons: {}})}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Before You Check Out</Text>
            <Text style={styles.modalSubtitle}>
              {openTasks.length} job{openTasks.length === 1 ? '' : 's'} still open — explain why
              each wasn't completed. These move to your team lead's pending tasks.
            </Text>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {openTasks.map(t => (
                <View key={t.id} style={styles.handoverJobBlock}>
                  <Text style={styles.modalSectionLabel}>
                    {t.jobNumber || `Job #${t.id}`}
                    {t.customerName ? ` — ${t.customerName}` : ''}
                  </Text>
                  <TextInput
                    style={styles.reasonInput}
                    placeholder="Why wasn't this completed?"
                    placeholderTextColor={colors.textLight}
                    multiline
                    numberOfLines={3}
                    value={eodHandoverModal.reasons[t.id] || ''}
                    onChangeText={text =>
                      setEodHandoverModal(m => ({
                        ...m,
                        reasons: {...m.reasons, [t.id]: text},
                      }))
                    }
                  />
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setEodHandoverModal({visible: false, reasons: {}})}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, {backgroundColor: colors.warning}]}
                onPress={submitEodHandoverAndCheckOut}>
                <Text style={styles.modalConfirmText}>🌆 Confirm Check-Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  offlineBanner: {
    backgroundColor: colors.error,
    padding: spacing.sm,
    alignItems: 'center',
  },
  offlineBannerText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  greeting: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
  },
  technicianName: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  currentTime: {
    fontSize: typography.md,
    color: colors.white,
    fontWeight: typography.medium,
    fontFamily: 'monospace',
  },
  onlineStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  onlineStatusText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  odometerInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sm,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  bodButton: {
    backgroundColor: colors.success,
    borderRadius: 10,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bodButtonIcon: {
    fontSize: 32,
  },
  bodButtonTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.white,
  },
  bodButtonSubtitle: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
  },
  checkedInCard: {
    backgroundColor: colors.success + '30',
    borderRadius: 10,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.success,
  },
  checkedInInfo: {},
  checkedInText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.white,
  },
  checkedInTime: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
  },
  eodButton: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  eodButtonText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  progressCard: {
    backgroundColor: colors.white,
    margin: spacing.md,
    borderRadius: 10,
    padding: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  progressCount: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  progressBar: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStat: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  kpiCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 10,
    padding: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  kpiTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kpiItem: {
    flex: 1,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  kpiLabel: {
    fontSize: 9,
    color: colors.white,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 2,
  },
  syncBanner: {
    backgroundColor: colors.warning + '20',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning,
    alignItems: 'center',
  },
  syncBannerText: {
    color: colors.warning,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  jobsSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  jobsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  jobsSectionHeaderActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  jobsSectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  refreshText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  jobCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    padding: spacing.md,
  },
  jobCardCompleted: {
    opacity: 0.7,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  jobHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  priorityIcon: {
    fontSize: 16,
  },
  categoryIcon: {
    fontSize: 20,
  },
  jobId: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  jobTime: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  jobStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  jobStatusText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  customerName: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  jobAddress: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  jobCategory: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  priorityBadgeText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  jobActionsTop: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  jobActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  navigateButton: {
    flex: 1,
    backgroundColor: colors.secondary,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
  },
  navigateButtonText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  detailButton: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailButtonText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.success,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  startButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
  },
  startButtonText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  completeButton: {
    flex: 1,
    backgroundColor: colors.success,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
  },
  completeButtonText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  holdButton: {
    flex: 1,
    backgroundColor: colors.warning,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
  },
  holdButtonText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: colors.error,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  rejectedBanner: {
    backgroundColor: colors.error + '15',
    borderRadius: 6,
    padding: spacing.sm,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  rejectedBannerText: {
    color: colors.error,
    fontSize: typography.xs,
    fontWeight: typography.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modalScroll: {
    maxHeight: 420,
  },
  modalSectionLabel: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  handoverJobBlock: {
    marginBottom: spacing.md,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  categoryChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  categoryChipIcon: {
    fontSize: 16,
  },
  categoryChipText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  categoryChipTextSelected: {
    color: colors.primary,
    fontWeight: typography.bold,
  },
  noRequestsText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginBottom: spacing.xs,
  },
  requestRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  requestNumber: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  requestMeta: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.md,
    color: colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontSize: typography.md,
    fontWeight: typography.medium,
  },
  modalConfirmButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    backgroundColor: colors.white,
    borderRadius: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.lg,
    fontWeight: typography.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  emptySubText: {
    fontSize: typography.md,
    color: colors.textLight,
  },
  eodBottomButton: {
    backgroundColor: colors.warning,
    borderRadius: 10,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  eodBottomButtonIcon: {
    fontSize: 32,
  },
  eodBottomButtonTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.white,
  },
  eodBottomButtonSubtitle: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
  },
});

export default TechnicianHomeScreen;