import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {formatCurrency} from '@utils/formatters';

interface Step4SignatureProps {
  customerName: string;
  onCustomerNameChange: (name: string) => void;
  // Captured once, by the Technician, at job completion (SRS 5.3.1.3) — the
  // Team Lead only ever displays it here, never re-collects a new one.
  // null = still loading from the server; '' = job has no signature on record.
  technicianSignature: string | null;
  // SRS 5.3.1.3 (FR-9) — set when the client was unavailable or declined to
  // sign. Informational only: never blocks submission (see
  // PaymentSubmissionScreen.handleSubmit) — the Team Lead can see the reason
  // and still proceed.
  needsTeamLeadReview: boolean;
  signatureDeclineReason: string;
  customerAgreed: boolean;
  onAgreedChange: (agreed: boolean) => void;
  materialsFOC: number;
  materialsChargeable: number;
  laborCharges: number;
  totalFOC: number;
  totalChargeable: number;
  grandTotal: number;
  justification: string;
}

const AGREEMENT_ITEMS = [
  'I confirm the work was completed satisfactorily',
  'I accept the charges as explained',
  'I understand this will be added to my bill',
];

const Step4Signature: React.FC<Step4SignatureProps> = ({
  customerName,
  onCustomerNameChange,
  technicianSignature,
  needsTeamLeadReview,
  signatureDeclineReason,
  customerAgreed,
  onAgreedChange,
  materialsFOC,
  materialsChargeable,
  laborCharges,
  totalFOC,
  totalChargeable,
  grandTotal,
  justification,
}) => {
  const [agreedItems, setAgreedItems] = React.useState<boolean[]>(
    new Array(AGREEMENT_ITEMS.length).fill(false),
  );

  const handleAgreementToggle = (index: number) => {
    const updated = [...agreedItems];
    updated[index] = !updated[index];
    setAgreedItems(updated);
    onAgreedChange(updated.every(item => item));
  };

  const hasSignature = Boolean(technicianSignature);

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Step 4: Customer Acknowledgment</Text>
      <Text style={styles.stepDescription}>
        Get customer agreement and signature
      </Text>

      {/* Payment Summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payment Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Materials FOC:</Text>
          <Text style={[styles.summaryValue, {color: colors.success}]}>
            {formatCurrency(materialsFOC)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            Materials Chargeable:
          </Text>
          <Text style={[styles.summaryValue, {color: colors.warning}]}>
            {formatCurrency(materialsChargeable)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Labor Charges:</Text>
          <Text style={[styles.summaryValue, {color: colors.warning}]}>
            {formatCurrency(laborCharges)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total FOC:</Text>
          <Text style={[styles.summaryValue, {color: colors.success}]}>
            {formatCurrency(totalFOC)}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Chargeable:</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(totalChargeable)}
          </Text>
        </View>
      </View>

      {/* Customer Name */}
      <View style={styles.card}>
        <Text style={styles.label}>Customer Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter customer name"
          placeholderTextColor={colors.textLight}
          value={customerName}
          onChangeText={onCustomerNameChange}
        />
      </View>

      {/* Agreement Checkboxes */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Customer Agreement</Text>
        {AGREEMENT_ITEMS.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.agreementItem}
            onPress={() => handleAgreementToggle(index)}>
            <View
              style={[
                styles.checkbox,
                agreedItems[index] && styles.checkboxChecked,
              ]}>
              {agreedItems[index] && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
            <Text style={styles.agreementText}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Customer Signature — received from the Technician's job completion,
          not re-collected here (SRS 5.3.1.3). */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Customer Signature *</Text>
        <Text style={styles.signatureHint}>
          Captured by the Technician at job completion
        </Text>
        {technicianSignature === null ? (
          <View style={styles.signaturePad}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : hasSignature ? (
          <View style={styles.signaturePad}>
            <Image
              source={{uri: technicianSignature as string}}
              style={styles.signatureImage}
              resizeMode="contain"
            />
          </View>
        ) : null}
        {technicianSignature === null ? null : hasSignature ? (
          <Text style={styles.signedText}>
            ✅ Signature captured at job completion
          </Text>
        ) : needsTeamLeadReview ? (
          // SRS 5.3.1.3 (FR-9) — client unavailable/declined to sign. The job
          // still completed; this is a review flag, not a block. The Team
          // Lead can see the reason and remains free to submit anyway.
          <View style={styles.reviewBanner}>
            <Text style={styles.reviewBannerTitle}>
              🚩 Flagged for Review — No Signature Captured
            </Text>
            <Text style={styles.reviewBannerReason}>
              {signatureDeclineReason ||
                'The client was unavailable or declined to sign.'}
            </Text>
            <Text style={styles.reviewBannerNote}>
              You may still submit this payment.
            </Text>
          </View>
        ) : (
          <Text style={styles.notSignedText}>
            ⚠️ No customer signature on record for this job.
          </Text>
        )}
      </View>

      {/* Final Summary */}
      <View style={styles.finalSummaryCard}>
        <View style={styles.finalRow}>
          <Text style={styles.finalLabel}>Total FOC:</Text>
          <Text style={[styles.finalValue, {color: colors.success}]}>
            {formatCurrency(totalFOC)}
          </Text>
        </View>
        <View style={styles.finalRow}>
          <Text style={styles.finalLabel}>Total Chargeable:</Text>
          <Text style={[styles.finalValue, {color: colors.primary}]}>
            {formatCurrency(totalChargeable)}
          </Text>
        </View>
        <View style={styles.finalRow}>
          <Text style={styles.finalLabel}>Customer:</Text>
          <Text style={styles.finalValue}>
            {customerName || 'Not entered'}
          </Text>
        </View>
        <View style={styles.finalRow}>
          <Text style={styles.finalLabel}>Signed:</Text>
          <Text
            style={[
              styles.finalValue,
              {
                color: hasSignature
                  ? colors.success
                  : needsTeamLeadReview
                  ? colors.warning
                  : colors.error,
              },
            ]}>
            {hasSignature
              ? 'Yes ✅'
              : needsTeamLeadReview
              ? 'Flagged 🚩'
              : 'No ❌'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  stepTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  stepDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
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
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: colors.primary,
    paddingTop: spacing.sm,
  },
  totalLabel: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  label: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.md,
    color: colors.textPrimary,
  },
  agreementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  agreementText: {
    flex: 1,
    fontSize: typography.md,
    color: colors.textPrimary,
    lineHeight: typography.lineHeightMd,
  },
  signatureHint: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  signaturePad: {
    height: 200,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatureImage: {
    flex: 1,
    width: '100%',
  },
  signedText: {
    textAlign: 'center',
    color: colors.success,
    fontSize: typography.sm,
    fontWeight: typography.medium,
    marginTop: spacing.sm,
  },
  notSignedText: {
    textAlign: 'center',
    color: colors.error,
    fontSize: typography.sm,
    marginTop: spacing.sm,
  },
  reviewBanner: {
    backgroundColor: colors.statusPending,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  reviewBannerTitle: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  reviewBannerReason: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    lineHeight: typography.lineHeightMd,
  },
  reviewBannerNote: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  finalSummaryCard: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  finalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  finalLabel: {
    fontSize: typography.md,
    color: colors.white,
    opacity: 0.8,
  },
  finalValue: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.white,
  },
});

export default Step4Signature;