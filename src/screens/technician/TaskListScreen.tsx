import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TechnicianStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {
  fetchTasks,
  updateTaskStatus,
} from '@store/slices/technicianSlice';
import {Task} from '@appTypes/technician.types';

type TaskListNavigationProp =
  StackNavigationProp<TechnicianStackParamList>;

const STATUS_FILTERS = [
  {label: 'All', value: 'ALL'},
  {label: 'Assigned', value: 'assigned'},
  {label: 'Accepted', value: 'accepted'},
  {label: 'Travelling', value: 'travelling'},
  {label: 'In Progress', value: 'in_progress'},
  {label: 'Completed', value: 'completed'},
];

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
    case 'assigned': return colors.info;
    case 'accepted': return colors.secondary;
    case 'travelling': return colors.warning;
    case 'in_progress': return colors.accent;
    case 'completed': return colors.success;
    default: return colors.textSecondary;
  }
};

const getNextStatus = (currentStatus: string) => {
  switch (currentStatus) {
    case 'assigned': return 'accepted';
    case 'accepted': return 'travelling';
    case 'travelling': return 'in_progress';
    case 'in_progress': return 'completed';
    default: return null;
  }
};

const getNextStatusLabel = (currentStatus: string) => {
  switch (currentStatus) {
    case 'assigned': return '✅ Accept Job';
    case 'accepted': return '🚗 Start Travelling';
    case 'travelling': return '🔧 Start Work';
    case 'in_progress': return '✅ Complete Job';
    default: return null;
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

const TechnicianTaskListScreen = () => {
  const navigation = useNavigation<TaskListNavigationProp>();
  const dispatch = useAppDispatch();
  const {tasks, isLoading} = useAppSelector(
    state => state.technician,
  );

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchText, setSearchText] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState('');
  const [showAckModal, setShowAckModal] = useState(false);

  useEffect(() => {
    dispatch(fetchTasks());
  }, []);

  const filteredTasks = tasks
    .filter(task => {
      const matchesStatus =
        statusFilter === 'ALL' || task.status === statusFilter;
      const matchesSearch =
        searchText === '' ||
        task.id.includes(searchText) ||
        task.customerName
          ?.toLowerCase()
          .includes(searchText.toLowerCase()) ||
        task.location?.address
          ?.toLowerCase()
          .includes(searchText.toLowerCase());
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      const priorityOrder = {HIGH: 0, MEDIUM: 1, LOW: 2};
      const aPriority =
        priorityOrder[
          a.priority as keyof typeof priorityOrder
        ] ?? 3;
      const bPriority =
        priorityOrder[
          b.priority as keyof typeof priorityOrder
        ] ?? 3;
      return aPriority - bPriority;
    });

  const handleAcceptJob = (task: Task) => {
    setSelectedTask(task);
    setShowAckModal(true);
  };

  const handleConfirmAccept = async () => {
    if (!selectedTask) return;
    setShowAckModal(false);
    const result = await dispatch(
      updateTaskStatus({
        id: selectedTask.id,
        status: 'accepted',
      }),
    );
    if (updateTaskStatus.fulfilled.match(result)) {
      Alert.alert(
        '✅ Job Accepted',
        `Task #${selectedTask.id} accepted. Navigate to customer location.`,
        [
          {
            text: 'Navigate Now',
            onPress: () =>
              navigation.navigate('Navigation', {
                taskId: selectedTask.id,
              }),
          },
          {text: 'Later', style: 'cancel'},
        ],
      );
    }
  };

  const handleRejectJob = (task: Task) => {
    setSelectedTask(task);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedTask || !rejectReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for rejection');
      return;
    }
    setShowRejectModal(false);
    Alert.alert(
      'Job Rejected',
      `Task #${selectedTask.id} has been rejected. Reason: ${rejectReason}`,
    );
  };

  const handleUpdateStatus = async (task: Task) => {
    const nextStatus = getNextStatus(task.status);
    if (!nextStatus) return;

    const statusLabel = getNextStatusLabel(task.status);
    Alert.alert(
      'Update Status',
      `Change Task #${task.id} to "${nextStatus.replace('_', ' ')}"?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: statusLabel || 'Update',
          onPress: async () => {
            if (nextStatus === 'completed') {
              navigation.navigate('UpdateStatus', {taskId: task.id});
            } else {
              const result = await dispatch(
                updateTaskStatus({id: task.id, status: nextStatus}),
              );
              if (updateTaskStatus.fulfilled.match(result)) {
                Alert.alert(
                  'Status Updated ✅',
                  `Task #${task.id} is now "${nextStatus.replace('_', ' ')}"`,
                );
                if (nextStatus === 'travelling') {
                  Alert.alert(
                    'Navigate?',
                    'Open navigation to job location?',
                    [
                      {
                        text: 'Navigate',
                        onPress: () =>
                          navigation.navigate('Navigation', {
                            taskId: task.id,
                          }),
                      },
                      {text: 'Skip', style: 'cancel'},
                    ],
                  );
                }
              }
            }
          },
        },
      ],
    );
  };

  const REJECT_REASONS = [
    'Unable to reach location',
    'Outside service area',
    'Emergency situation',
    'Equipment unavailable',
    'Customer not available',
    'Other',
  ];

  const renderTaskCard = ({item}: {item: Task}) => {
    const nextStatusLabel = getNextStatusLabel(item.status);
    const isCompleted = item.status === 'completed';

    return (
      <View
        style={[
          styles.taskCard,
          {borderLeftColor: getPriorityColor(item.priority)},
          isCompleted && styles.taskCardCompleted,
        ]}>
        {/* Header */}
        <View style={styles.taskHeader}>
          <View style={styles.taskHeaderLeft}>
            <Text style={styles.priorityIcon}>
              {getPriorityIcon(item.priority)}
            </Text>
            <Text style={styles.categoryIcon}>
              {getCategoryIcon(item.category)}
            </Text>
            <View>
              <Text style={styles.taskId}>Task #{item.id}</Text>
              <Text style={styles.taskDate}>
                📅 {item.scheduledDate}
              </Text>
            </View>
          </View>
          <View style={styles.taskHeaderRight}>
            {item.priority && (
              <View
                style={[
                  styles.priorityBadge,
                  {
                    backgroundColor:
                      getPriorityColor(item.priority) + '20',
                    borderColor: getPriorityColor(item.priority),
                  },
                ]}>
                <Text
                  style={[
                    styles.priorityBadgeText,
                    {color: getPriorityColor(item.priority)},
                  ]}>
                  {item.priority}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    getStatusColor(item.status) + '20',
                },
              ]}>
              <Text
                style={[
                  styles.statusText,
                  {color: getStatusColor(item.status)},
                ]}>
                {item.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer Info */}
        <Text style={styles.customerName}>
          👤 {item.customerName || 'Customer'}
        </Text>
        <Text style={styles.taskAddress} numberOfLines={1}>
          📍 {item.location?.address}
        </Text>
        {item.category && (
          <Text style={styles.taskCategory}>
            {getCategoryIcon(item.category)} {item.category} • Est.{' '}
            {item.estimatedDuration}h
          </Text>
        )}

        {/* Status Flow Indicator */}
        <View style={styles.statusFlow}>
          {[
            'assigned',
            'accepted',
            'travelling',
            'in_progress',
            'completed',
          ].map((status, index) => (
            <React.Fragment key={status}>
              <View
                style={[
                  styles.statusFlowDot,
                  {
                    backgroundColor:
                      [
                        'assigned',
                        'accepted',
                        'travelling',
                        'in_progress',
                        'completed',
                      ].indexOf(item.status) >= index
                        ? getStatusColor(status)
                        : colors.border,
                  },
                ]}
              />
              {index < 4 && (
                <View
                  style={[
                    styles.statusFlowLine,
                    {
                      backgroundColor:
                        [
                          'assigned',
                          'accepted',
                          'travelling',
                          'in_progress',
                          'completed',
                        ].indexOf(item.status) > index
                          ? getStatusColor(status)
                          : colors.border,
                    },
                  ]}
                />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {/* Navigate Button */}
          <TouchableOpacity
            style={styles.navigateButton}
            onPress={() =>
              navigation.navigate('Navigation', {
                taskId: item.id,
              })
            }>
            <Text style={styles.navigateButtonText}>
              🗺️ Navigate
            </Text>
          </TouchableOpacity>

          {/* Accept/Reject for assigned jobs */}
          {item.status === 'assigned' && (
            <>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleAcceptJob(item)}>
                <Text style={styles.acceptButtonText}>
                  ✅ Accept
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => handleRejectJob(item)}>
                <Text style={styles.rejectButtonText}>❌</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Update Status for other statuses */}
          {item.status !== 'assigned' &&
            item.status !== 'completed' && (
              <TouchableOpacity
                style={styles.updateButton}
                onPress={() => handleUpdateStatus(item)}>
                <Text style={styles.updateButtonText}>
                  {nextStatusLabel}
                </Text>
              </TouchableOpacity>
            )}

          {/* Details Button */}
          <TouchableOpacity
            style={styles.detailButton}
            onPress={() =>
              navigation.navigate('TaskDetail', {
                taskId: item.id,
              })
            }>
            <Text style={styles.detailButtonText}>📋</Text>
          </TouchableOpacity>
        </View>

        {/* Completed Badge */}
        {isCompleted && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeText}>
              ✅ Job Completed
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Jobs</Text>
        <Text style={styles.headerSubtitle}>
          {filteredTasks.length} of {tasks.length} jobs
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by ID, customer, address..."
            placeholderTextColor={colors.textLight}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText !== '' && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}>
        {STATUS_FILTERS.map(filter => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterChip,
              statusFilter === filter.value &&
                styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter(filter.value)}>
            <Text
              style={[
                styles.filterChipText,
                statusFilter === filter.value &&
                  styles.filterChipTextActive,
              ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={item => item.id}
        renderItem={renderTaskCard}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => dispatch(fetchTasks())}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No jobs found</Text>
            <Text style={styles.emptySubText}>
              Pull down to refresh
            </Text>
          </View>
        }
      />

      {/* Accept/Acknowledge Modal */}
      <Modal
        visible={showAckModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAckModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Accept Job #{selectedTask?.id}
              </Text>
              <TouchableOpacity
                onPress={() => setShowAckModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {/* Job Details */}
              <View style={styles.ackJobInfo}>
                <Text style={styles.ackLabel}>Customer</Text>
                <Text style={styles.ackValue}>
                  {selectedTask?.customerName || 'N/A'}
                </Text>
              </View>
              <View style={styles.ackJobInfo}>
                <Text style={styles.ackLabel}>Location</Text>
                <Text style={styles.ackValue} numberOfLines={2}>
                  {selectedTask?.location?.address || 'N/A'}
                </Text>
              </View>
              <View style={styles.ackJobInfo}>
                <Text style={styles.ackLabel}>Category</Text>
                <Text style={styles.ackValue}>
                  {selectedTask?.category || 'N/A'}
                </Text>
              </View>
              <View style={styles.ackJobInfo}>
                <Text style={styles.ackLabel}>Scheduled</Text>
                <Text style={styles.ackValue}>
                  {selectedTask?.scheduledDate || 'N/A'}
                </Text>
              </View>
              <View style={styles.ackJobInfo}>
                <Text style={styles.ackLabel}>Est. Duration</Text>
                <Text style={styles.ackValue}>
                  {selectedTask?.estimatedDuration || 'N/A'} hours
                </Text>
              </View>
              <View style={styles.ackJobInfo}>
                <Text style={styles.ackLabel}>Priority</Text>
                <Text
                  style={[
                    styles.ackValue,
                    {
                      color: getPriorityColor(
                        selectedTask?.priority,
                      ),
                      fontWeight: typography.bold,
                    },
                  ]}>
                  {getPriorityIcon(selectedTask?.priority)}{' '}
                  {selectedTask?.priority || 'N/A'}
                </Text>
              </View>

              {/* Acknowledgment Note */}
              <View style={styles.ackNote}>
                <Text style={styles.ackNoteIcon}>ℹ️</Text>
                <Text style={styles.ackNoteText}>
                  By accepting this job, you confirm that you are
                  available to complete this task within the
                  scheduled time.
                </Text>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.rejectModalButton}
                onPress={() => {
                  setShowAckModal(false);
                  if (selectedTask) handleRejectJob(selectedTask);
                }}>
                <Text style={styles.rejectModalButtonText}>
                  ❌ Reject
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptModalButton}
                onPress={handleConfirmAccept}>
                <Text style={styles.acceptModalButtonText}>
                  ✅ Accept Job
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRejectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Reject Job #{selectedTask?.id}
              </Text>
              <TouchableOpacity
                onPress={() => setShowRejectModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.rejectSubtitle}>
                Select a reason for rejection:
              </Text>
              {REJECT_REASONS.map(reason => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.rejectReasonOption,
                    rejectReason === reason &&
                      styles.rejectReasonOptionSelected,
                  ]}
                  onPress={() => setRejectReason(reason)}>
                  <View
                    style={[
                      styles.radioButton,
                      rejectReason === reason &&
                        styles.radioButtonSelected,
                    ]}>
                    {rejectReason === reason && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.rejectReasonText,
                      rejectReason === reason &&
                        styles.rejectReasonTextSelected,
                    ]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
              {rejectReason === 'Other' && (
                <TextInput
                  style={styles.otherReasonInput}
                  placeholder="Please specify..."
                  placeholderTextColor={colors.textLight}
                  value={rejectReason === 'Other' ? '' : rejectReason}
                  onChangeText={text => setRejectReason(text)}
                  multiline
                />
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowRejectModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmRejectButton,
                  !rejectReason && styles.confirmRejectButtonDisabled,
                ]}
                onPress={handleConfirmReject}
                disabled={!rejectReason}>
                <Text style={styles.confirmRejectButtonText}>
                  Confirm Reject
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  searchContainer: {
    padding: spacing.md,
    paddingBottom: 0,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.md,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  clearSearch: {
    color: colors.textSecondary,
    fontSize: typography.md,
    padding: spacing.xs,
  },
  filterScroll: {
    maxHeight: 50,
    marginTop: spacing.sm,
  },
  filterContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  listContent: {
    padding: spacing.md,
  },
  taskCard: {
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
  taskCardCompleted: {
    opacity: 0.75,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  taskHeaderLeft: {
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
  taskId: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  taskDate: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  taskHeaderRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  priorityBadgeText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  customerName: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  taskAddress: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  taskCategory: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  statusFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusFlowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusFlowLine: {
    flex: 1,
    height: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  navigateButton: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
  },
  navigateButtonText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  acceptButton: {
    flex: 2,
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
  rejectButton: {
    backgroundColor: colors.error + '20',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error,
  },
  rejectButtonText: {
    fontSize: typography.md,
  },
  updateButton: {
    flex: 3,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
  },
  updateButtonText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  detailButton: {
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailButtonText: {
    fontSize: typography.md,
  },
  completedBadge: {
    backgroundColor: colors.success + '15',
    borderRadius: 6,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success,
  },
  completedBadgeText: {
    color: colors.success,
    fontSize: typography.sm,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  modalClose: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    padding: spacing.xs,
  },
  modalContent: {
    padding: spacing.lg,
  },
  ackJobInfo: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
    gap: spacing.md,
  },
  ackLabel: {
    width: 90,
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  ackValue: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textPrimary,
  },
  ackNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.secondary + '15',
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  ackNoteIcon: {
    fontSize: 16,
  },
  ackNoteText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeightMd,
  },
  rejectSubtitle: {
    fontSize: typography.md,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  rejectReasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  rejectReasonOptionSelected: {
    borderColor: colors.error,
    backgroundColor: colors.error + '08',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: colors.error,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
  },
  rejectReasonText: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  rejectReasonTextSelected: {
    color: colors.error,
    fontWeight: typography.medium,
  },
  otherReasonInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.md,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  rejectModalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error,
  },
  rejectModalButtonText: {
    color: colors.error,
    fontWeight: typography.bold,
  },
  acceptModalButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.success,
  },
  acceptModalButtonText: {
    color: colors.white,
    fontWeight: typography.bold,
  },
  confirmRejectButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.error,
  },
  confirmRejectButtonDisabled: {
    backgroundColor: colors.textLight,
  },
  confirmRejectButtonText: {
    color: colors.white,
    fontWeight: typography.bold,
  },
});

export default TechnicianTaskListScreen;