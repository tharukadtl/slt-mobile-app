import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TeamLeadStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {
  fetchTeamTasks,
  fetchTeamMembers,
  fetchTeamStats,
  fetchMyFaults,
  checkTodaysSession,
  assignTask,
} from '@store/slices/technicianSlice';
import api from '@services/api';
type TeamLeadHomeNavigationProp =
  StackNavigationProp<TeamLeadStackParamList>;

const TABS = ['My Jobs', 'Team Jobs', 'Needs Attention', 'Team Map'];

// Mirrors the technician-side OBSERVED_ISSUE_TYPES vocabulary (technician/
// HomeScreen.tsx) so a mismatch the technician logged reads identically here.
const OBSERVED_ISSUE_LABELS: Record<string, string> = {
  INTERNET: '🌐 Internet',
  PHONE: '📞 Phone',
  FIBER: '🔌 Fiber',
  TV: '📺 TV',
  OTHER: '🔧 Other',
};

// SRS 5.3.1.2 (on-site escalation) + 5.3.1.4 (EOD batch handover) — two
// different urgency models, so the queue sub-groups rather than showing one
// flat list. Rejection categories mirror the technician REJECTION_CATEGORIES.
const ATTENTION_SECTIONS: {
  key: string;
  title: string;
  icon: string;
  match: (t: any) => boolean;
}[] = [
  {
    key: 'ISSUE_MISMATCH',
    title: 'Issue Mismatch',
    icon: '🔀',
    match: t =>
      t.status === 'rejected' && t.rejectionCategory === 'ISSUE_MISMATCH',
  },
  {
    key: 'MATERIAL_DELAY',
    title: 'Material Delay',
    icon: '📦',
    match: t =>
      t.status === 'rejected' && t.rejectionCategory === 'MATERIAL_DELAY',
  },
  {
    key: 'OTHER',
    title: 'Other',
    icon: '❓',
    match: t => t.status === 'rejected' && t.rejectionCategory === 'OTHER',
  },
  {
    key: 'EOD_HANDOVER',
    title: 'EOD Handover',
    icon: '🌙',
    match: t => t.eodHandoverReason != null,
  },
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
    case 'accepted': return colors.secondary;
    case 'travelling': return colors.secondary;
    case 'in_progress': return colors.accent;
    case 'hold': return colors.warning;
    case 'completed': return colors.success;
    case 'rejected': return colors.error;
    case 'cancelled': return colors.textSecondary;
    default: return colors.textSecondary;
  }
};

const TeamLeadHomeScreen = () => {
  const navigation = useNavigation<TeamLeadHomeNavigationProp>();
  const dispatch = useAppDispatch();
  const {user} = useAppSelector(state => state.auth);
  const {
    tasks,
    teamMembers,
    teamStats,
    hasBODToday,
    todaySessionStatus,
    isLoading,
  } = useAppSelector(state => state.technician);
  // ATT-017 — hasBODToday alone stays true after EOD too (it's what stops a
  // second BOD), so it can't tell "day running" from "day over" on its own.
  const isDayCompleted = hasBODToday && todaySessionStatus === 'CLOSED';

  const [activeTab, setActiveTab] = useState(0);
  // Material-delay rejections carry a linkedMaterialRequestId; the request's
  // own detail (number/status/items) lives in the inventory service. There is
  // no by-id endpoint, so we pull the request history and index by id.
  const [materialReqs, setMaterialReqs] = useState<Record<number, any>>({});
  // Reassign picker — opens over whichever card's Reassign button was tapped,
  // in either the Team Jobs or Needs Attention tab.
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignTask, setReassignTask] = useState<any>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Fetch linked material-request details for any Material-Delay rejection once
  // the Needs Attention tab is opened (only then are they on screen).
  useEffect(() => {
    if (activeTab !== 2) {
      return;
    }
    const delayJobs = tasks.filter(
      t =>
        t.status === 'rejected' &&
        t.rejectionCategory === 'MATERIAL_DELAY' &&
        t.linkedMaterialRequestId != null,
    );
    if (delayJobs.length === 0) {
      return;
    }
    const neededIds = new Set(
      delayJobs.map(t => t.linkedMaterialRequestId),
    );
    let cancelled = false;
    (async () => {
      try {
        // A technician-rejected job has its technicianId cleared server-side
        // (returned to the team-lead pool), so the request can't be scoped by
        // requester here — fetch the request history and pick out the linked
        // ones by id.
        const res = await api.get(
          '/api/inventory/material-requests/history',
        );
        const requests = res.data?.requests ?? [];
        const map: Record<number, any> = {};
        for (const r of requests) {
          if (neededIds.has(r.id)) {
            map[r.id] = r;
          }
        }
        if (!cancelled) {
          setMaterialReqs(prev => ({...prev, ...map}));
        }
      } catch {
        // Non-fatal: the card falls back to the request number the job
        // itself carries (linkedMaterialRequestNumber).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, tasks]);

  const loadData = () => {
    dispatch(checkTodaysSession());
    dispatch(fetchTeamTasks());
    dispatch(fetchTeamMembers());
    dispatch(fetchTeamStats());
    dispatch(fetchMyFaults());
  };

  const myTasks = tasks.filter(
    t => t.technicianId === user?.id,
  );

  const stats = teamStats || {
    totalJobs: tasks.length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    avgTime: 2.5,
    completionRate: 0,
  };

  const handleBODPress = () => {
    navigation.navigate('BOD');
  };

  const handleReassignPress = (task: any) => {
    setReassignTask(task);
    setShowReassignModal(true);
  };

  // Reassign the selected job to another technician via
  // POST /api/jobs/{id}/reassign (assignTask thunk). The backend requires the
  // new technician to be in this team's active session today, which is exactly
  // what teamMembers holds — so the picker lists those. On success the job's
  // status resets to PENDING, so a full refresh drops it out of the Needs
  // Attention queue and moves it in Team Jobs.
  const handleReassignConfirm = (member: any) => {
    const target = reassignTask;
    if (!target) {
      return;
    }
    const techName = member.fullName || member.name || member.username || 'technician';
    Alert.alert(
      'Reassign Job',
      `Reassign Task #${target.id} to ${techName}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reassign',
          onPress: async () => {
            setShowReassignModal(false);
            try {
              await dispatch(
                assignTask({
                  id: String(target.id),
                  technicianId: String(member.id),
                }),
              ).unwrap();
              loadData();
              Alert.alert('Success', `Task #${target.id} reassigned to ${techName}`);
            } catch (error: any) {
              Alert.alert(
                'Error',
                error || 'Failed to reassign task. Please try again.',
              );
            } finally {
              setReassignTask(null);
            }
          },
        },
      ],
    );
  };

  const renderTaskCard = (task: any) => (
    <TouchableOpacity
      key={task.id}
      style={styles.taskCard}
      onPress={() =>
        navigation.navigate('PaymentSubmission', {taskId: task.id})
      }>
      {/* Task Header */}
      <View style={styles.taskHeader}>
        <View style={styles.taskHeaderLeft}>
          {activeTab === 1 && (
            <View style={styles.techAvatar}>
              <Text style={styles.techAvatarText}>
                {task.technicianName?.charAt(0) || 'T'}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.taskId}>Task #{task.id}</Text>
            {activeTab === 1 && (
              <Text style={styles.techName}>
                {task.technicianName || 'Unassigned'}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.taskHeaderRight}>
          {task.priority && (
            <View
              style={[
                styles.priorityBadge,
                {
                  backgroundColor:
                    getPriorityColor(task.priority) + '20',
                },
              ]}>
              <Text
                style={[
                  styles.priorityText,
                  {color: getPriorityColor(task.priority)},
                ]}>
                {task.priority}
              </Text>
            </View>
          )}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  getStatusColor(task.status) + '20',
              },
            ]}>
            <Text
              style={[
                styles.statusText,
                {color: getStatusColor(task.status)},
              ]}>
              {task.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Task Details */}
      <View style={styles.taskDetails}>
        {task.customerName && (
          <Text style={styles.taskDetail}>
            👤 {task.customerName}
          </Text>
        )}
        <Text style={styles.taskDetail} numberOfLines={1}>
          📍 {task.location?.address}
        </Text>
        {task.category && (
          <Text style={styles.taskDetail}>🔧 {task.category}</Text>
        )}
        <Text style={styles.taskDetail}>
          📅 {task.scheduledDate}
        </Text>
      </View>

      {/* Rejection reason banner */}
      {task.rejectionReason && (
        <View style={styles.rejectionBanner}>
          <Text style={styles.rejectionBannerText}>
            ❌ {task.rejectedByRole === 'TECHNICIAN' ? 'Technician rejected' : 'Rejected'}: {task.rejectionReason}
          </Text>
        </View>
      )}

      {/* Action Buttons for Team Jobs tab */}
      {activeTab === 1 && (
        <View style={styles.taskActions}>
          <TouchableOpacity
            style={styles.reassignButton}
            onPress={() => handleReassignPress(task)}>
            <Text style={styles.reassignButtonText}>
              🔄 Reassign
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.viewButton}>
            <Text style={styles.viewButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Payment Button for completed tasks */}
      {task.status === 'completed' && (
        <TouchableOpacity
          style={styles.paymentButton}
          onPress={() =>
            navigation.navigate('PaymentSubmission', {
              taskId: task.id,
            })
          }>
          <Text style={styles.paymentButtonText}>
            💰 Submit Payment
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const renderAttentionCard = (task: any, sectionKey: string) => {
    const linkedReq =
      task.linkedMaterialRequestId != null
        ? materialReqs[task.linkedMaterialRequestId]
        : null;
    const reqNumber = linkedReq?.requestNumber || task.linkedMaterialRequestNumber;
    return (
      <View key={task.id} style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <View style={styles.taskHeaderLeft}>
            <View style={styles.techAvatar}>
              <Text style={styles.techAvatarText}>
                {task.technicianName?.charAt(0) || 'T'}
              </Text>
            </View>
            <View>
              <Text style={styles.taskId}>Task #{task.id}</Text>
              <Text style={styles.techName}>
                {task.technicianName || 'Unassigned'}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              {backgroundColor: getStatusColor(task.status) + '20'},
            ]}>
            <Text
              style={[
                styles.statusText,
                {color: getStatusColor(task.status)},
              ]}>
              {task.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.taskDetails}>
          {task.customerName && (
            <Text style={styles.taskDetail}>👤 {task.customerName}</Text>
          )}
          <Text style={styles.taskDetail} numberOfLines={1}>
            📍 {task.location?.address}
          </Text>
        </View>

        {/* Free-text reason (technician's note), when present */}
        {task.rejectionReason && (
          <View style={styles.rejectionBanner}>
            <Text style={styles.rejectionBannerText}>❌ {task.rejectionReason}</Text>
          </View>
        )}

        {/* Category-specific context */}
        {sectionKey === 'ISSUE_MISMATCH' && task.observedIssueType && (
          <View style={styles.contextBox}>
            <Text style={styles.contextLabel}>Observed issue type</Text>
            <Text style={styles.contextValue}>
              {OBSERVED_ISSUE_LABELS[task.observedIssueType] ||
                task.observedIssueType}
            </Text>
          </View>
        )}

        {sectionKey === 'MATERIAL_DELAY' && (
          <View style={styles.contextBox}>
            <Text style={styles.contextLabel}>Linked material request</Text>
            {reqNumber ? (
              <Text style={styles.contextValue}>
                {reqNumber}
                {linkedReq
                  ? ` · ${linkedReq.status} · ${linkedReq.totalItems} item${
                      linkedReq.totalItems === 1 ? '' : 's'
                    }`
                  : ''}
                {linkedReq?.submittedTimeAgo
                  ? ` · ${linkedReq.submittedTimeAgo}`
                  : ''}
              </Text>
            ) : (
              <Text style={styles.contextValue}>No linked request</Text>
            )}
          </View>
        )}

        {sectionKey === 'EOD_HANDOVER' && (
          <View style={styles.contextBox}>
            <Text style={styles.contextLabel}>EOD handover reason</Text>
            <Text style={styles.contextValue}>{task.eodHandoverReason}</Text>
            {task.eodHandoverAt && (
              <Text style={styles.contextMeta}>
                Handed over {new Date(task.eodHandoverAt).toLocaleString()}
              </Text>
            )}
          </View>
        )}

        <View style={styles.taskActions}>
          <TouchableOpacity
            style={styles.reassignButton}
            onPress={() => handleReassignPress(task)}>
            <Text style={styles.reassignButtonText}>🔄 Reassign</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderNeedsAttention = () => {
    const attentionTasks = tasks.filter(
      t =>
        (t.status === 'rejected' && t.rejectionCategory) ||
        t.eodHandoverReason != null,
    );
    if (attentionTasks.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyText}>No jobs need attention</Text>
        </View>
      );
    }
    return ATTENTION_SECTIONS.map(section => {
      const items = attentionTasks.filter(section.match);
      if (items.length === 0) {
        return null;
      }
      return (
        <View key={section.key} style={styles.attentionSection}>
          <Text style={styles.attentionSectionTitle}>
            {section.icon} {section.title} ({items.length})
          </Text>
          {items.map(t => renderAttentionCard(t, section.key))}
        </View>
      );
    });
  };

  const renderTeamMap = () => (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: 6.9271,
          longitude: 79.8612,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}>
        {teamMembers.map(member =>
          member.location ? (
            <Marker
              key={member.id}
              coordinate={{
                latitude: member.location.latitude,
                longitude: member.location.longitude,
              }}
              title={member.fullName || member.name || 'Member'}
              description={`Status: ${
                member.currentJobStatus || 'Available'
              }`}>
              <View style={styles.memberMarker}>
                <Text style={styles.memberMarkerText}>
                  {(member.fullName || member.name || 'U').charAt(0)}
                </Text>
              </View>
            </Marker>
          ) : null,
        )}
      </MapView>

      {/* Full Map Button */}
      <TouchableOpacity
        style={styles.fullMapButton}
        onPress={() => navigation.navigate('TeamMap')}>
        <Text style={styles.fullMapButtonText}>
          🗺️ Open Full Map
        </Text>
      </TouchableOpacity>

      {/* Team Member List Overlay */}
      <View style={styles.memberListOverlay}>
        <Text style={styles.memberListTitle}>
          Team Members ({teamMembers.length})
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}>
          {teamMembers.map(member => {
            const mName = member.fullName || member.name || member.username || 'Member';
            return (
            <View key={member.id} style={styles.memberChip}>
              <View style={styles.memberChipAvatar}>
                <Text style={styles.memberChipAvatarText}>
                  {mName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.memberChipName} numberOfLines={1}>
                {mName.split(' ')[0]}
              </Text>
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
            </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 0:
        return myTasks.length > 0 ? (
          myTasks.map(renderTaskCard)
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>
              No jobs assigned to you
            </Text>
          </View>
        );
      case 1:
        return tasks.length > 0 ? (
          tasks.map(renderTaskCard)
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>No team jobs found</Text>
          </View>
        );
      case 2:
        return renderNeedsAttention();
      case 3:
        return renderTeamMap();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            Team Lead Dashboard
          </Text>
          <Text style={styles.headerSubtitle}>
            {user?.name || 'Team Lead'}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          {/* Map Button */}
          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => navigation.navigate('TeamMap')}>
            <Text style={styles.mapButtonText}>🗺️ Map</Text>
          </TouchableOpacity>
          {/* BOD / EOD / Assign Buttons */}
          {isDayCompleted ? (
            <>
              <TouchableOpacity
                style={styles.requestsButton}
                onPress={() => navigation.navigate('TeamMaterialRequests')}>
                <Text style={styles.bodButtonText}>📦 Requests</Text>
              </TouchableOpacity>
              <View style={styles.dayCompletedBadge}>
                <Text style={styles.dayCompletedBadgeText}>✅ Day Completed</Text>
              </View>
            </>
          ) : hasBODToday ? (
            <>
              <TouchableOpacity
                style={styles.assignButton}
                onPress={() => navigation.navigate('AssignJobs')}>
                <Text style={styles.bodButtonText}>📋 Assign</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.requestsButton}
                onPress={() => navigation.navigate('TeamMaterialRequests')}>
                <Text style={styles.bodButtonText}>📦 Requests</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.eodButton}
                onPress={() => navigation.navigate('EOD')}>
                <Text style={styles.bodButtonText}>🌆 EOD</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.bodButton}
              onPress={handleBODPress}>
              <Text style={styles.bodButtonText}>📋 Start BOD</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isDayCompleted && (
        <View style={styles.dayCompletedBanner}>
          <Text style={styles.dayCompletedBannerText}>
            BOD/EOD already done for today
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadData}
          />
        }>
        {/* KPI Cards */}
        <View style={styles.kpiContainer}>
          <View
            style={[
              styles.kpiCard,
              {backgroundColor: colors.primary},
            ]}>
            <Text style={styles.kpiValue}>{stats.totalJobs}</Text>
            <Text style={styles.kpiLabel}>Total Jobs</Text>
          </View>
          <View
            style={[
              styles.kpiCard,
              {backgroundColor: colors.warning},
            ]}>
            <Text style={styles.kpiValue}>{stats.inProgress}</Text>
            <Text style={styles.kpiLabel}>In Progress</Text>
          </View>
          <View
            style={[
              styles.kpiCard,
              {backgroundColor: colors.success},
            ]}>
            <Text style={styles.kpiValue}>{stats.completed}</Text>
            <Text style={styles.kpiLabel}>Completed</Text>
          </View>
          <View
            style={[
              styles.kpiCard,
              {backgroundColor: colors.secondary},
            ]}>
            <Text style={styles.kpiValue}>
              {(stats.avgTime ?? 0).toFixed(1)}h
            </Text>
            <Text style={styles.kpiLabel}>Avg Time</Text>
          </View>
        </View>

        {/* Performance Widget */}
        {stats.completionRate > 0 && (
          <View style={styles.performanceCard}>
            <Text style={styles.performanceTitle}>
              Team Performance Today
            </Text>
            <View style={styles.performanceBar}>
              <View
                style={[
                  styles.performanceFill,
                  {width: `${stats.completionRate}%`},
                ]}
              />
            </View>
            <Text style={styles.performanceText}>
              {(stats.completionRate ?? 0).toFixed(0)}% Completion Rate
            </Text>
          </View>
        )}

        {/* Team Members Summary */}
        {teamMembers.length > 0 && (
          <View style={styles.teamSummaryCard}>
            <Text style={styles.teamSummaryTitle}>
              Team Members ({teamMembers.length})
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}>
              {teamMembers.map(member => {
                const mName = member.fullName || member.name || member.username || 'Member';
                return (
                <View key={member.id} style={styles.memberCard}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {mName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={styles.memberName}
                    numberOfLines={1}>
                    {mName.split(' ')[0]}
                  </Text>
                  <Text style={styles.memberJobs}>
                    {member.completedToday}/{member.totalJobs} jobs
                  </Text>
                  <View
                    style={[
                      styles.memberStatusBadge,
                      {
                        backgroundColor:
                          member.status === 'ACTIVE'
                            ? colors.success + '20'
                            : colors.error + '20',
                      },
                    ]}>
                    <Text
                      style={[
                        styles.memberStatusText,
                        {
                          color:
                            member.status === 'ACTIVE'
                              ? colors.success
                              : colors.error,
                        },
                      ]}>
                      {member.status}
                    </Text>
                  </View>
                </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab, index) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                activeTab === index && styles.tabActive,
              ]}
              onPress={() => setActiveTab(index)}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === index && styles.tabTextActive,
                ]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {renderTabContent()}
        </View>
      </ScrollView>

      {/* Reassign Modal — pick a technician from this team's active session */}
      <Modal
        visible={showReassignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReassignModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Reassign Task #{reassignTask?.id}
              </Text>
              <TouchableOpacity onPress={() => setShowReassignModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.reassignSubtitle}>
              Select a technician from today's active session to reassign this
              job:
            </Text>
            <ScrollView style={styles.modalContent}>
              {teamMembers.length === 0 ? (
                <Text style={styles.emptyText}>
                  No technicians in today's session.
                </Text>
              ) : (
                teamMembers.map(member => {
                  const mName =
                    member.fullName ||
                    member.name ||
                    member.username ||
                    'Technician';
                  const isCurrent =
                    String(member.id) === String(reassignTask?.technicianId);
                  return (
                    <TouchableOpacity
                      key={member.id}
                      style={[
                        styles.memberOption,
                        isCurrent && styles.memberOptionCurrent,
                      ]}
                      onPress={() => handleReassignConfirm(member)}>
                      <View style={styles.memberOptionAvatar}>
                        <Text style={styles.memberOptionAvatarText}>
                          {mName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.memberOptionInfo}>
                        <Text style={styles.memberOptionName}>{mName}</Text>
                        <Text style={styles.memberOptionJobs}>
                          {member.completedToday}/{member.totalJobs} jobs today
                          {isCurrent ? ' · current' : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
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
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
  },
  headerButtons: {
    gap: spacing.xs,
    alignItems: 'flex-end',
  },
  mapButton: {
    backgroundColor: colors.white + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  mapButtonText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.medium,
  },
  bodButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  assignButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  requestsButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  eodButton: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  bodButtonText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  dayCompletedBadge: {
    backgroundColor: colors.success + '30',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  dayCompletedBadgeText: {
    color: colors.success,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  dayCompletedBanner: {
    backgroundColor: colors.success + '15',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.success + '40',
  },
  dayCompletedBannerText: {
    color: colors.success,
    fontSize: typography.xs,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  kpiContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 10,
    padding: spacing.sm,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  kpiLabel: {
    fontSize: 9,
    color: colors.white,
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.9,
  },
  performanceCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 8,
    padding: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  performanceTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  performanceBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  performanceFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 4,
  },
  performanceText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  teamSummaryCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 8,
    padding: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  teamSummaryTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  memberCard: {
    alignItems: 'center',
    marginRight: spacing.md,
    width: 80,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  memberAvatarText: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.white,
  },
  memberName: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  memberJobs: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  memberStatusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  memberStatusText: {
    fontSize: 9,
    fontWeight: typography.bold,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    borderRadius: 8,
    padding: spacing.xs,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  tabTextActive: {
    color: colors.white,
    fontWeight: typography.bold,
  },
  tabContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  taskCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
  techAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  techAvatarText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  taskId: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  techName: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  taskHeaderRight: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
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
  taskDetails: {
    gap: 4,
    marginBottom: spacing.sm,
  },
  taskDetail: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  taskActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  rejectionBanner: {
    backgroundColor: colors.error + '15',
    borderRadius: 6,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  attentionSection: {
    marginBottom: spacing.md,
  },
  attentionSectionTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  contextBox: {
    backgroundColor: colors.background,
    borderRadius: 6,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  contextLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  contextValue: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  contextMeta: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rejectionBannerText: {
    color: colors.error,
    fontSize: typography.xs,
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
    color: colors.primary,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  viewButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  viewButtonText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  paymentButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  paymentButtonText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  mapContainer: {
    height: 400,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  fullMapButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  fullMapButtonText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  memberListOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: spacing.md,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  memberListTitle: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  memberChip: {
    alignItems: 'center',
    marginRight: spacing.md,
    width: 60,
  },
  memberChipAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberChipAvatarText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  memberChipName: {
    fontSize: typography.xs,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  memberStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 2,
  },
  memberMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  memberMarkerText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    textAlign: 'center',
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
});

export default TeamLeadHomeScreen;