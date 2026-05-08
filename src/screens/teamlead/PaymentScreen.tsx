import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TeamLeadStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppSelector} from '@store/hooks';

type PaymentNavigationProp = StackNavigationProp<TeamLeadStackParamList>;

const PaymentScreen = () => {
  const navigation = useNavigation<PaymentNavigationProp>();
  const {tasks} = useAppSelector(state => state.technician);

  const completedTasks = tasks.filter(
    t => t.status === 'completed',
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payments</Text>
        <Text style={styles.headerSubtitle}>
          Manage payment submissions
        </Text>
      </View>

      <View style={styles.content}>
        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[
              styles.actionCard,
              {backgroundColor: colors.primary},
            ]}
            onPress={() => navigation.navigate('PaymentHistory')}>
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionTitle}>Payment History</Text>
            <Text style={styles.actionSubtitle}>
              View all submissions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionCard,
              {backgroundColor: colors.success},
            ]}
            onPress={() => {
              if (completedTasks.length > 0) {
                navigation.navigate('PaymentSubmission', {
                  taskId: completedTasks[0].id,
                });
              }
            }}>
            <Text style={styles.actionIcon}>💰</Text>
            <Text style={styles.actionTitle}>New Submission</Text>
            <Text style={styles.actionSubtitle}>
              Submit payment
            </Text>
          </TouchableOpacity>
        </View>

        {/* Completed Tasks Pending Payment */}
        <Text style={styles.sectionTitle}>
          Pending Submissions ({completedTasks.length})
        </Text>
        {completedTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>
              No pending submissions
            </Text>
          </View>
        ) : (
          completedTasks.map(task => (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.taskInfo}>
                <Text style={styles.taskId}>Task #{task.id}</Text>
                <Text style={styles.taskCustomer}>
                  👤 {task.customerName || 'Customer'}
                </Text>
                <Text style={styles.taskAddress} numberOfLines={1}>
                  📍 {task.location?.address}
                </Text>
                <Text style={styles.taskDate}>
                  📅 {task.scheduledDate}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={() =>
                  navigation.navigate('PaymentSubmission', {
                    taskId: task.id,
                  })
                }>
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          ))
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
  headerSubtitle: {
    fontSize: typography.md,
    color: colors.white,
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionCard: {
    flex: 1,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  actionTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.white,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: typography.xs,
    color: colors.white,
    opacity: 0.8,
    marginTop: 2,
    textAlign: 'center',
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.xl,
    alignItems: 'center',
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.lg,
    color: colors.textSecondary,
  },
  taskCard: {
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
  taskInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  taskId: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  taskCustomer: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  taskAddress: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  taskDate: {
    fontSize: typography.xs,
    color: colors.textLight,
  },
  submitButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
});

export default PaymentScreen;