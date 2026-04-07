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
import {StackNavigationProp} from '@react-navigation/stack';
import {TechnicianStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {fetchTasks, updateTaskStatus} from '@store/slices/technicianSlice';

type TaskDetailRouteProp = RouteProp<TechnicianStackParamList, 'TaskDetail'>;
type TaskDetailNavigationProp = StackNavigationProp<TechnicianStackParamList>;

const TaskDetailScreen = () => {
  const navigation = useNavigation<TaskDetailNavigationProp>();
  const route = useRoute<TaskDetailRouteProp>();
  const dispatch = useAppDispatch();
  const {tasks, isLoading} = useAppSelector(state => state.technician);
  const {taskId} = route.params;

  const task = tasks.find(t => t.id === taskId);

  useEffect(() => {
    if (!task) dispatch(fetchTasks());
  }, [taskId]);

  if (isLoading || !task) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const handleAccept = () => {
    dispatch(updateTaskStatus({taskId: task.id, status: 'accepted'}));
  };

  const handleStartTravel = () => {
    navigation.navigate('Navigation', {taskId: task.id});
    dispatch(updateTaskStatus({taskId: task.id, status: 'travelling'}));
  };

  const handleStartWork = () => {
    dispatch(updateTaskStatus({taskId: task.id, status: 'in_progress'}));
    navigation.navigate('UpdateStatus', {taskId: task.id});
  };

  const handleComplete = () => {
    navigation.navigate('Signature', {taskId: task.id});
  };

  const getActionButton = () => {
    switch (task.status) {
      case 'assigned':
        return (
          <TouchableOpacity style={styles.actionButton} onPress={handleAccept}>
            <Text style={styles.actionButtonText}>Accept Task</Text>
          </TouchableOpacity>
        );
      case 'accepted':
        return (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleStartTravel}>
            <Text style={styles.actionButtonText}>Start Navigation</Text>
          </TouchableOpacity>
        );
      case 'travelling':
        return (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleStartWork}>
            <Text style={styles.actionButtonText}>Start Work</Text>
          </TouchableOpacity>
        );
      case 'in_progress':
        return (
          <TouchableOpacity
            style={[styles.actionButton, {backgroundColor: colors.success}]}
            onPress={handleComplete}>
            <Text style={styles.actionButtonText}>Complete Task</Text>
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task Details</Text>
        <Text style={styles.taskId}>Task #{task.id}</Text>
      </View>

      <View style={styles.content}>
        {/* Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status</Text>
          <Text style={styles.statusText}>
            {task.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>

        {/* Location */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location</Text>
          <Text style={styles.infoText}>📍 {task.location.address}</Text>
          <TouchableOpacity
            style={styles.navigationButton}
            onPress={handleStartTravel}>
            <Text style={styles.navigationButtonText}>Open Navigation</Text>
          </TouchableOpacity>
        </View>

        {/* Schedule */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Schedule</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{task.scheduledDate}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Duration</Text>
            <Text style={styles.infoValue}>
              {task.estimatedDuration} minutes
            </Text>
          </View>
        </View>

        {/* Materials */}
        <TouchableOpacity
          style={styles.card}
          onPress={() =>
            navigation.navigate('Materials', {taskId: task.id})
          }>
          <Text style={styles.cardTitle}>Materials Used →</Text>
          <Text style={styles.infoText}>
            {task.materials?.length || 0} materials recorded
          </Text>
        </TouchableOpacity>

        {/* Action Button */}
        {getActionButton()}
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
  taskId: {
    fontSize: typography.md,
    color: colors.white,
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.lg,
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
    marginBottom: spacing.sm,
  },
  statusText: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  infoText: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  infoLabel: {
    width: 80,
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  infoValue: {
    flex: 1,
    fontSize: typography.md,
    color: colors.textPrimary,
  },
  navigationButton: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  navigationButtonText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.medium,
  },
  actionButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
});

export default TaskDetailScreen;