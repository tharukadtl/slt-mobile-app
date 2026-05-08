import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {useNavigation} from '@react-navigation/native';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {fetchTeamMembers} from '@store/slices/technicianSlice';
import {TeamMember} from '@appTypes/technician.types';

const TeamMapScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const mapRef = useRef<MapView>(null);
  const {teamMembers, isLoading} = useAppSelector(
    state => state.technician,
  );

  const [selectedMember, setSelectedMember] =
    useState<TeamMember | null>(null);
  const [filteredMembers, setFilteredMembers] =
    useState<TeamMember[]>(teamMembers);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    dispatch(fetchTeamMembers());
    // Auto refresh every 30 seconds
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        dispatch(fetchTeamMembers());
      }, 30000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  useEffect(() => {
    applyFilter(selectedFilter);
  }, [teamMembers, selectedFilter]);

  const applyFilter = (filter: string) => {
    if (filter === 'ALL') {
      setFilteredMembers(teamMembers);
    } else if (filter === 'ACTIVE') {
      setFilteredMembers(
        teamMembers.filter(m => m.status === 'ACTIVE'),
      );
    } else if (filter === 'INACTIVE') {
      setFilteredMembers(
        teamMembers.filter(m => m.status !== 'ACTIVE'),
      );
    } else if (filter === 'ON_JOB') {
      setFilteredMembers(
        teamMembers.filter(m => m.currentJobId !== undefined),
      );
    } else {
      // Filter by specific member ID
      setFilteredMembers(
        teamMembers.filter(m => m.id === filter),
      );
    }
  };

  const membersWithLocation = filteredMembers.filter(
    m => m.location,
  );

  const handleFocusMember = (member: TeamMember) => {
    if (member.location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: member.location.latitude,
        longitude: member.location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setSelectedMember(member);
    }
  };

  const handleFitAll = () => {
    if (membersWithLocation.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(
        membersWithLocation.map(m => ({
          latitude: m.location!.latitude,
          longitude: m.location!.longitude,
        })),
        {
          edgePadding: {top: 80, right: 80, bottom: 200, left: 80},
          animated: true,
        },
      );
    }
  };

  const getMarkerColor = (member: TeamMember) => {
    if (member.currentJobStatus === 'in_progress') return colors.warning;
    if (member.currentJobStatus === 'travelling') return colors.secondary;
    if (member.status === 'ACTIVE') return colors.success;
    return colors.error;
  };

  const getStatusText = (member: TeamMember) => {
    if (member.currentJobStatus === 'in_progress') return 'Working';
    if (member.currentJobStatus === 'travelling') return 'Travelling';
    if (member.currentJobStatus === 'assigned') return 'Assigned';
    if (member.status === 'ACTIVE') return 'Available';
    return 'Inactive';
  };

  const FILTER_OPTIONS = [
    {label: 'All Members', value: 'ALL'},
    {label: 'Active Only', value: 'ACTIVE'},
    {label: 'Inactive', value: 'INACTIVE'},
    {label: 'On Job', value: 'ON_JOB'},
    ...teamMembers.map(m => ({
      label: m.name,
      value: m.id,
    })),
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Team Map</Text>
          <Text style={styles.headerSubtitle}>
            {membersWithLocation.length} members tracked
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.autoRefreshButton,
              autoRefresh && styles.autoRefreshButtonActive,
            ]}
            onPress={() => setAutoRefresh(!autoRefresh)}>
            <Text style={styles.autoRefreshText}>
              {autoRefresh ? '🔄 Live' : '⏸ Paused'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: 6.9271,
          longitude: 79.8612,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
        onMapReady={handleFitAll}>
        {membersWithLocation.map(member => (
          <Marker
            key={member.id}
            coordinate={{
              latitude: member.location!.latitude,
              longitude: member.location!.longitude,
            }}
            onPress={() => handleFocusMember(member)}>
            <View
              style={[
                styles.markerContainer,
                selectedMember?.id === member.id &&
                  styles.markerContainerSelected,
              ]}>
              {/* Avatar Circle */}
              <View
                style={[
                  styles.markerAvatar,
                  {backgroundColor: getMarkerColor(member)},
                ]}>
                <Text style={styles.markerAvatarText}>
                  {member.name.charAt(0)}
                </Text>
              </View>
              {/* Name Label */}
              <View style={styles.markerNameBubble}>
                <Text style={styles.markerName} numberOfLines={1}>
                  {member.name.split(' ')[0]}
                </Text>
              </View>
              {/* Status Dot */}
              <View
                style={[
                  styles.markerStatusDot,
                  {backgroundColor: getMarkerColor(member)},
                ]}
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Map Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleFitAll}>
          <Text style={styles.controlButtonText}>⊙ Fit All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setShowFilterModal(true)}>
          <Text style={styles.controlButtonText}>
            🔽 Filter{' '}
            {selectedFilter !== 'ALL' ? '•' : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Selected Member Card */}
      {selectedMember && (
        <View style={styles.selectedMemberCard}>
          <View style={styles.selectedMemberHeader}>
            <View
              style={[
                styles.selectedMemberAvatar,
                {backgroundColor: getMarkerColor(selectedMember)},
              ]}>
              <Text style={styles.selectedMemberAvatarText}>
                {selectedMember.name.charAt(0)}
              </Text>
            </View>
            <View style={styles.selectedMemberInfo}>
              <Text style={styles.selectedMemberName}>
                {selectedMember.name}
              </Text>
              <Text style={styles.selectedMemberPhone}>
                📞 {selectedMember.phone}
              </Text>
              <View
                style={[
                  styles.selectedMemberStatus,
                  {
                    backgroundColor:
                      getMarkerColor(selectedMember) + '20',
                  },
                ]}>
                <Text
                  style={[
                    styles.selectedMemberStatusText,
                    {color: getMarkerColor(selectedMember)},
                  ]}>
                  {getStatusText(selectedMember)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeMemberCard}
              onPress={() => setSelectedMember(null)}>
              <Text style={styles.closeMemberCardText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.selectedMemberStats}>
            <View style={styles.selectedMemberStat}>
              <Text style={styles.selectedMemberStatValue}>
                {selectedMember.completedToday}
              </Text>
              <Text style={styles.selectedMemberStatLabel}>
                Completed Today
              </Text>
            </View>
            <View style={styles.selectedMemberStat}>
              <Text style={styles.selectedMemberStatValue}>
                {selectedMember.totalJobs}
              </Text>
              <Text style={styles.selectedMemberStatLabel}>
                Total Jobs
              </Text>
            </View>
            <View style={styles.selectedMemberStat}>
              <Text style={styles.selectedMemberStatValue}>
                {selectedMember.avgTime.toFixed(1)}h
              </Text>
              <Text style={styles.selectedMemberStatLabel}>
                Avg Time
              </Text>
            </View>
          </View>
          {selectedMember.location && (
            <Text style={styles.lastUpdated}>
              🕐 Last updated:{' '}
              {selectedMember.location.lastUpdated}
            </Text>
          )}
        </View>
      )}

      {/* Bottom Member List */}
      {!selectedMember && (
        <View style={styles.memberListContainer}>
          <View style={styles.memberListHeader}>
            <Text style={styles.memberListTitle}>
              Team Members ({filteredMembers.length})
            </Text>
            <TouchableOpacity
              onPress={() => dispatch(fetchTeamMembers())}>
              <Text style={styles.refreshText}>
                {isLoading ? '...' : '🔄 Refresh'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.memberListContent}>
            {filteredMembers.map(member => (
              <TouchableOpacity
                key={member.id}
                style={[
                  styles.memberListCard,
                  !member.location && styles.memberListCardNoLocation,
                ]}
                onPress={() =>
                  member.location && handleFocusMember(member)
                }>
                <View
                  style={[
                    styles.memberListAvatar,
                    {backgroundColor: getMarkerColor(member)},
                  ]}>
                  <Text style={styles.memberListAvatarText}>
                    {member.name.charAt(0)}
                  </Text>
                </View>
                <Text style={styles.memberListName} numberOfLines={1}>
                  {member.name.split(' ')[0]}
                </Text>
                <Text
                  style={[
                    styles.memberListStatus,
                    {color: getMarkerColor(member)},
                  ]}>
                  {getStatusText(member)}
                </Text>
                {!member.location && (
                  <Text style={styles.noLocationText}>
                    No GPS
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Members</Text>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={FILTER_OPTIONS}
              keyExtractor={item => item.value}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    selectedFilter === item.value &&
                      styles.filterOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedFilter(item.value);
                    applyFilter(item.value);
                    setShowFilterModal(false);
                  }}>
                  <Text
                    style={[
                      styles.filterOptionText,
                      selectedFilter === item.value &&
                        styles.filterOptionTextSelected,
                    ]}>
                    {item.label}
                  </Text>
                  {selectedFilter === item.value && (
                    <Text style={styles.filterCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  backText: {
    color: colors.white,
    fontSize: typography.md,
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.white,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: typography.xs,
    color: colors.white,
    opacity: 0.8,
    textAlign: 'center',
  },
  headerActions: {
    alignItems: 'flex-end',
  },
  autoRefreshButton: {
    backgroundColor: colors.white + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  autoRefreshButtonActive: {
    backgroundColor: colors.success + '40',
  },
  autoRefreshText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.medium,
  },
  map: {
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    top: 130,
    right: spacing.md,
    gap: spacing.sm,
  },
  controlButton: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  controlButtonText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerContainerSelected: {
    transform: [{scale: 1.2}],
  },
  markerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  markerAvatarText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  markerNameBubble: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  markerName: {
    fontSize: 10,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  markerStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 2,
    borderWidth: 1,
    borderColor: colors.white,
  },
  selectedMemberCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: -3},
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  selectedMemberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  selectedMemberAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  selectedMemberAvatarText: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  selectedMemberInfo: {
    flex: 1,
  },
  selectedMemberName: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  selectedMemberPhone: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  selectedMemberStatus: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  selectedMemberStatusText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  closeMemberCard: {
    padding: spacing.sm,
  },
  closeMemberCardText: {
    fontSize: typography.lg,
    color: colors.textSecondary,
  },
  selectedMemberStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  selectedMemberStat: {
    alignItems: 'center',
  },
  selectedMemberStatValue: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  selectedMemberStatLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  lastUpdated: {
    fontSize: typography.xs,
    color: colors.textLight,
    textAlign: 'center',
  },
  memberListContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.md,
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: -3},
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  memberListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  memberListTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  refreshText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  memberListContent: {
    paddingBottom: spacing.xs,
  },
  memberListCard: {
    alignItems: 'center',
    marginRight: spacing.md,
    width: 70,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
  },
  memberListCardNoLocation: {
    opacity: 0.5,
  },
  memberListAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  memberListAvatarText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  memberListName: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  memberListStatus: {
    fontSize: 9,
    fontWeight: typography.bold,
    textAlign: 'center',
  },
  noLocationText: {
    fontSize: 9,
    color: colors.error,
    marginTop: 2,
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
    maxHeight: '70%',
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
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterOptionSelected: {
    backgroundColor: colors.primary + '10',
  },
  filterOptionText: {
    fontSize: typography.md,
    color: colors.textPrimary,
  },
  filterOptionTextSelected: {
    color: colors.primary,
    fontWeight: typography.bold,
  },
  filterCheckmark: {
    color: colors.primary,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
});

export default TeamMapScreen;