import React, {useCallback, useEffect, useState} from 'react';
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
  submitBODCheckIn,
  submitEODCheckOut,
  setHasBODToday,
  updateTaskStatus,
} from '@store/slices/technicianSlice';
import Geolocation from '@react-native-community/geolocation';
import {Task} from '@appTypes/technician.types';

type TechnicianHomeNavigationProp =
  StackNavigationProp<TechnicianStackParamList>;

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
  const {tasks, bodCheckIn, isLoading, error: tasksError} = useAppSelector(
    state => state.technician,
  );

  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(
    bodCheckIn?.checkInTime || null,
  );
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString(),
  );
  const [reasonModal, setReasonModal] = useState<{
    visible: boolean;
    taskId: string;
    targetStatus: string;
    label: string;
    reason: string;
  }>({visible: false, taskId: '', targetStatus: '', label: '', reason: ''});

  // Re-fetch jobs every time this screen comes into focus (e.g. after team lead assigns)
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchTasks());
    }, [dispatch]),
  );

  useEffect(() => {
    // Update clock every second
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    // Check network status
    const checkNetwork = setInterval(() => {
      setIsOnline(Math.random() > 0.1); // Simulate network check
    }, 30000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(checkNetwork);
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
    if (checkInTime) {
      Alert.alert(
        'Already Checked In',
        `You checked in at ${new Date(checkInTime).toLocaleTimeString()}`,
      );
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
                await dispatch(submitBODCheckIn({latitude, longitude, address}));
                dispatch(setHasBODToday(true));
                setCheckInTime(new Date().toISOString());
                setIsCheckingIn(false);
                dispatch(fetchTasks());
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
              onPress: () => {
                const now = new Date().toISOString();
                setCheckInTime(now);
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

  const handleEODCheckOut = async () => {
    if (!checkInTime) {
      Alert.alert('Error', 'You have not checked in today');
      return;
    }

    const checkIn = new Date(checkInTime);
    const now = new Date();
    const diffMs = now.getTime() - checkIn.getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);

    Alert.alert(
      'EOD Check-Out',
      `Working time: ${hours}h ${minutes}m\nCompleted: ${completedJobs}/${totalJobs} jobs\n\nConfirm check-out?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Check Out 🌆',
          style: 'destructive',
          onPress: async () => {
            setIsCheckingOut(true);
            Geolocation.getCurrentPosition(
              async position => {
                const {latitude, longitude} = position.coords;
                const address = await getAddressFromCoords(
                  latitude,
                  longitude,
                );
                await dispatch(
                  submitEODCheckOut({latitude, longitude, address}),
                );
                setCheckInTime(null);
                setIsCheckingOut(false);
                Alert.alert(
                  '✅ Checked Out',
                  `Total: ${hours}h ${minutes}m\nCompleted: ${completedJobs} jobs\nGood work today!`,
                );
              },
              error => {
                setIsCheckingOut(false);
                setCheckInTime(null);
                Alert.alert(
                  '✅ Checked Out',
                  `Total: ${hours}h ${minutes}m`,
                );
              },
              {enableHighAccuracy: true, timeout: 10000},
            );
          },
        },
      ],
    );
  };

  const handleSync = () => {
    setPendingSyncs(0);
    Alert.alert('Synced', 'All data synced successfully');
  };

  const handleQuickAction = (taskId: string, status: string) => {
    dispatch(updateTaskStatus({id: taskId, status}))
      .unwrap()
      .catch(err => Alert.alert('Error', err));
  };

  const openReasonModal = (taskId: string, targetStatus: string, label: string) => {
    setReasonModal({visible: true, taskId, targetStatus, label, reason: ''});
  };

  const submitWithReason = () => {
    if (!reasonModal.reason.trim()) {
      Alert.alert('Reason Required', 'Please enter a reason to continue.');
      return;
    }
    dispatch(updateTaskStatus({
      id: reasonModal.taskId,
      status: reasonModal.targetStatus,
      reason: reasonModal.reason.trim(),
    }))
      .unwrap()
      .catch(err => Alert.alert('Error', err));
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
            onPress={() => handleQuickAction(task.id, 'COMPLETED')}>
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
            onPress={() => handleQuickAction(task.id, 'COMPLETED')}>
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
      {!isOnline && (
        <TouchableOpacity
          style={styles.offlineBanner}
          onPress={handleSync}>
          <Text style={styles.offlineBannerText}>
            📵 Offline Mode
            {pendingSyncs > 0
              ? ` — ${pendingSyncs} pending syncs`
              : ' — Tap to sync when online'}
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
                    backgroundColor: isOnline
                      ? colors.success
                      : colors.error,
                  },
                ]}>
                <Text style={styles.onlineStatusText}>
                  {isOnline ? '🟢 Online' : '🔴 Offline'}
                </Text>
              </View>
            </View>
          </View>

          {/* BOD/EOD Check-in */}
          {!checkInTime ? (
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
            onPress={handleSync}>
            <Text style={styles.syncBannerText}>
              🔄 {pendingSyncs} items pending sync — Tap to sync
            </Text>
          </TouchableOpacity>
        )}

        {/* Job Cards */}
        <View style={styles.jobsSection}>
          <View style={styles.jobsSectionHeader}>
            <Text style={styles.jobsSectionTitle}>
              Today's Jobs ({sortedTasks.length})
            </Text>
            <TouchableOpacity
              onPress={() => dispatch(fetchTasks())}>
              <Text style={styles.refreshText}>🔄 Refresh</Text>
            </TouchableOpacity>
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
              {reasonModal.targetStatus === 'REJECTED'
                ? 'This job will be returned to your team lead with your reason.'
                : 'Job will be paused. You can resume it at any time.'}
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Enter reason..."
              placeholderTextColor={colors.textLight}
              multiline
              numberOfLines={4}
              value={reasonModal.reason}
              onChangeText={t => setReasonModal(m => ({...m, reason: t}))}
              autoFocus
            />
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