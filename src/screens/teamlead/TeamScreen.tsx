import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Linking,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TeamLeadStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {fetchTeamMembers} from '@store/slices/technicianSlice';
import {TeamMember} from '@appTypes/technician.types';

type TeamScreenNavigationProp =
  StackNavigationProp<TeamLeadStackParamList>;

const STATUS_FILTERS = [
  {label: 'All', value: 'ALL'},
  {label: 'Active', value: 'ACTIVE'},
  {label: 'Inactive', value: 'INACTIVE'},
  {label: 'On Leave', value: 'ON_LEAVE'},
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE': return colors.success;
    case 'INACTIVE': return colors.error;
    case 'ON_LEAVE': return colors.warning;
    default: return colors.textSecondary;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'ACTIVE': return '🟢';
    case 'INACTIVE': return '🔴';
    case 'ON_LEAVE': return '🟡';
    default: return '⚪';
  }
};

const getJobStatusColor = (status?: string) => {
  switch (status) {
    case 'in_progress': return colors.warning;
    case 'travelling': return colors.secondary;
    case 'assigned': return colors.info;
    case 'completed': return colors.success;
    default: return colors.textSecondary;
  }
};

// Mock team members data
const MOCK_TEAM_MEMBERS: TeamMember[] = [
  {
    id: '1',
    name: 'Kasun Perera',
    phone: '0711234567',
    status: 'ACTIVE',
    currentJobId: 'TASK001',
    currentJobStatus: 'in_progress',
    location: {
      latitude: 6.9271,
      longitude: 79.8612,
      lastUpdated: new Date().toLocaleTimeString(),
    },
    completedToday: 5,
    totalJobs: 8,
    avgTime: 2.1,
  },
  {
    id: '2',
    name: 'Nimal Silva',
    phone: '0722345678',
    status: 'ACTIVE',
    currentJobId: 'TASK002',
    currentJobStatus: 'travelling',
    location: {
      latitude: 6.9350,
      longitude: 79.8550,
      lastUpdated: new Date().toLocaleTimeString(),
    },
    completedToday: 3,
    totalJobs: 6,
    avgTime: 2.5,
  },
  {
    id: '3',
    name: 'Saman Fernando',
    phone: '0733456789',
    status: 'ACTIVE',
    currentJobId: undefined,
    currentJobStatus: undefined,
    location: {
      latitude: 6.9200,
      longitude: 79.8700,
      lastUpdated: new Date().toLocaleTimeString(),
    },
    completedToday: 6,
    totalJobs: 6,
    avgTime: 1.9,
  },
  {
    id: '4',
    name: 'Ruwan Jayawardena',
    phone: '0744567890',
    status: 'INACTIVE',
    currentJobId: undefined,
    currentJobStatus: undefined,
    location: undefined,
    completedToday: 0,
    totalJobs: 0,
    avgTime: 0,
  },
  {
    id: '5',
    name: 'Chamara Bandara',
    phone: '0755678901',
    status: 'ON_LEAVE',
    currentJobId: undefined,
    currentJobStatus: undefined,
    location: undefined,
    completedToday: 0,
    totalJobs: 0,
    avgTime: 0,
  },
  {
    id: '6',
    name: 'Pradeep Kumara',
    phone: '0766789012',
    status: 'ACTIVE',
    currentJobId: 'TASK003',
    currentJobStatus: 'assigned',
    location: {
      latitude: 6.9100,
      longitude: 79.8800,
      lastUpdated: new Date().toLocaleTimeString(),
    },
    completedToday: 4,
    totalJobs: 7,
    avgTime: 2.3,
  },
];

const TeamScreen = () => {
  const navigation = useNavigation<TeamScreenNavigationProp>();
  const dispatch = useAppDispatch();
  const {teamMembers, isLoading} = useAppSelector(
    state => state.technician,
  );

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchText, setSearchText] = useState('');
  const [selectedMember, setSelectedMember] =
    useState<TeamMember | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    dispatch(fetchTeamMembers());
  }, []);

  const members =
    teamMembers.length > 0 ? teamMembers : MOCK_TEAM_MEMBERS;

  const filteredMembers = members.filter(member => {
    const matchesStatus =
      statusFilter === 'ALL' || member.status === statusFilter;
    const matchesSearch =
      searchText === '' ||
      member.name
        .toLowerCase()
        .includes(searchText.toLowerCase()) ||
      member.phone.includes(searchText);
    return matchesStatus && matchesSearch;
  });

  const activeCount = members.filter(
    m => m.status === 'ACTIVE',
  ).length;
  const onJobCount = members.filter(
    m => m.currentJobId !== undefined,
  ).length;
  const availableCount = members.filter(
    m => m.status === 'ACTIVE' && !m.currentJobId,
  ).length;

  const handleCallMember = (phone: string, name: string) => {
    Alert.alert(
      `Call ${name}`,
      `Call ${phone}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Call',
          onPress: () =>
            Linking.openURL(`tel:${phone}`).catch(() =>
              Alert.alert('Error', 'Could not make call'),
            ),
        },
      ],
    );
  };

  const handleViewMember = (member: TeamMember) => {
    setSelectedMember(member);
    setShowDetailModal(true);
  };

  const handleViewOnMap = () => {
    setShowDetailModal(false);
    navigation.navigate('TeamMap');
  };

  const renderMemberCard = ({item}: {item: TeamMember}) => (
    <TouchableOpacity
      style={styles.memberCard}
      onPress={() => handleViewMember(item)}>
      {/* Avatar */}
      <View
        style={[
          styles.memberAvatar,
          {
            backgroundColor:
              item.status === 'ACTIVE'
                ? colors.primary
                : colors.textSecondary,
          },
        ]}>
        <Text style={styles.memberAvatarText}>
          {item.name.charAt(0)}
        </Text>
        {/* Online Status Dot */}
        <View
          style={[
            styles.statusDot,
            {backgroundColor: getStatusColor(item.status)},
          ]}
        />
      </View>

      {/* Member Info */}
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.name}</Text>
        <Text style={styles.memberPhone}>📞 {item.phone}</Text>

        {/* Current Job Status */}
        {item.currentJobId ? (
          <View style={styles.jobStatusRow}>
            <View
              style={[
                styles.jobStatusBadge,
                {
                  backgroundColor:
                    getJobStatusColor(
                      item.currentJobStatus,
                    ) + '20',
                },
              ]}>
              <Text
                style={[
                  styles.jobStatusText,
                  {
                    color: getJobStatusColor(
                      item.currentJobStatus,
                    ),
                  },
                ]}>
                🔧{' '}
                {item.currentJobStatus
                  ?.replace('_', ' ')
                  .toUpperCase()}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.jobStatusRow}>
            <View
              style={[
                styles.jobStatusBadge,
                {
                  backgroundColor:
                    item.status === 'ACTIVE'
                      ? colors.success + '20'
                      : colors.error + '20',
                },
              ]}>
              <Text
                style={[
                  styles.jobStatusText,
                  {
                    color:
                      item.status === 'ACTIVE'
                        ? colors.success
                        : colors.error,
                  },
                ]}>
                {getStatusIcon(item.status)} {item.status}
              </Text>
            </View>
          </View>
        )}

        {/* Today's Stats */}
        {item.status === 'ACTIVE' && (
          <Text style={styles.memberStats}>
            ✅ {item.completedToday}/{item.totalJobs} jobs today
            {item.avgTime > 0
              ? ` • Avg: ${item.avgTime.toFixed(1)}h`
              : ''}
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.memberActions}>
        <TouchableOpacity
          style={styles.callButton}
          onPress={() =>
            handleCallMember(item.phone, item.name)
          }>
          <Text style={styles.callButtonText}>📞</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.detailButton}
          onPress={() => handleViewMember(item)}>
          <Text style={styles.detailButtonText}>→</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Team</Text>
        <Text style={styles.headerSubtitle}>
          {members.length} team members
        </Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View
          style={[
            styles.summaryCard,
            {backgroundColor: colors.success},
          ]}>
          <Text style={styles.summaryValue}>{activeCount}</Text>
          <Text style={styles.summaryLabel}>Active</Text>
        </View>
        <View
          style={[
            styles.summaryCard,
            {backgroundColor: colors.warning},
          ]}>
          <Text style={styles.summaryValue}>{onJobCount}</Text>
          <Text style={styles.summaryLabel}>On Job</Text>
        </View>
        <View
          style={[
            styles.summaryCard,
            {backgroundColor: colors.secondary},
          ]}>
          <Text style={styles.summaryValue}>
            {availableCount}
          </Text>
          <Text style={styles.summaryLabel}>Available</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.summaryCard,
            {backgroundColor: colors.primary},
          ]}
          onPress={() => navigation.navigate('TeamMap')}>
          <Text style={styles.summaryValue}>🗺️</Text>
          <Text style={styles.summaryLabel}>Map View</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or phone..."
            placeholderTextColor={colors.textLight}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText !== '' && (
            <TouchableOpacity
              onPress={() => setSearchText('')}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Filter */}
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

      {/* Member List */}
      <FlatList
        data={filteredMembers}
        keyExtractor={item => item.id}
        renderItem={renderMemberCard}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => dispatch(fetchTeamMembers())}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>
              No team members found
            </Text>
            <Text style={styles.emptySubText}>
              Try adjusting your filters
            </Text>
          </View>
        }
      />

      {/* Member Detail Modal */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedMember?.name}
              </Text>
              <TouchableOpacity
                onPress={() => setShowDetailModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedMember && (
              <ScrollView style={styles.modalContent}>
                {/* Profile */}
                <View style={styles.modalProfile}>
                  <View
                    style={[
                      styles.modalAvatar,
                      {
                        backgroundColor:
                          selectedMember.status === 'ACTIVE'
                            ? colors.primary
                            : colors.textSecondary,
                      },
                    ]}>
                    <Text style={styles.modalAvatarText}>
                      {selectedMember.name.charAt(0)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.modalStatusBadge,
                      {
                        backgroundColor:
                          getStatusColor(
                            selectedMember.status,
                          ) + '20',
                      },
                    ]}>
                    <Text
                      style={[
                        styles.modalStatusText,
                        {
                          color: getStatusColor(
                            selectedMember.status,
                          ),
                        },
                      ]}>
                      {getStatusIcon(selectedMember.status)}{' '}
                      {selectedMember.status}
                    </Text>
                  </View>
                </View>

                {/* Contact Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>
                    Contact Information
                  </Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone</Text>
                    <Text style={styles.detailValue}>
                      {selectedMember.phone}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        {
                          color: getStatusColor(
                            selectedMember.status,
                          ),
                          fontWeight: typography.bold,
                        },
                      ]}>
                      {selectedMember.status}
                    </Text>
                  </View>
                </View>

                {/* Current Job */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>
                    Current Assignment
                  </Text>
                  {selectedMember.currentJobId ? (
                    <>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>
                          Job ID
                        </Text>
                        <Text style={styles.detailValue}>
                          #{selectedMember.currentJobId}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>
                          Status
                        </Text>
                        <Text
                          style={[
                            styles.detailValue,
                            {
                              color: getJobStatusColor(
                                selectedMember.currentJobStatus,
                              ),
                              fontWeight: typography.bold,
                            },
                          ]}>
                          {selectedMember.currentJobStatus
                            ?.replace('_', ' ')
                            .toUpperCase()}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.noJobText}>
                      No active job assigned
                    </Text>
                  )}
                </View>

                {/* Today's Performance */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>
                    Today's Performance
                  </Text>
                  <View style={styles.performanceGrid}>
                    <View style={styles.performanceItem}>
                      <Text style={styles.performanceValue}>
                        {selectedMember.completedToday}
                      </Text>
                      <Text style={styles.performanceLabel}>
                        Completed
                      </Text>
                    </View>
                    <View style={styles.performanceItem}>
                      <Text style={styles.performanceValue}>
                        {selectedMember.totalJobs}
                      </Text>
                      <Text style={styles.performanceLabel}>
                        Total Jobs
                      </Text>
                    </View>
                    <View style={styles.performanceItem}>
                      <Text style={styles.performanceValue}>
                        {selectedMember.avgTime > 0
                          ? `${selectedMember.avgTime.toFixed(1)}h`
                          : 'N/A'}
                      </Text>
                      <Text style={styles.performanceLabel}>
                        Avg Time
                      </Text>
                    </View>
                  </View>
                  {selectedMember.totalJobs > 0 && (
                    <View style={styles.completionBar}>
                      <View style={styles.completionBarBg}>
                        <View
                          style={[
                            styles.completionBarFill,
                            {
                              width: `${
                                (selectedMember.completedToday /
                                  selectedMember.totalJobs) *
                                100
                              }%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.completionRate}>
                        {(
                          (selectedMember.completedToday /
                            selectedMember.totalJobs) *
                          100
                        ).toFixed(0)}
                        %
                      </Text>
                    </View>
                  )}
                </View>

                {/* Location */}
                {selectedMember.location && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>
                      Last Known Location
                    </Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>
                        Updated
                      </Text>
                      <Text style={styles.detailValue}>
                        {selectedMember.location.lastUpdated}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>
                        Coordinates
                      </Text>
                      <Text style={styles.detailValue}>
                        {selectedMember.location.latitude.toFixed(
                          4,
                        )}
                        ,{' '}
                        {selectedMember.location.longitude.toFixed(
                          4,
                        )}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.callModalButton}
                onPress={() => {
                  setShowDetailModal(false);
                  if (selectedMember) {
                    handleCallMember(
                      selectedMember.phone,
                      selectedMember.name,
                    );
                  }
                }}>
                <Text style={styles.callModalButtonText}>
                  📞 Call
                </Text>
              </TouchableOpacity>
              {selectedMember?.location && (
                <TouchableOpacity
                  style={styles.mapModalButton}
                  onPress={handleViewOnMap}>
                  <Text style={styles.mapModalButtonText}>
                    🗺️ View on Map
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setShowDetailModal(false)}>
                <Text style={styles.closeModalButtonText}>
                  Close
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
  summaryRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  summaryLabel: {
    fontSize: 9,
    color: colors.white,
    opacity: 0.9,
    marginTop: 2,
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
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
  clearText: {
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
    paddingBottom: spacing.xl,
  },
  memberCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  memberAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    position: 'relative',
  },
  memberAvatarText: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.white,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  memberPhone: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  jobStatusRow: {
    marginBottom: spacing.xs,
  },
  jobStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  jobStatusText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  memberStats: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  memberActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginLeft: spacing.sm,
  },
  callButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButtonText: {
    fontSize: 18,
  },
  detailButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailButtonText: {
    fontSize: typography.lg,
    color: colors.white,
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
    maxHeight: '85%',
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
  modalProfile: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarText: {
    fontSize: typography.xxxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  modalStatusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  modalStatusText: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  detailSection: {
    marginBottom: spacing.lg,
  },
  detailSectionTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
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
    flex: 1,
    fontSize: typography.sm,
    color: colors.textPrimary,
  },
  noJobText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  performanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  performanceItem: {
    alignItems: 'center',
  },
  performanceValue: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  performanceLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  completionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  completionBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  completionBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  completionRate: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.primary,
    width: 35,
    textAlign: 'right',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  callModalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.success,
  },
  callModalButtonText: {
    color: colors.white,
    fontWeight: typography.bold,
    fontSize: typography.sm,
  },
  mapModalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  mapModalButtonText: {
    color: colors.white,
    fontWeight: typography.bold,
    fontSize: typography.sm,
  },
  closeModalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeModalButtonText: {
    color: colors.textSecondary,
    fontWeight: typography.medium,
    fontSize: typography.sm,
  },
});

export default TeamScreen;