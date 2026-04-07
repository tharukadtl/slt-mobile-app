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
import {ClientStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {fetchIssues} from '@store/slices/issueSlice';

type HistoryNavigationProp = StackNavigationProp<ClientStackParamList>;

const IssueHistoryScreen = () => {
  const navigation = useNavigation<HistoryNavigationProp>();
  const dispatch = useAppDispatch();
  const {issues, isLoading} = useAppSelector(state => state.issues);

  useEffect(() => {
    dispatch(fetchIssues());
  }, []);

  const completedIssues = issues.filter(
    i => i.status === 'completed' || i.status === 'cancelled',
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Service History</Text>
        <Text style={styles.headerSubtitle}>
          {completedIssues.length} completed issues
        </Text>
      </View>

      <FlatList
        data={completedIssues}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => dispatch(fetchIssues())}
          />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.issueCard}
            onPress={() =>
              navigation.navigate('IssueDetail', {issueId: item.id})
            }>
            <View style={styles.issueHeader}>
              <Text style={styles.issueId}>#{item.id}</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      item.status === 'completed'
                        ? colors.success + '20'
                        : colors.error + '20',
                  },
                ]}>
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        item.status === 'completed'
                          ? colors.success
                          : colors.error,
                    },
                  ]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.issueTitle}>{item.title}</Text>
            <Text style={styles.issueCategory}>
              {item.category.toUpperCase()}
            </Text>
            <Text style={styles.issueDate}>{item.createdAt}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No history yet</Text>
            <Text style={styles.emptySubText}>
              Your completed issues will appear here
            </Text>
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
  issueCard: {
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
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  issueId: {
    fontSize: typography.sm,
    color: colors.textSecondary,
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
  issueTitle: {
    fontSize: typography.lg,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  issueCategory: {
    fontSize: typography.xs,
    color: colors.secondary,
    fontWeight: typography.medium,
    marginBottom: spacing.xs,
  },
  issueDate: {
    fontSize: typography.xs,
    color: colors.textLight,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
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
});

export default IssueHistoryScreen;