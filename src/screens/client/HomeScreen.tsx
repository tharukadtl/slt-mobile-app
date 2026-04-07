import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {ClientStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {fetchIssues} from '@store/slices/issueSlice';

type HomeNavigationProp = StackNavigationProp<ClientStackParamList>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeNavigationProp>();
  const dispatch = useAppDispatch();
  const {user} = useAppSelector(state => state.auth);
  const {issues, isLoading} = useAppSelector(state => state.issues);

  useEffect(() => {
    dispatch(fetchIssues());
  }, []);

  const activeIssues = issues.filter(
    i => i.status !== 'completed' && i.status !== 'cancelled',
  );
  const completedThisMonth = issues.filter(
    i => i.status === 'completed',
  ).length;

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

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={() => dispatch(fetchIssues())}
        />
      }>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.nameText}>{user?.name || 'Customer'}</Text>
        </View>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0) || 'C'}
          </Text>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, {backgroundColor: colors.accent}]}>
          <Text style={styles.statNumber}>{activeIssues.length}</Text>
          <Text style={styles.statLabel}>Active Issues</Text>
        </View>
        <View style={[styles.statCard, {backgroundColor: colors.success}]}>
          <Text style={styles.statNumber}>{completedThisMonth}</Text>
          <Text style={styles.statLabel}>Completed This Month</Text>
        </View>
      </View>

      {/* Report New Issue Button */}
      <TouchableOpacity
        style={styles.reportButton}
        onPress={() => navigation.navigate('ReportIssue')}>
        <Text style={styles.reportButtonText}>+ Report New Issue</Text>
      </TouchableOpacity>

      {/* Recent Issues */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Issues</Text>
        {issues.slice(0, 5).map(issue => (
          <TouchableOpacity
            key={issue.id}
            style={styles.issueCard}
            onPress={() =>
              navigation.navigate('IssueDetail', {issueId: issue.id})
            }>
            <View style={styles.issueInfo}>
              <Text style={styles.issueId}>#{issue.id}</Text>
              <Text style={styles.issueTitle} numberOfLines={1}>
                {issue.title}
              </Text>
              <Text style={styles.issueDate}>{issue.createdAt}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                {backgroundColor: getStatusColor(issue.status) + '20'},
              ]}>
              <Text
                style={[
                  styles.statusText,
                  {color: getStatusColor(issue.status)},
                ]}>
                {issue.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {issues.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No issues reported yet</Text>
            <Text style={styles.emptySubText}>
              Tap the button above to report an issue
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
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
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: typography.md,
    color: colors.white,
    opacity: 0.8,
  },
  nameText: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  avatarPlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: typography.xxxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  statLabel: {
    fontSize: typography.sm,
    color: colors.white,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  reportButton: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  reportButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  issueCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  issueInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  issueId: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  issueTitle: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  issueDate: {
    fontSize: typography.xs,
    color: colors.textLight,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
  },
  statusText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
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
    textAlign: 'center',
  },
});

export default HomeScreen;