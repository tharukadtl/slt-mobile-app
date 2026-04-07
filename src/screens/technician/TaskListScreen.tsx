import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TechnicianStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {fetchTasks} from '@store/slices/technicianSlice';

type TaskListNavigationProp = StackNavigationProp<TechnicianStackParamList>;

const TaskListScreen = () => {
  const navigation = useNavigation<TaskListNavigationProp>();
  const dispatch = useAppDispatch();
  const {tasks, isLoading} = useAppSelector(state => state.technician);

  useEffect(() => {
    dispatch(fetchTasks());
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return colors.warning;
      case 'accepted': return colors.info;
      case 'travelling': return colors.secondary;
      case 'in_progress': return colors.accent;
      case 'completed': return colors.success;
      default: return colors.textSecondary;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Tasks</Text>
        <Text style={styles.headerSubtitle}>
          {tasks.length} total tasks
        </Text>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => dispatch(fetchTasks())}
          />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.taskCard}
            onPress={() =>
              navigation.navigate('TaskDetail', {taskId: item.id})
            }>
            <View style={styles.taskHeader}>
              <Text style={styles.taskId}>Task #{item.id}</Text>
              <View
                style={[
                  styles.statusBadge,
                  {backgroundColor: getStatusColor(item.status) + '20'},
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
            <Text style={styles.taskAddress}>
              📍 {item.location.address}
            </Text>
            <View style={styles.taskFooter}>
              <Text style={styles.taskDate}>{item.scheduledDate}</Text>
              <Text style={styles.taskDuration}>
                ⏱ {item.estimatedDuration} mins
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No tasks assigned</Text>
          </View>
        }
      />
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
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
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
  listContent: {
    padding: spacing.lg,
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
  taskId: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
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
  taskAddress: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taskDate: {
    fontSize: typography.xs,
    color: colors.textLight,
  },
  taskDuration: {
    fontSize: typography.xs,
    color: colors.textLight,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: typography.lg,
    color: colors.textSecondary,
  },
});

export default TaskListScreen;