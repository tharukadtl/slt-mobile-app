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
import {fetchBills} from '@store/slices/issueSlice';
import {formatCurrency, formatDate} from '@utils/formatters';

type BillingNavigationProp = StackNavigationProp<ClientStackParamList>;

const BillingHistoryScreen = () => {
  const navigation = useNavigation<BillingNavigationProp>();
  const dispatch = useAppDispatch();
  const {bills, isLoading} = useAppSelector(state => state.issues);

  useEffect(() => {
    dispatch(fetchBills());
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return colors.success;
      case 'PENDING': return colors.warning;
      case 'PAID': return colors.primary;
      default: return colors.textSecondary;
    }
  };

  const getTotalBilled = () => {
    return bills.reduce((sum, bill) => sum + bill.grandTotal, 0);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Billing History</Text>
        <Text style={styles.headerSubtitle}>
          {bills.length} bills total
        </Text>
      </View>

      {/* Total Summary Card */}
      {bills.length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Billed Amount</Text>
          <Text style={styles.summaryAmount}>
            {formatCurrency(getTotalBilled())}
          </Text>
        </View>
      )}

      {/* Bills List */}
      <FlatList
        data={bills}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => dispatch(fetchBills())}
          />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.billCard}
            onPress={() =>
              navigation.navigate('BillDetail', {billId: item.id})
            }>
            <View style={styles.billHeader}>
              <Text style={styles.billId}>Invoice #{item.id}</Text>
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
                  {item.status}
                </Text>
              </View>
            </View>
            <Text style={styles.issueTitle}>{item.issueTitle}</Text>
            <Text style={styles.technicianName}>
              👤 {item.technicianName}
            </Text>
            <View style={styles.billFooter}>
              <Text style={styles.billDate}>
                {formatDate(item.completedAt)}
              </Text>
              <Text style={styles.billAmount}>
                {formatCurrency(item.grandTotal)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyText}>No bills yet</Text>
            <Text style={styles.emptySubText}>
              Bills will appear here after your issues are resolved
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
  summaryCard: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  summaryLabel: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
    marginBottom: spacing.xs,
  },
  summaryAmount: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  listContent: {
    padding: spacing.lg,
  },
  billCard: {
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
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  billId: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
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
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  technicianName: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  billFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.background,
    paddingTop: spacing.sm,
  },
  billDate: {
    fontSize: typography.xs,
    color: colors.textLight,
  },
  billAmount: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
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
    paddingHorizontal: spacing.lg,
  },
});

export default BillingHistoryScreen;