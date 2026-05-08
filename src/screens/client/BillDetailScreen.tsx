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
import {fetchBillById} from '@store/slices/issueSlice';
import {formatCurrency, formatDate} from '@utils/formatters';

type BillDetailRouteProp = RouteProp<ClientStackParamList, 'BillDetail'>;

const BillDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<BillDetailRouteProp>();
  const dispatch = useAppDispatch();
  const {selectedBill, isLoading} = useAppSelector(state => state.issues);
  const {billId} = route.params;

  useEffect(() => {
    dispatch(fetchBillById(billId));
  }, [billId]);

  if (isLoading || !selectedBill) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return colors.success;
      case 'PENDING': return colors.warning;
      case 'PAID': return colors.primary;
      default: return colors.textSecondary;
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bill Details</Text>
        <Text style={styles.invoiceId}>Invoice #{selectedBill.id}</Text>
      </View>

      <View style={styles.content}>
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusBadge,
              {backgroundColor: getStatusColor(selectedBill.status) + '20'},
            ]}>
            <Text
              style={[
                styles.statusText,
                {color: getStatusColor(selectedBill.status)},
              ]}>
              {selectedBill.status}
            </Text>
          </View>
        </View>

        {/* Job Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Job Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Issue</Text>
            <Text style={styles.infoValue}>{selectedBill.issueTitle}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Technician</Text>
            <Text style={styles.infoValue}>{selectedBill.technicianName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Completed</Text>
            <Text style={styles.infoValue}>
              {formatDate(selectedBill.completedAt)}
            </Text>
          </View>
        </View>

        {/* Materials Card */}
        {selectedBill.materials && selectedBill.materials.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Materials Used</Text>
            {selectedBill.materials.map((item, index) => (
              <View key={index} style={styles.materialRow}>
                <View style={styles.materialInfo}>
                  <Text style={styles.materialName}>{item.name}</Text>
                  <Text style={styles.materialQty}>
                    {item.quantity} x {formatCurrency(item.unitPrice)}
                  </Text>
                </View>
                <View style={styles.materialRight}>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor:
                          item.type === 'FOC'
                            ? colors.success + '20'
                            : colors.warning + '20',
                      },
                    ]}>
                    <Text
                      style={[
                        styles.typeText,
                        {
                          color:
                            item.type === 'FOC'
                              ? colors.success
                              : colors.warning,
                        },
                      ]}>
                      {item.type}
                    </Text>
                  </View>
                  <Text style={styles.materialSubtotal}>
                    {formatCurrency(item.subtotal)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Labor Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Labor Charges</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Hours</Text>
            <Text style={styles.infoValue}>
              {selectedBill.laborHours} hrs
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rate</Text>
            <Text style={styles.infoValue}>
              {formatCurrency(selectedBill.laborRate)}/hr
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total</Text>
            <Text style={styles.infoValue}>
              {formatCurrency(selectedBill.laborCharges)}
            </Text>
          </View>
        </View>

        {/* Summary Card */}
        <View style={[styles.card, styles.summaryCard]}>
          <Text style={styles.cardTitle}>Bill Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Materials (FOC)</Text>
            <Text style={[styles.summaryValue, {color: colors.success}]}>
              {formatCurrency(selectedBill.materialsFOC)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Materials (Chargeable)</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(selectedBill.materialsChargeable)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Labor Charges</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(selectedBill.laborCharges)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total FOC</Text>
            <Text style={[styles.summaryValue, {color: colors.success}]}>
              {formatCurrency(selectedBill.totalFOC)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Chargeable</Text>
            <Text style={styles.totalAmount}>
              {formatCurrency(selectedBill.grandTotal)}
            </Text>
          </View>
        </View>

        {/* Note */}
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>
            💡 This bill will be added to your SLT account. For queries
            contact SLT customer service.
          </Text>
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
  invoiceId: {
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
    borderBottomColor: colors.background,
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
  },
  infoValue: {
    flex: 1,
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  materialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  materialQty: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  materialRight: {
    alignItems: 'flex-end',
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: spacing.xs,
  },
  typeText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  materialSubtotal: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: colors.primary,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  totalLabel: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  totalAmount: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  noteCard: {
    backgroundColor: colors.secondary + '15',
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
  },
  noteText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeightMd,
  },
});

export default BillDetailScreen;