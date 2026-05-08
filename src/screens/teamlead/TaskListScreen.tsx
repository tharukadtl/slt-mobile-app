import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TeamLeadStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {fetchTeamTasks, fetchTeamMembers, assignTask} from '@store/slices/technicianSlice';
import {Task} from '@appTypes/technician.types';

type TaskListNavigationProp = StackNavigationProp<TeamLeadStackParamList>;

const STATUS_FILTERS = [
  {label: 'All', value: 'ALL'},
  {label: 'Pending', value: 'pending'},
  {label: 'Assigned', value: 'assigned'},
  {label: 'Travelling', value: 'travelling'},
  {label: 'In Progress', value: 'in_progress'},
  {label: 'Completed', value: 'completed'},
];

const PRIORITY_FILTERS = [
  {label: 'All Priority', value: 'ALL'},
  {label: 'High', value: 'HIGH'},
  {label: 'Medium', value: 'MEDIUM'},
  {label: 'Low', value: 'LOW'},
];

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'HIGH': return colors.error;
    case 'MEDIUM': return colors.warning;
    case 'LOW': return colors.success;
    default: return colors.textSecondary;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return colors.warning;
    case 'assigned': return colors.info;
    case 'travelling': return colors.secondary;
    case 'in_progress': return colors.primary;
    case 'completed': return colors.success;
    default: return colors.textSecondary;
  }
};

const TeamLeadTaskListScreen = () => {
  const navigation = useNavigation<TaskListNavigationProp>();
  const dispatch = useAppDispatch();
  const {tasks, teamMembers, isLoading} = useAppSelector(
    state => state.technician,
  );

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [technicianFilter, setTechnicianFilter] = useState('ALL');
  const [searchText, setSearchText] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchTeamTasks());
      dispatch(fetchTeamMembers());
    }, [dispatch]),
  );

  const filteredTasks = tasks.filter(task => {
    const matchesStatus =
      statusFilter === 'ALL' || task.status === statusFilter;
    const matchesPriority =
      priorityFilter === 'ALL' || task.priority === priorityFilter;
    const matchesTechnician =
      technicianFilter === 'ALL' ||
      task.technicianId === technicianFilter;
    const matchesSearch =
      searchText === '' ||
      task.id.includes(searchText) ||
      task.location?.address
        ?.toLowerCase()
        .includes(searchText.toLowerCase()) ||
      task.customerName
        ?.toLowerCase()
        .includes(searchText.toLowerCase());
    return (
      matchesStatus &&
      matchesPriority &&
      matchesTechnician &&
      matchesSearch
    );
  });

  const handleReassign = (task: Task) => {
    setSelectedTask(task);
    setShowReassignModal(true);
  };

  const handleReassignConfirm = (technicianId: string) => {
    const techName = teamMembers.find(m => m.id === technicianId)?.name;
    const isNew = !selectedTask?.technicianId;
    Alert.alert(
      isNew ? 'Assign Job' : 'Reassign Job',
      `${isNew ? 'Assign' : 'Reassign'} Task #${selectedTask?.id} to ${techName}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: isNew ? 'Assign' : 'Reassign',
          onPress: async () => {
            if (!selectedTask) return;
            setShowReassignModal(false);
            try {
              await dispatch(
                assignTask({id: selectedTask.id, technicianId}),
              ).unwrap();
              Alert.alert('Success', `Task assigned to ${techName}`);
            } catch (error: any) {
              Alert.alert('Error', error || 'Failed to assign task. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleViewDetail = (task: Task) => {
    setSelectedTask(task);
    setCompletionRemarks(task.notes || '');
    setShowDetailModal(true);
  };

  const activeFiltersCount = [
    statusFilter !== 'ALL',
    priorityFilter !== 'ALL',
    technicianFilter !== 'ALL',
  ].filter(Boolean).length;

  const renderTaskCard = ({item}: {item: Task}) => (
    <View style={styles.taskCard}>
      {/* Priority Bar */}
      <View
        style={[
          styles.priorityBar,
          {backgroundColor: getPriorityColor(item.priority)},
        ]}
      />

      <View style={styles.taskContent}>
        {/* Header */}
        <View style={styles.taskHeader}>
          <View style={styles.taskHeaderLeft}>
            <Text style={styles.taskId}>Task #{item.id}</Text>
            {item.priority && (
              <View
                style={[
                  styles.priorityBadge,
                  {
                    backgroundColor:
                      getPriorityColor(item.priority) + '20',
                  },
                ]}>
                <Text
                  style={[
                    styles.priorityText,
                    {color: getPriorityColor(item.priority)},
                  ]}>
                  {item.priority}
                </Text>
              </View>
            )}
          </View>
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

        {/* Technician */}
        <View style={styles.technicianRow}>
          <View style={styles.technicianAvatar}>
            <Text style={styles.technicianAvatarText}>
              {item.technicianName?.charAt(0) || 'T'}
            </Text>
          </View>
          <View>
            <Text style={styles.technicianName}>
              {item.technicianName || 'Unassigned'}
            </Text>
            <Text style={styles.scheduledDate}>
              📅 {item.scheduledDate}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.taskDetails}>
          {item.customerName && (
            <Text style={styles.taskDetail}>
              👤 {item.customerName}
            </Text>
          )}
          <Text style={styles.taskDetail} numberOfLines={1}>
            📍 {item.location?.address}
          </Text>
          {item.category && (
            <Text style={styles.taskDetail}>
              🔧 {item.category}
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.viewDetailButton}
            onPress={() => handleViewDetail(item)}>
            <Text style={styles.viewDetailButtonText}>
              📋 Details
            </Text>
          </TouchableOpacity>
          {item.status !== 'completed' && (
            <TouchableOpacity
              style={styles.reassignButton}
              onPress={() => handleReassign(item)}>
              <Text style={styles.reassignButtonText}>
                {item.technicianId ? '🔄 Reassign' : '👤 Assign'}
              </Text>
            </TouchableOpacity>
          )}
          {item.status === 'completed' && (
            <TouchableOpacity
              style={styles.paymentButton}
              onPress={() =>
                navigation.navigate('PaymentSubmission', {
                  taskId: item.id,
                })
              }>
              <Text style={styles.paymentButtonText}>
                💰 Payment
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Job Management</Text>
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
        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFiltersCount > 0 && styles.filterButtonActive,
          ]}
          onPress={() => setShowFilterModal(true)}>
          <Text style={styles.filterButtonText}>
            🔽 Filter
            {activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statusChips}
        contentContainerStyle={styles.statusChipsContent}>
        {STATUS_FILTERS.map(filter => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.statusChip,
              statusFilter === filter.value &&
                styles.statusChipActive,
            ]}
            onPress={() => setStatusFilter(filter.value)}>
            <Text
              style={[
                styles.statusChipText,
                statusFilter === filter.value &&
                  styles.statusChipTextActive,
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
            onRefresh={() => dispatch(fetchTeamTasks())}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No jobs found</Text>
            <Text style={styles.emptySubText}>
              Try adjusting your filters
            </Text>
          </View>
        }
      />

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Jobs</Text>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {/* Priority Filter */}
              <Text style={styles.filterSectionTitle}>Priority</Text>
              <View style={styles.filterOptions}>
                {PRIORITY_FILTERS.map(filter => (
                  <TouchableOpacity
                    key={filter.value}
                    style={[
                      styles.filterOption,
                      priorityFilter === filter.value &&
                        styles.filterOptionActive,
                    ]}
                    onPress={() =>
                      setPriorityFilter(filter.value)
                    }>
                    <Text
                      style={[
                        styles.filterOptionText,
                        priorityFilter === filter.value &&
                          styles.filterOptionTextActive,
                      ]}>
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Technician Filter */}
              <Text style={styles.filterSectionTitle}>Technician</Text>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    technicianFilter === 'ALL' &&
                      styles.filterOptionActive,
                  ]}
                  onPress={() => setTechnicianFilter('ALL')}>
                  <Text
                    style={[
                      styles.filterOptionText,
                      technicianFilter === 'ALL' &&
                        styles.filterOptionTextActive,
                    ]}>
                    All Technicians
                  </Text>
                </TouchableOpacity>
                {teamMembers.map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.filterOption,
                      technicianFilter === member.id &&
                        styles.filterOptionActive,
                    ]}
                    onPress={() =>
                      setTechnicianFilter(member.id)
                    }>
                    <Text
                      style={[
                        styles.filterOptionText,
                        technicianFilter === member.id &&
                          styles.filterOptionTextActive,
                      ]}>
                      {member.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => {
                  setPriorityFilter('ALL');
                  setTechnicianFilter('ALL');
                  setShowFilterModal(false);
                }}>
                <Text style={styles.resetButtonText}>
                  Reset Filters
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowFilterModal(false)}>
                <Text style={styles.applyButtonText}>
                  Apply Filters
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reassign Modal */}
      <Modal
        visible={showReassignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReassignModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedTask?.technicianId ? 'Reassign' : 'Assign'} Task #{selectedTask?.id}
              </Text>
              <TouchableOpacity
                onPress={() => setShowReassignModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.reassignSubtitle}>
              Select a team member to {selectedTask?.technicianId ? 'reassign' : 'assign'} this job:
            </Text>
            <ScrollView style={styles.modalContent}>
              {teamMembers.map(member => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.memberOption,
                    selectedTask?.technicianId === member.id &&
                      styles.memberOptionCurrent,
                  ]}
                  onPress={() => handleReassignConfirm(member.id)}>
                  <View style={styles.memberOptionAvatar}>
                    <Text style={styles.memberOptionAvatarText}>
                      {member.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.memberOptionInfo}>
                    <Text style={styles.memberOptionName}>
                      {member.name}
                    </Text>
                    <Text style={styles.memberOptionJobs}>
                      {member.totalJobs} jobs today
                    </Text>
                  </View>
                  {selectedTask?.technicianId === member.id && (
                    <Text style={styles.currentBadge}>
                      Current
                    </Text>
                  )}
                  <View
                    style={[
                      styles.memberStatusDot,
                      {
                        backgroundColor:
                          member.status === 'ACTIVE'
                            ? colors.success
                            : colors.error,
                      },
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Task Detail Modal */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.detailModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Task #{selectedTask?.id} Details
              </Text>
              <TouchableOpacity
                onPress={() => setShowDetailModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {/* Task Info */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>
                  Job Information
                </Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          getStatusColor(
                            selectedTask?.status || '',
                          ) + '20',
                      },
                    ]}>
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: getStatusColor(
                            selectedTask?.status || '',
                          ),
                        },
                      ]}>
                      {selectedTask?.status
                        ?.replace('_', ' ')
                        .toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Priority</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      {
                        color: getPriorityColor(
                          selectedTask?.priority,
                        ),
                        fontWeight: typography.bold,
                      },
                    ]}>
                    {selectedTask?.priority || 'N/A'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Customer</Text>
                  <Text style={styles.detailValue}>
                    {selectedTask?.customerName || 'N/A'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Address</Text>
                  <Text
                    style={[styles.detailValue, {flex: 1}]}
                    numberOfLines={2}>
                    {selectedTask?.location?.address}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Technician</Text>
                  <Text style={styles.detailValue}>
                    {selectedTask?.technicianName || 'Unassigned'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Scheduled</Text>
                  <Text style={styles.detailValue}>
                    {selectedTask?.scheduledDate}
                  </Text>
                </View>
              </View>

              {/* Before Photos */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>
                  Before Photos
                </Text>
                <TouchableOpacity
                  style={styles.photoUploadButton}>
                  <Text style={styles.photoUploadText}>
                    📷 Add Before Photos
                  </Text>
                </TouchableOpacity>
                {beforePhotos.length === 0 && (
                  <Text style={styles.noPhotosText}>
                    No before photos added
                  </Text>
                )}
              </View>

              {/* After Photos */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>
                  After Photos
                </Text>
                <TouchableOpacity
                  style={styles.photoUploadButton}>
                  <Text style={styles.photoUploadText}>
                    📷 Add After Photos
                  </Text>
                </TouchableOpacity>
                {afterPhotos.length === 0 && (
                  <Text style={styles.noPhotosText}>
                    No after photos added
                  </Text>
                )}
              </View>

              {/* Completion Remarks */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>
                  Completion Remarks
                </Text>
                <TextInput
                  style={styles.remarksInput}
                  placeholder="Enter completion remarks..."
                  placeholderTextColor={colors.textLight}
                  value={completionRemarks}
                  onChangeText={setCompletionRemarks}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.closeDetailButton}
                onPress={() => setShowDetailModal(false)}>
                <Text style={styles.closeDetailButtonText}>
                  Close
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveRemarksButton}
                onPress={() => {
                  Alert.alert(
                    'Success',
                    'Remarks saved successfully',
                  );
                  setShowDetailModal(false);
                }}>
                <Text style={styles.saveRemarksButtonText}>
                  Save Remarks
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
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
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
  filterButton: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  statusChips: {
    maxHeight: 44,
    marginBottom: spacing.sm,
  },
  statusChipsContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusChipText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  statusChipTextActive: {
    color: colors.white,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: 0,
  },
  taskCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    marginBottom: spacing.md,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  priorityBar: {
    width: 4,
  },
  taskContent: {
    flex: 1,
    padding: spacing.md,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  taskHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  taskId: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
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
  technicianRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  technicianAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  technicianAvatarText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  technicianName: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  scheduledDate: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  taskDetails: {
    gap: 4,
    marginBottom: spacing.sm,
  },
  taskDetail: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  viewDetailButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewDetailButtonText: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  reassignButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  reassignButtonText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  paymentButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: colors.success,
  },
  paymentButtonText: {
    fontSize: typography.sm,
    color: colors.white,
    fontWeight: typography.bold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
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
    maxHeight: '75%',
  },
  detailModal: {
    maxHeight: '90%',
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
  filterSectionTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterOptionText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  filterOptionTextActive: {
    color: colors.white,
    fontWeight: typography.medium,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resetButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButtonText: {
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  applyButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  applyButtonText: {
    color: colors.white,
    fontWeight: typography.bold,
  },
  reassignSubtitle: {
    fontSize: typography.md,
    color: colors.textSecondary,
    padding: spacing.lg,
    paddingBottom: 0,
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  memberOptionCurrent: {
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  memberOptionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  memberOptionAvatarText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  memberOptionInfo: {
    flex: 1,
  },
  memberOptionName: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  memberOptionJobs: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  currentBadge: {
    fontSize: typography.xs,
    color: colors.primary,
    fontWeight: typography.bold,
    marginRight: spacing.sm,
  },
  memberStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detailSection: {
    marginBottom: spacing.lg,
  },
  detailSectionTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
    gap: spacing.md,
  },
  detailLabel: {
    width: 90,
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  detailValue: {
    fontSize: typography.sm,
    color: colors.textPrimary,
  },
  photoUploadButton: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  photoUploadText: {
    color: colors.primary,
    fontSize: typography.md,
    fontWeight: typography.medium,
  },
  noPhotosText: {
    fontSize: typography.sm,
    color: colors.textLight,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  remarksInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.md,
    color: colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  closeDetailButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeDetailButtonText: {
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  saveRemarksButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  saveRemarksButtonText: {
    color: colors.white,
    fontWeight: typography.bold,
  },
});

export default TeamLeadTaskListScreen;