import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  TextInput,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {ClientStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {fetchIssues} from '@store/slices/issueSlice';
import {Issue} from '@appTypes/issue.types';
import {formatDate} from '@utils/formatters';

type IssueHistoryNavigationProp =
  StackNavigationProp<ClientStackParamList>;

const STATUS_FILTERS = [
  {label: 'All', value: 'ALL'},
  {label: 'Completed', value: 'completed'},
  {label: 'Cancelled', value: 'cancelled'},
];

const CATEGORY_FILTERS = [
  {label: 'All', value: 'ALL'},
  {label: '🌐 Broadband', value: 'broadband'},
  {label: '📞 Telephone', value: 'telephone'},
  {label: '🔌 Fiber', value: 'fiber'},
  {label: '📺 Television', value: 'television'},
  {label: '🔧 Other', value: 'other'},
];

const CATEGORY_ICONS: Record<string, string> = {
  broadband: '🌐',
  telephone: '📞',
  fiber: '🔌',
  television: '📺',
  other: '🔧',
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return colors.success;
    case 'cancelled': return colors.error;
    default: return colors.textSecondary;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return '✅';
    case 'cancelled': return '❌';
    default: return '📋';
  }
};

const IssueHistoryScreen = () => {
  const navigation =
    useNavigation<IssueHistoryNavigationProp>();
  const dispatch = useAppDispatch();
  const {issues, isLoading} = useAppSelector(
    state => state.issues,
  );

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    dispatch(fetchIssues());
  }, []);

  // Only show history (completed/cancelled)
  const historyIssues = issues.filter(
    i => i.status === 'completed' || i.status === 'cancelled',
  );

  const filteredIssues = historyIssues.filter(issue => {
    const matchesStatus =
      statusFilter === 'ALL' || issue.status === statusFilter;
    const matchesCategory =
      categoryFilter === 'ALL' ||
      issue.category === categoryFilter;
    const matchesSearch =
      searchText === '' ||
      issue.id.includes(searchText) ||
      issue.title
        .toLowerCase()
        .includes(searchText.toLowerCase()) ||
      issue.location?.address
        ?.toLowerCase()
        .includes(searchText.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const completedCount = historyIssues.filter(
    i => i.status === 'completed',
  ).length;
  const cancelledCount = historyIssues.filter(
    i => i.status === 'cancelled',
  ).length;

  const renderIssueCard = ({item}: {item: Issue}) => (
    <TouchableOpacity
      style={styles.issueCard}
      onPress={() =>
        navigation.navigate('IssueDetail', {issueId: item.id})
      }>
      {/* Status Bar */}
      <View
        style={[
          styles.statusBar,
          {backgroundColor: getStatusColor(item.status)},
        ]}
      />

      <View style={styles.issueContent}>
        {/* Header */}
        <View style={styles.issueHeader}>
          <View style={styles.issueHeaderLeft}>
            <Text style={styles.categoryIcon}>
              {CATEGORY_ICONS[item.category] || '🔧'}
            </Text>
            <View>
              <Text style={styles.issueId}>#{item.id}</Text>
              <Text style={styles.issueDate}>
                📅 {formatDate(item.createdAt)}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  getStatusColor(item.status) + '20',
              },
            ]}>
            <Text style={styles.statusIcon}>
              {getStatusIcon(item.status)}
            </Text>
            <Text
              style={[
                styles.statusText,
                {color: getStatusColor(item.status)},
              ]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Title & Description */}
        <Text style={styles.issueTitle}>{item.title}</Text>
        <Text style={styles.issueDescription} numberOfLines={2}>
          {item.description}
        </Text>

        {/* Location */}
        <Text style={styles.issueLocation} numberOfLines={1}>
          📍 {item.location?.address || 'Location not set'}
        </Text>

        {/* Completed Date */}
        {item.completedAt && (
          <Text style={styles.completedDate}>
            {item.status === 'completed' ? '✅' : '❌'} Resolved:{' '}
            {formatDate(item.completedAt)}
          </Text>
        )}

        {/* Footer */}
        <View style={styles.issueFooter}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>
              {item.category.toUpperCase()}
            </Text>
          </View>
          <View style={styles.footerActions}>
            {/* View Bill Button for completed */}
            {item.status === 'completed' && (
              <TouchableOpacity
                style={styles.billButton}
                onPress={() =>
                  navigation.navigate('BillingHistory')
                }>
                <Text style={styles.billButtonText}>
                  💰 Bill
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() =>
                navigation.navigate('IssueDetail', {
                  issueId: item.id,
                })
              }>
              <Text style={styles.viewButtonText}>
                View →
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Service History</Text>
        <Text style={styles.headerSubtitle}>
          {historyIssues.length} total records
        </Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View
          style={[
            styles.summaryCard,
            {backgroundColor: colors.success},
          ]}>
          <Text style={styles.summaryValue}>
            {completedCount}
          </Text>
          <Text style={styles.summaryLabel}>Completed</Text>
        </View>
        <View
          style={[
            styles.summaryCard,
            {backgroundColor: colors.error},
          ]}>
          <Text style={styles.summaryValue}>
            {cancelledCount}
          </Text>
          <Text style={styles.summaryLabel}>Cancelled</Text>
        </View>
        <View
          style={[
            styles.summaryCard,
            {backgroundColor: colors.primary},
          ]}>
          <Text style={styles.summaryValue}>
            {historyIssues.length}
          </Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search history..."
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
        <View style={styles.filterSeparator} />
        {CATEGORY_FILTERS.map(filter => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterChip,
              categoryFilter === filter.value &&
                styles.filterChipCategoryActive,
            ]}
            onPress={() => setCategoryFilter(filter.value)}>
            <Text
              style={[
                styles.filterChipText,
                categoryFilter === filter.value &&
                  styles.filterChipTextActive,
              ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results Count */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>
          Showing {filteredIssues.length} of{' '}
          {historyIssues.length} records
        </Text>
        {(statusFilter !== 'ALL' ||
          categoryFilter !== 'ALL' ||
          searchText !== '') && (
          <TouchableOpacity
            onPress={() => {
              setStatusFilter('ALL');
              setCategoryFilter('ALL');
              setSearchText('');
            }}>
            <Text style={styles.clearFiltersText}>
              Clear Filters
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Issue List */}
      <FlatList
        data={filteredIssues}
        keyExtractor={item => item.id}
        renderItem={renderIssueCard}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => dispatch(fetchIssues())}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📜</Text>
            <Text style={styles.emptyText}>
              No history found
            </Text>
            <Text style={styles.emptySubText}>
              {historyIssues.length === 0
                ? 'Your completed and cancelled issues\nwill appear here'
                : 'Try adjusting your filters'}
            </Text>
            {(statusFilter !== 'ALL' ||
              categoryFilter !== 'ALL' ||
              searchText !== '') && (
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={() => {
                  setStatusFilter('ALL');
                  setCategoryFilter('ALL');
                  setSearchText('');
                }}>
                <Text style={styles.clearFiltersButtonText}>
                  Clear Filters
                </Text>
              </TouchableOpacity>
            )}
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
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  summaryLabel: {
    fontSize: typography.xs,
    color: colors.white,
    opacity: 0.9,
    marginTop: 2,
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
    alignItems: 'center',
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
  filterChipCategoryActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  filterChipText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  filterSeparator: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  resultsText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  clearFiltersText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: 0,
    paddingBottom: spacing.xl,
  },
  issueCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    marginBottom: spacing.md,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  statusBar: {
    width: 4,
  },
  issueContent: {
    flex: 1,
    padding: spacing.md,
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  issueHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryIcon: {
    fontSize: 24,
  },
  issueId: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  issueDate: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    gap: spacing.xs,
  },
  statusIcon: {
    fontSize: 12,
  },
  statusText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  issueTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  issueDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeightMd,
    marginBottom: spacing.xs,
  },
  issueLocation: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  completedDate: {
    fontSize: typography.xs,
    color: colors.success,
    marginBottom: spacing.sm,
    fontWeight: typography.medium,
  },
  issueFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: typography.xs,
    color: colors.primary,
    fontWeight: typography.bold,
  },
  footerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  billButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  billButtonText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  viewButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  viewButtonText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubText: {
    fontSize: typography.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeightMd,
    marginBottom: spacing.lg,
  },
  clearFiltersButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  clearFiltersButtonText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
});

export default IssueHistoryScreen;