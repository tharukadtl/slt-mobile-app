import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {ClientStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {
  fetchBillById,
  acceptBill,
  reportBillDispute,
} from '@store/slices/issueSlice';
import {formatCurrency, formatDate, formatStatus} from '@utils/formatters';
import PhotoPicker from '@components/common/PhotoPicker';

type BillDetailRouteProp = RouteProp<ClientStackParamList, 'BillDetail'>;

// Billing dispute categories. ReportDisputeRequest carries the category as free text (the SRS
// does not enumerate it); these values follow the examples in the backend DTO's own docs
// (wrong amount / unrecognised material / incorrect FOC-chargeable classification).
const DISPUTE_CATEGORIES = [
  {label: 'Wrong Amount', value: 'WRONG_AMOUNT'},
  {label: 'Unrecognised Material', value: 'UNRECOGNISED_MATERIAL'},
  {label: 'FOC / Chargeable Error', value: 'INCORRECT_CLASSIFICATION'},
  {label: 'Labour Charge', value: 'LABOUR_CHARGE'},
  {label: 'Other', value: 'OTHER'},
];

const BillDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<BillDetailRouteProp>();
  const dispatch = useAppDispatch();
  const {selectedBill, isLoading} = useAppSelector(state => state.issues);
  const {billId} = route.params;

  const [showReportForm, setShowReportForm] = useState(false);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(fetchBillById(billId));
  }, [billId]);

  if (!selectedBill || (isLoading && !submitting)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const status = selectedBill.status;
  // A bill is client-actionable only while approved or awaiting review of an amendment —
  // exactly the allowed-from set the backend enforces for accept & dispute.
  const canAct = status === 'APPROVED' || status === 'PENDING_CLIENT_REVIEW';

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'APPROVED': return colors.success;
      case 'ACCEPTED': return colors.success;
      case 'PENDING': return colors.warning;
      case 'PENDING_CLIENT_REVIEW': return colors.warning;
      case 'DISPUTED': return colors.error;
      case 'REJECTED': return colors.error;
      case 'PAID': return colors.primary;
      default: return colors.textSecondary;
    }
  };

  const handleAccept = () => {
    Alert.alert(
      'Accept Bill',
      'Accept this bill? This closes the issue and moves it to your history.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Accept',
          onPress: async () => {
            setSubmitting(true);
            const result = await dispatch(acceptBill(selectedBill.id));
            setSubmitting(false);
            if (acceptBill.fulfilled.match(result)) {
              Alert.alert('Bill Accepted', 'Thank you. This bill has been accepted.');
            } else {
              Alert.alert(
                'Error',
                (result.payload as string) || 'Failed to accept bill. Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  const handleSubmitReport = async () => {
    if (!category) {
      Alert.alert('Error', 'Please select an issue category');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please describe the issue');
      return;
    }
    setSubmitting(true);
    const result = await dispatch(
      reportBillDispute({
        id: selectedBill.id,
        category,
        description: description.trim(),
        photoUri: photos[0],
      }),
    );
    setSubmitting(false);
    if (reportBillDispute.fulfilled.match(result)) {
      setShowReportForm(false);
      setCategory('');
      setDescription('');
      setPhotos([]);
      Alert.alert('Issue Reported', 'Your issue has been sent to SLT for review.');
    } else {
      Alert.alert(
        'Error',
        (result.payload as string) || 'Failed to report issue. Please try again.',
      );
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
              {backgroundColor: getStatusColor(status) + '20'},
            ]}>
            <Text
              style={[styles.statusText, {color: getStatusColor(status)}]}>
              {formatStatus(status)}
            </Text>
          </View>
        </View>

        {/* Status context banner */}
        {status === 'PENDING_CLIENT_REVIEW' && (
          <View style={[styles.banner, styles.bannerReview]}>
            <Text style={styles.bannerText}>
              This bill was amended and resent for your review. Please review the
              updated charges below, then Accept or Report an Issue.
            </Text>
          </View>
        )}
        {status === 'DISPUTED' && (
          <View style={[styles.banner, styles.bannerDisputed]}>
            <Text style={styles.bannerText}>
              Your reported issue is under review. We'll notify you once the bill
              has been updated.
            </Text>
          </View>
        )}
        {status === 'ACCEPTED' && (
          <View style={[styles.banner, styles.bannerAccepted]}>
            <Text style={styles.bannerText}>
              You have accepted this bill. It has been moved to your history.
            </Text>
          </View>
        )}

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

        {/* Actions — only while the bill is client-actionable (approved or amended-for-review) */}
        {canAct && !showReportForm && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={handleAccept}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.acceptButtonText}>Accept Bill</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.reportButton]}
              onPress={() => setShowReportForm(true)}
              disabled={submitting}>
              <Text style={styles.reportButtonText}>Report Issue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Report Issue form */}
        {canAct && showReportForm && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Report an Issue</Text>

            <Text style={styles.label}>Category *</Text>
            <View style={styles.categoryContainer}>
              {DISPUTE_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryButton,
                    category === cat.value && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat.value)}>
                  <Text
                    style={[
                      styles.categoryText,
                      category === cat.value && styles.categoryTextActive,
                    ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe what's wrong with this bill"
              placeholderTextColor={colors.textLight}
              value={description}
              onChangeText={text => setDescription(text.slice(0, 500))}
              maxLength={500}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/500</Text>

            <PhotoPicker
              photos={photos}
              onPhotosChange={setPhotos}
              maxPhotos={1}
            />

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.acceptButton,
                (!category || !description.trim()) && styles.buttonDisabled,
              ]}
              onPress={handleSubmitReport}
              disabled={submitting || !category || !description.trim()}>
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.acceptButtonText}>Submit Issue</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => {
                setShowReportForm(false);
                setCategory('');
                setDescription('');
                setPhotos([]);
              }}
              disabled={submitting}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

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
  banner: {
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
  },
  bannerReview: {
    backgroundColor: colors.warning + '15',
    borderLeftColor: colors.warning,
  },
  bannerDisputed: {
    backgroundColor: colors.error + '15',
    borderLeftColor: colors.error,
  },
  bannerAccepted: {
    backgroundColor: colors.success + '15',
    borderLeftColor: colors.success,
  },
  bannerText: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    lineHeight: typography.lineHeightMd,
  },
  actions: {
    marginBottom: spacing.md,
  },
  actionButton: {
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  acceptButton: {
    backgroundColor: colors.primary,
  },
  acceptButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  reportButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.error,
  },
  reportButtonText: {
    color: colors.error,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  cancelButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: typography.md,
    fontWeight: typography.medium,
  },
  buttonDisabled: {
    backgroundColor: colors.textLight,
  },
  label: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.md,
    color: colors.textPrimary,
  },
  textArea: {
    height: 100,
    paddingTop: spacing.md,
  },
  charCount: {
    fontSize: typography.xs,
    color: colors.textLight,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  categoryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  categoryButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  categoryTextActive: {
    color: colors.white,
    fontWeight: typography.medium,
  },
});

export default BillDetailScreen;