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

type IssueListNavigationProp =
  StackNavigationProp<ClientStackParamList>;

const STATUS_FILTERS = [
  {label: 'All Active', value: 'ALL'},
  {label: 'Pending', value: 'pending'},
  {label: 'Assigned', value: 'assigned'},
  {label: 'In Progress', value: 'in_progress'},
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
    case 'pending': return colors.warning;
    case 'assigned': return colors.info;
    case 'in_progress': return colors.secondary;
    case 'completed': return colors.success;
    case 'cancelled': return colors.error;
    default: return colors.textSecondary;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending': return '⏳';
    case 'assigned': return '👨‍🔧';
    case 'in_progress': return '🔧';
    case 'completed': return '✅';
    case 'cancelled': return '❌';
    default: return '📋';
  }
};

const IssueListScreen = () => {
  const navigation = useNavigation<IssueListNavigationProp>();
  const dispatch = useAppDispatch();
  const {issues, isLoading} = useAppSelector(
    state => state.issues,
  );

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    dispatch(fetchIssues());
  }, []);

  // Only show active issues (not completed/cancelled)
  const activeIssues = issues.filter(
    i => i.status !== 'completed' && i.status !== 'cancelled',
  );

  const filteredIssues = activeIssues.filter(issue => {
    const matchesStatus =
      statusFilter === 'ALL' || issue.status === statusFilter;
    const matchesSearch =
      searchText === '' ||
      issue.id.includes(searchText) ||
      issue.title
        .toLowerCase()
        .includes(searchText.toLowerCase()) ||
      issue.location?.address
        ?.toLowerCase()
        .includes(searchText.toLowerCase());
    return matchesStatus && matchesSearch;
  });

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
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.issueTitle}>{item.title}</Text>

        {/* Description */}
        <Text style={styles.issueDescription} numberOfLines={2}>
          {item.description}
        </Text>

        {/* Location */}
        <Text style={styles.issueLocation} numberOfLines={1}>
          📍 {item.location?.address || 'Location not set'}
        </Text>

        {/* Category Badge */}
        <View style={styles.issueMeta}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>
              {item.category.toUpperCase()}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.issueActions}>
            {(item.status === 'assigned' ||
              item.status === 'in_progress') && (
              <TouchableOpacity
                style={styles.trackButton}
                onPress={() =>
                  navigation.navigate('TechnicianTracking', {
                    issueId: item.id,
                  })
                }>
                <Text style={styles.trackButtonText}>
                  📍 Track
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
              <Text style={styles.viewButtonText}>View →</Text>
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
        <Text style={styles.headerTitle}>My Issues</Text>
        <Text style={styles.headerSubtitle}>
          {filteredIssues.length} active issues
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search issues..."
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
      </ScrollView>

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
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>
              No active issues
            </Text>
            <Text style={styles.emptySubText}>
              All your issues are resolved or{'\n'}you
              haven't reported any yet
            </Text>
            <TouchableOpacity
              style={styles.reportButton}
              onPress={() => navigation.navigate('ReportIssue')}>
              <Text style={styles.reportButtonText}>
                + Report New Issue
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* FAB - Report Issue */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ReportIssue')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
  searchContainer: {
    padding: spacing.md,
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
  filterChipText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 80,
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
    marginBottom: spacing.sm,
  },
  issueMeta: {
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
  issueActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  trackButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  trackButtonText: {
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
  reportButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  reportButtonText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: typography.xxl,
    color: colors.white,
    fontWeight: typography.bold,
  },
});

export default IssueListScreen;