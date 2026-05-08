import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import {useNavigation, useRoute, RouteProp, useFocusEffect} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {ClientStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {fetchIssueById, cancelIssue} from '@store/slices/issueSlice';
import CancelIssueModal from '@components/common/CancelIssueModal';

type IssueDetailRouteProp = RouteProp<ClientStackParamList, 'IssueDetail'>;
type IssueDetailNavigationProp = StackNavigationProp<ClientStackParamList>;

const IssueDetailScreen = () => {
  const navigation = useNavigation<IssueDetailNavigationProp>();
  const route = useRoute<IssueDetailRouteProp>();
  const dispatch = useAppDispatch();
  const {selectedIssue, isLoading} = useAppSelector(state => state.issues);
  const {issueId} = route.params;
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Re-fetch every time this screen is focused so status updates from
  // the technician completing the job are reflected without manual refresh
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchIssueById(issueId));
    }, [issueId, dispatch]),
  );

  const handleCancelIssue = async (reason: string) => {
    const result = await dispatch(
      cancelIssue({id: issueId, reason}),
    );
    if (cancelIssue.fulfilled.match(result)) {
      setShowCancelModal(false);
      Alert.alert(
        'Issue Cancelled',
        'Your issue has been cancelled successfully.',
        [{text: 'OK', onPress: () => navigation.goBack()}],
      );
    } else {
      Alert.alert(
        'Error',
        (result.payload as string) || 'Failed to cancel issue',
      );
    }
  };

  if (isLoading && !selectedIssue) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!selectedIssue) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.notFoundText}>Issue not found</Text>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return colors.warning;
      case 'assigned': return colors.info;
      case 'in_progress': return colors.secondary;
      case 'completed': return colors.success;
      case 'cancelled': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const timelineSteps = [
    {
      label: 'Issue Reported',
      status: 'pending',
      done: true,
    },
    {
      label: 'Technician Assigned',
      status: 'assigned',
      done: ['assigned', 'in_progress', 'completed'].includes(
        selectedIssue.status,
      ),
    },
    {
      label: 'Work In Progress',
      status: 'in_progress',
      done: ['in_progress', 'completed'].includes(selectedIssue.status),
    },
    {
      label: 'Issue Resolved',
      status: 'completed',
      done: selectedIssue.status === 'completed',
    },
  ];

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => dispatch(fetchIssueById(issueId))}
          />
        }>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Issue Details</Text>
          <Text style={styles.issueId}>#{selectedIssue.id}</Text>
        </View>

        <View style={styles.content}>
          {/* Status Badge */}
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    getStatusColor(selectedIssue.status) + '20',
                },
              ]}>
              <Text
                style={[
                  styles.statusText,
                  {color: getStatusColor(selectedIssue.status)},
                ]}>
                {selectedIssue.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Resolution banner — shown once the fault is completed */}
          {selectedIssue.status === 'completed' && (
            <View style={styles.resolvedBanner}>
              <Text style={styles.resolvedBannerIcon}>✅</Text>
              <View style={styles.resolvedBannerText}>
                <Text style={styles.resolvedBannerTitle}>Fault Resolved</Text>
                {selectedIssue.completedAt && (
                  <Text style={styles.resolvedBannerSub}>
                    Completed on {new Date(selectedIssue.completedAt).toLocaleString()}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Issue Info Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Issue Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Ref #</Text>
              <Text style={styles.infoValue}>
                {selectedIssue.faultNumber ?? selectedIssue.id}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Category</Text>
              <Text style={styles.infoValue}>
                {selectedIssue.category.toUpperCase()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Description</Text>
              <Text style={styles.infoValue}>
                {selectedIssue.description}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>
                {selectedIssue.location.address}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Reported On</Text>
              <Text style={styles.infoValue}>
                {new Date(selectedIssue.createdAt).toLocaleString()}
              </Text>
            </View>
            {selectedIssue.assignedTeamLeadName && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Assigned To</Text>
                <Text style={styles.infoValue}>
                  {selectedIssue.assignedTeamLeadName}
                </Text>
              </View>
            )}
            {selectedIssue.causeOfFault && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Cause</Text>
                <Text style={styles.infoValue}>
                  {selectedIssue.causeOfFault}
                </Text>
              </View>
            )}
            {selectedIssue.completionRemarks && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Remarks</Text>
                <Text style={styles.infoValue}>
                  {selectedIssue.completionRemarks}
                </Text>
              </View>
            )}
          </View>

          {/* Timeline Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Status Timeline</Text>
            {timelineSteps.map((step, index) => (
              <View key={index} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View
                    style={[
                      styles.timelineDot,
                      step.done && styles.timelineDotDone,
                    ]}
                  />
                  {index < timelineSteps.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        step.done && styles.timelineLineDone,
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.timelineLabel,
                    step.done && styles.timelineLabelDone,
                  ]}>
                  {step.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Track Technician Button */}
          {(selectedIssue.status === 'assigned' ||
            selectedIssue.status === 'in_progress') && (
            <TouchableOpacity
              style={styles.trackButton}
              onPress={() =>
                navigation.navigate('TechnicianTracking', {
                  issueId: selectedIssue.id,
                })
              }>
              <Text style={styles.trackButtonText}>
                📍 Track Technician
              </Text>
            </TouchableOpacity>
          )}

          {/* View Bill Button */}
          {selectedIssue.status === 'completed' && (
            <TouchableOpacity
              style={styles.billButton}
              onPress={() => navigation.navigate('BillingHistory')}>
              <Text style={styles.billButtonText}>💰 View Bill</Text>
            </TouchableOpacity>
          )}

          {/* Cancel Button - only for pending issues */}
          {selectedIssue.status === 'pending' && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowCancelModal(true)}>
              <Text style={styles.cancelButtonText}>
                ✕ Cancel Issue
              </Text>
            </TouchableOpacity>
          )}

          {/* Cancelled Notice */}
          {selectedIssue.status === 'cancelled' && (
            <View style={styles.cancelledNotice}>
              <Text style={styles.cancelledIcon}>❌</Text>
              <Text style={styles.cancelledText}>
                This issue has been cancelled
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Cancel Modal */}
      <CancelIssueModal
        visible={showCancelModal}
        issueId={issueId}
        onConfirm={handleCancelIssue}
        onClose={() => setShowCancelModal(false)}
        isLoading={isLoading}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: typography.lg,
    color: colors.textSecondary,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  backText: {
    color: colors.white,
    fontSize: typography.md,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  issueId: {
    fontSize: typography.md,
    color: colors.white,
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.lg,
  },
  resolvedBanner: {
    backgroundColor: colors.success + '20',
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success + '50',
  },
  resolvedBannerIcon: {
    fontSize: 28,
  },
  resolvedBannerText: {
    flex: 1,
  },
  resolvedBannerTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.success,
  },
  resolvedBannerSub: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusContainer: {
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 4,
  },
  statusText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  card: {
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
  cardTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  infoLabel: {
    width: 100,
    fontSize: typography.md,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  infoValue: {
    flex: 1,
    fontSize: typography.md,
    color: colors.textPrimary,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: spacing.md,
    width: 20,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  timelineDotDone: {
    backgroundColor: colors.success,
  },
  timelineLine: {
    width: 2,
    height: 24,
    backgroundColor: colors.border,
    marginTop: 2,
  },
  timelineLineDone: {
    backgroundColor: colors.success,
  },
  timelineLabel: {
    fontSize: typography.md,
    color: colors.textSecondary,
    paddingTop: 2,
  },
  timelineLabelDone: {
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  trackButton: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  trackButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  billButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  billButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  cancelButton: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error,
  },
  cancelButtonText: {
    color: colors.error,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  cancelledNotice: {
    backgroundColor: colors.error + '15',
    borderRadius: 8,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  cancelledIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  cancelledText: {
    fontSize: typography.md,
    color: colors.error,
    fontWeight: typography.medium,
  },
});

export default IssueDetailScreen;