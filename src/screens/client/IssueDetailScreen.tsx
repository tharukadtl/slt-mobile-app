import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {ClientStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {fetchIssueById} from '@store/slices/issueSlice';

type IssueDetailRouteProp = RouteProp<ClientStackParamList, 'IssueDetail'>;

const IssueDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<IssueDetailRouteProp>();
  const dispatch = useAppDispatch();
  const {selectedIssue, isLoading} = useAppSelector(state => state.issues);
  const {issueId} = route.params;

  useEffect(() => {
    dispatch(fetchIssueById(issueId));
  }, [issueId]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!selectedIssue) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Issue not found</Text>
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
    {label: 'Issue Reported', status: 'pending', done: true},
    {label: 'Technician Assigned', status: 'assigned',
      done: ['assigned', 'in_progress', 'completed'].includes(selectedIssue.status)},
    {label: 'Work In Progress', status: 'in_progress',
      done: ['in_progress', 'completed'].includes(selectedIssue.status)},
    {label: 'Issue Resolved', status: 'completed',
      done: selectedIssue.status === 'completed'},
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Issue Details</Text>
        <Text style={styles.issueId}>#{selectedIssue.id}</Text>
      </View>

      <View style={styles.content}>
        {/* Status */}
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

        {/* Issue Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Issue Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Title</Text>
            <Text style={styles.infoValue}>{selectedIssue.title}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Category</Text>
            <Text style={styles.infoValue}>
              {selectedIssue.category.toUpperCase()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Description</Text>
            <Text style={styles.infoValue}>{selectedIssue.description}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address</Text>
            <Text style={styles.infoValue}>
              {selectedIssue.location.address}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reported On</Text>
            <Text style={styles.infoValue}>{selectedIssue.createdAt}</Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status Timeline</Text>
          {timelineSteps.map((step, index) => (
            <View key={index} style={styles.timelineItem}>
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
      </View>
    </ScrollView>
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
    alignItems: 'center',
    marginBottom: spacing.md,
    position: 'relative',
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.border,
    marginRight: spacing.md,
  },
  timelineDotDone: {
    backgroundColor: colors.success,
  },
  timelineLine: {
    position: 'absolute',
    left: 7,
    top: 16,
    width: 2,
    height: 24,
    backgroundColor: colors.border,
  },
  timelineLineDone: {
    backgroundColor: colors.success,
  },
  timelineLabel: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  timelineLabelDone: {
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
});

export default IssueDetailScreen;