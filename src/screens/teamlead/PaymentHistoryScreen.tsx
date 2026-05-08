import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TeamLeadStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {
  fetchPaymentHistory,
  fetchPaymentById,
} from '@store/slices/technicianSlice';
import {PaymentHistoryItem, PaymentStatus} from '@appTypes/technician.types';
import {formatCurrency, formatDate} from '@utils/formatters';

type PaymentHistoryNavigationProp =
  StackNavigationProp<TeamLeadStackParamList>;

const STATUS_FILTERS = [
  {label: 'All', value: 'ALL'},
  {label: 'Draft', value: 'DRAFT'},
  {label: 'Final', value: 'FINAL'},
  {label: 'Not Approved', value: 'NOT_APPROVED'},
];

const getStatusColor = (status: PaymentStatus) => {
  switch (status) {
    case 'FINAL':        return colors.success;
    case 'DRAFT':        return colors.warning;
    case 'NOT_APPROVED': return colors.error;
    default: return colors.textSecondary;
  }
};

const getStatusIcon = (status: PaymentStatus) => {
  switch (status) {
    case 'FINAL':        return '✅';
    case 'DRAFT':        return '⏳';
    case 'NOT_APPROVED': return '❌';
    default: return '📋';
  }
};

// Mock data for display when API not connected
const MOCK_PAYMENTS: PaymentHistoryItem[] = [
  {
    id: 'PAY001',
    taskId: 'TASK001',
    customerName: 'Amal Perera',
    submittedAt: '2026-04-10T09:30:00',
    reviewedAt: '2026-04-10T14:00:00',
    status: 'APPROVED',
    materialsFOC: 500,
    materialsChargeable: 2500,
    laborCharges: 1250,
    totalFOC: 500,
    totalChargeable: 3750,
    grandTotal: 3750,
    category: 'Broadband',
    address: 'No 45, Galle Road, Colombo 03',
    justification: 'Customer damage to fiber cable',
    materials: [
      {
        id: '1',
        name: 'Fiber Optic Cable',
        quantity: 5,
        unitPrice: 150,
        type: 'CHARGEABLE',
        subtotal: 750,
      },
      {
        id: '2',
        name: 'RJ45 Connector',
        quantity: 4,
        unitPrice: 25,
        type: 'FOC',
        subtotal: 100,
      },
    ],
    labor: {
      startTime: '09:00',
      endTime: '11:30',
      totalHours: 2.5,
      hourlyRate: 500,
      laborCharges: 1250,
      type: 'CHARGEABLE',
    },
  },
  {
    id: 'PAY002',
    taskId: 'TASK002',
    customerName: 'Nimal Silva',
    submittedAt: '2026-04-11T10:00:00',
    status: 'PENDING',
    materialsFOC: 0,
    materialsChargeable: 3500,
    laborCharges: 1000,
    totalFOC: 0,
    totalChargeable: 4500,
    grandTotal: 4500,
    category: 'Fiber',
    address: 'No 12, Kandy Road, Kadawatha',
    justification: 'Out of warranty equipment replacement',
    materials: [
      {
        id: '3',
        name: 'Router Wireless',
        quantity: 1,
        unitPrice: 3500,
        type: 'CHARGEABLE',
        subtotal: 3500,
      },
    ],
    labor: {
      startTime: '10:00',
      endTime: '12:00',
      totalHours: 2,
      hourlyRate: 500,
      laborCharges: 1000,
      type: 'CHARGEABLE',
    },
  },
  {
    id: 'PAY003',
    taskId: 'TASK003',
    customerName: 'Kamala Fernando',
    submittedAt: '2026-04-09T14:00:00',
    reviewedAt: '2026-04-09T16:00:00',
    status: 'REJECTED',
    materialsFOC: 200,
    materialsChargeable: 0,
    laborCharges: 0,
    totalFOC: 200,
    totalChargeable: 0,
    grandTotal: 0,
    adminNotes: 'Insufficient justification provided',
    category: 'Telephone',
    address: 'No 78, Negombo Road, Wattala',
    justification: 'Standard repair work',
    materials: [
      {
        id: '4',
        name: 'Cable Ties',
        quantity: 2,
        unitPrice: 50,
        type: 'FOC',
        subtotal: 100,
      },
    ],
    labor: {
      startTime: '14:00',
      endTime: '15:00',
      totalHours: 1,
      hourlyRate: 500,
      laborCharges: 500,
      type: 'FOC',
    },
  },
  {
    id: 'PAY004',
    taskId: 'TASK004',
    customerName: 'Saman Jayawardena',
    submittedAt: '2026-04-12T08:00:00',
    status: 'UNDER_REVIEW',
    materialsFOC: 0,
    materialsChargeable: 1800,
    laborCharges: 750,
    totalFOC: 0,
    totalChargeable: 2550,
    grandTotal: 2550,
    category: 'Television',
    address: 'No 23, Horana Road, Panadura',
    justification: 'Customer requested upgrade',
    materials: [
      {
        id: '5',
        name: 'Signal Booster',
        quantity: 1,
        unitPrice: 1800,
        type: 'CHARGEABLE',
        subtotal: 1800,
      },
    ],
    labor: {
      startTime: '08:00',
      endTime: '09:30',
      totalHours: 1.5,
      hourlyRate: 500,
      laborCharges: 750,
      type: 'CHARGEABLE',
    },
  },
];

const PaymentHistoryScreen = () => {
  const navigation = useNavigation<PaymentHistoryNavigationProp>();
  const dispatch = useAppDispatch();
  const {paymentHistory, isLoading} = useAppSelector(
    state => state.technician,
  );

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentHistoryItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    dispatch(fetchPaymentHistory());
  }, []);

  const payments =
    paymentHistory.length > 0 ? paymentHistory : MOCK_PAYMENTS;

  const filteredPayments = payments.filter(payment => {
    const matchesStatus =
      statusFilter === 'ALL' || payment.status === statusFilter;
    const matchesStartDate =
      !startDate ||
      new Date(payment.submittedAt) >= new Date(startDate);
    const matchesEndDate =
      !endDate ||
      new Date(payment.submittedAt) <= new Date(endDate + 'T23:59:59');
    return matchesStatus && matchesStartDate && matchesEndDate;
  });

  const totalAmount = filteredPayments.reduce(
    (sum, p) => sum + p.grandTotal,
    0,
  );
  const approvedCount = filteredPayments.filter(
    p => p.status === 'APPROVED',
  ).length;
  const pendingCount = filteredPayments.filter(
    p => p.status === 'PENDING' || p.status === 'UNDER_REVIEW',
  ).length;
  const rejectedCount = filteredPayments.filter(
    p => p.status === 'REJECTED',
  ).length;

  const handleViewDetail = (payment: PaymentHistoryItem) => {
    setSelectedPayment(payment);
    setShowDetailModal(true);
  };

  const activeFilters =
    statusFilter !== 'ALL' || startDate !== '' || endDate !== '';

  const renderPaymentCard = ({
    item,
  }: {
    item: PaymentHistoryItem;
  }) => (
    <TouchableOpacity
      style={styles.paymentCard}
      onPress={() => handleViewDetail(item)}>
      {/* Status Bar */}
      <View
        style={[
          styles.statusBar,
          {backgroundColor: getStatusColor(item.status)},
        ]}
      />

      <View style={styles.paymentContent}>
        {/* Header */}
        <View style={styles.paymentHeader}>
          <View>
            <Text style={styles.paymentId}>
              Payment #{item.id}
            </Text>
            <Text style={styles.taskId}>Task #{item.taskId}</Text>
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
              {item.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        {/* Customer Info */}
        <Text style={styles.customerName}>
          👤 {item.customerName}
        </Text>
        {item.address && (
          <Text style={styles.address} numberOfLines={1}>
            📍 {item.address}
          </Text>
        )}
        {item.category && (
          <Text style={styles.category}>🔧 {item.category}</Text>
        )}

        {/* Dates */}
        <Text style={styles.submittedDate}>
          📅 Submitted: {formatDate(item.submittedAt)}
        </Text>
        {item.reviewedAt && (
          <Text style={styles.reviewedDate}>
            ✅ Reviewed: {formatDate(item.reviewedAt)}
          </Text>
        )}

        {/* Amount Summary */}
        <View style={styles.amountRow}>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>FOC</Text>
            <Text
              style={[styles.amountValue, {color: colors.success}]}>
              {formatCurrency(item.totalFOC)}
            </Text>
          </View>
          <View style={styles.amountDivider} />
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Chargeable</Text>
            <Text
              style={[styles.amountValue, {color: colors.warning}]}>
              {formatCurrency(item.totalChargeable)}
            </Text>
          </View>
          <View style={styles.amountDivider} />
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text
              style={[
                styles.amountValue,
                {color: colors.primary, fontSize: typography.lg},
              ]}>
              {formatCurrency(item.grandTotal)}
            </Text>
          </View>
        </View>

        {/* Admin Notes for Rejected */}
        {item.status === 'REJECTED' && item.adminNotes && (
          <View style={styles.rejectionNote}>
            <Text style={styles.rejectionNoteIcon}>❌</Text>
            <Text style={styles.rejectionNoteText}>
              {item.adminNotes}
            </Text>
          </View>
        )}

        {/* View Detail */}
        <TouchableOpacity
          style={styles.viewDetailButton}
          onPress={() => handleViewDetail(item)}>
          <Text style={styles.viewDetailText}>View Full Details →</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment History</Text>
        <Text style={styles.headerSubtitle}>
          {filteredPayments.length} payments
        </Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View
          style={[
            styles.summaryCard,
            {backgroundColor: colors.success},
          ]}>
          <Text style={styles.summaryValue}>{approvedCount}</Text>
          <Text style={styles.summaryLabel}>Approved</Text>
        </View>
        <View
          style={[
            styles.summaryCard,
            {backgroundColor: colors.warning},
          ]}>
          <Text style={styles.summaryValue}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View
          style={[
            styles.summaryCard,
            {backgroundColor: colors.error},
          ]}>
          <Text style={styles.summaryValue}>{rejectedCount}</Text>
          <Text style={styles.summaryLabel}>Rejected</Text>
        </View>
        <View
          style={[
            styles.summaryCard,
            {backgroundColor: colors.primary},
          ]}>
          <Text style={styles.summaryAmountValue}>
            {formatCurrency(totalAmount)
              .replace('LKR ', '')
              .split('.')[0]}
          </Text>
          <Text style={styles.summaryLabel}>Total LKR</Text>
        </View>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}>
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
        <TouchableOpacity
          style={[
            styles.dateFilterButton,
            activeFilters && styles.dateFilterButtonActive,
          ]}
          onPress={() => setShowFilterModal(true)}>
          <Text style={styles.dateFilterText}>
            📅 {activeFilters ? 'Filtered' : 'Date'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Payment List */}
      <FlatList
        data={filteredPayments}
        keyExtractor={item => item.id}
        renderItem={renderPaymentCard}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => dispatch(fetchPaymentHistory())}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyText}>No payments found</Text>
            <Text style={styles.emptySubText}>
              Try adjusting your filters
            </Text>
          </View>
        }
      />

      {/* Date Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Date</Text>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD (e.g. 2026-04-01)"
                placeholderTextColor={colors.textLight}
                value={startDate}
                onChangeText={setStartDate}
                keyboardType="numeric"
              />
              <Text style={styles.dateLabel}>End Date</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD (e.g. 2026-04-30)"
                placeholderTextColor={colors.textLight}
                value={endDate}
                onChangeText={setEndDate}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => {
                  setStartDate('');
                  setEndDate('');
                  setShowFilterModal(false);
                }}>
                <Text style={styles.resetButtonText}>
                  Reset
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowFilterModal(false)}>
                <Text style={styles.applyButtonText}>
                  Apply
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Detail Modal */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.detailModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Payment #{selectedPayment?.id}
              </Text>
              <TouchableOpacity
                onPress={() => setShowDetailModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {selectedPayment && (
              <ScrollView style={styles.modalContent}>
                {/* Status */}
                <View style={styles.detailStatusRow}>
                  <View
                    style={[
                      styles.detailStatusBadge,
                      {
                        backgroundColor:
                          getStatusColor(selectedPayment.status) +
                          '20',
                      },
                    ]}>
                    <Text
                      style={[
                        styles.detailStatusText,
                        {
                          color: getStatusColor(
                            selectedPayment.status,
                          ),
                        },
                      ]}>
                      {getStatusIcon(selectedPayment.status)}{' '}
                      {selectedPayment.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>

                {/* Job Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>
                    Job Information
                  </Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Task ID</Text>
                    <Text style={styles.detailValue}>
                      #{selectedPayment.taskId}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Customer</Text>
                    <Text style={styles.detailValue}>
                      {selectedPayment.customerName}
                    </Text>
                  </View>
                  {selectedPayment.category && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Category</Text>
                      <Text style={styles.detailValue}>
                        {selectedPayment.category}
                      </Text>
                    </View>
                  )}
                  {selectedPayment.address && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Address</Text>
                      <Text
                        style={[styles.detailValue, {flex: 1}]}>
                        {selectedPayment.address}
                      </Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Submitted</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedPayment.submittedAt)}
                    </Text>
                  </View>
                  {selectedPayment.reviewedAt && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Reviewed</Text>
                      <Text style={styles.detailValue}>
                        {formatDate(selectedPayment.reviewedAt)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Materials */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>
                    Materials Used
                  </Text>
                  {selectedPayment.materials.map(
                    (material, index) => (
                      <View key={index} style={styles.materialRow}>
                        <View style={styles.materialInfo}>
                          <Text style={styles.materialName}>
                            {material.name}
                          </Text>
                          <Text style={styles.materialQty}>
                            {material.quantity} x{' '}
                            {formatCurrency(material.unitPrice)}
                          </Text>
                        </View>
                        <View style={styles.materialRight}>
                          <View
                            style={[
                              styles.typeBadge,
                              {
                                backgroundColor:
                                  material.type === 'FOC'
                                    ? colors.success + '20'
                                    : colors.warning + '20',
                              },
                            ]}>
                            <Text
                              style={[
                                styles.typeText,
                                {
                                  color:
                                    material.type === 'FOC'
                                      ? colors.success
                                      : colors.warning,
                                },
                              ]}>
                              {material.type}
                            </Text>
                          </View>
                          <Text style={styles.materialSubtotal}>
                            {formatCurrency(material.subtotal)}
                          </Text>
                        </View>
                      </View>
                    ),
                  )}
                </View>

                {/* Labor */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>
                    Labor Details
                  </Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Start Time</Text>
                    <Text style={styles.detailValue}>
                      {selectedPayment.labor.startTime}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>End Time</Text>
                    <Text style={styles.detailValue}>
                      {selectedPayment.labor.endTime}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Duration</Text>
                    <Text style={styles.detailValue}>
                      {selectedPayment.labor.totalHours.toFixed(1)}{' '}
                      hours
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Rate</Text>
                    <Text style={styles.detailValue}>
                      {formatCurrency(
                        selectedPayment.labor.hourlyRate,
                      )}
                      /hr
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Type</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        {
                          color:
                            selectedPayment.labor.type === 'FOC'
                              ? colors.success
                              : colors.warning,
                          fontWeight: typography.bold,
                        },
                      ]}>
                      {selectedPayment.labor.type}
                    </Text>
                  </View>
                </View>

                {/* Justification */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>
                    Justification
                  </Text>
                  <Text style={styles.justificationText}>
                    {selectedPayment.justification}
                  </Text>
                </View>

                {/* Financial Summary */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>
                    Financial Summary
                  </Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      Materials FOC
                    </Text>
                    <Text
                      style={[
                        styles.detailValue,
                        {color: colors.success},
                      ]}>
                      {formatCurrency(selectedPayment.materialsFOC)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      Materials Chg
                    </Text>
                    <Text
                      style={[
                        styles.detailValue,
                        {color: colors.warning},
                      ]}>
                      {formatCurrency(
                        selectedPayment.materialsChargeable,
                      )}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Labor</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        {color: colors.warning},
                      ]}>
                      {formatCurrency(selectedPayment.laborCharges)}
                    </Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total FOC</Text>
                    <Text
                      style={[
                        styles.totalValue,
                        {color: colors.success},
                      ]}>
                      {formatCurrency(selectedPayment.totalFOC)}
                    </Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>
                      Total Chargeable
                    </Text>
                    <Text
                      style={[
                        styles.totalValue,
                        {color: colors.primary},
                        {fontSize: typography.lg},
                      ]}>
                      {formatCurrency(selectedPayment.grandTotal)}
                    </Text>
                  </View>
                </View>

                {/* Admin Notes */}
                {selectedPayment.adminNotes && (
                  <View style={styles.adminNotesCard}>
                    <Text style={styles.adminNotesTitle}>
                      Admin Notes
                    </Text>
                    <Text style={styles.adminNotesText}>
                      {selectedPayment.adminNotes}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.closeDetailButton}
                onPress={() => setShowDetailModal(false)}>
                <Text style={styles.closeDetailText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  summaryContainer: {
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
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  summaryAmountValue: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.white,
  },
  summaryLabel: {
    fontSize: 9,
    color: colors.white,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 2,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.md,
    marginBottom: spacing.sm,
  },
  filterChips: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
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
  dateFilterButton: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginLeft: spacing.sm,
  },
  dateFilterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateFilterText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: 0,
  },
  paymentCard: {
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
  paymentContent: {
    flex: 1,
    padding: spacing.md,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  paymentId: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  taskId: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
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
  customerName: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  address: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  category: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  submittedDate: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  reviewedDate: {
    fontSize: typography.xs,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  amountRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 6,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  amountItem: {
    flex: 1,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  amountValue: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  amountDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  rejectionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.error + '10',
    borderRadius: 6,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  rejectionNoteIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  rejectionNoteText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.error,
    lineHeight: typography.lineHeightMd,
  },
  viewDetailButton: {
    alignItems: 'flex-end',
  },
  viewDetailText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
  },
  detailModal: {
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  modalClose: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    padding: spacing.xs,
  },
  modalContent: {
    padding: spacing.lg,
  },
  dateLabel: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  dateInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.md,
    color: colors.textPrimary,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resetButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButtonText: {
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  applyButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  applyButtonText: {
    color: colors.white,
    fontWeight: typography.bold,
  },
  detailStatusRow: {
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  detailStatusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
  },
  detailStatusText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  detailSection: {
    marginBottom: spacing.lg,
  },
  detailSectionTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  detailLabel: {
    width: 90,
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  detailValue: {
    fontSize: typography.sm,
    color: colors.textPrimary,
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
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  materialQty: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  materialRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  materialSubtotal: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  justificationText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeightMd,
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  totalLabel: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  adminNotesCard: {
    backgroundColor: colors.error + '10',
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  adminNotesTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  adminNotesText: {
    fontSize: typography.sm,
    color: colors.error,
    lineHeight: typography.lineHeightMd,
  },
  closeDetailButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  closeDetailText: {
    color: colors.white,
    fontWeight: typography.bold,
    fontSize: typography.md,
  },
});

export default PaymentHistoryScreen;