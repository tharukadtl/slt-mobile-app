import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {formatCurrency} from '@utils/formatters';
import PhotoPicker from '@components/common/PhotoPicker';

const TEMPLATES = [
  {
    label: 'Customer Damage',
    text: 'The issue was caused by customer damage to the equipment/infrastructure. The damage was identified during the site visit and required replacement of the affected components. The customer has been informed and agreed to the charges.',
  },
  {
    label: 'Out of Warranty',
    text: 'The equipment is out of warranty and requires chargeable repair/replacement. The warranty period has expired and the repair work falls outside the standard service coverage. Materials and labor costs apply.',
  },
  {
    label: 'Customer Request',
    text: 'Work was performed at the explicit request of the customer for upgrades/modifications beyond the standard service scope. The customer requested additional work that is not covered under the standard service agreement.',
  },
  {
    label: 'Other',
    text: '',
  },
];

interface Step3JustificationProps {
  justification: string;
  onJustificationChange: (text: string) => void;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  totalChargeable: number;
  materialsFOC: number;
  materialsChargeable: number;
  laborCharges: number;
  grandTotal: number;
}

const Step3Justification: React.FC<Step3JustificationProps> = ({
  justification,
  onJustificationChange,
  photos,
  onPhotosChange,
  totalChargeable,
  materialsFOC,
  materialsChargeable,
  laborCharges,
  grandTotal,
}) => {
  const [showTemplates, setShowTemplates] = useState(false);

  const handleTemplateSelect = (template: {
    label: string;
    text: string;
  }) => {
    onJustificationChange(template.text);
    setShowTemplates(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Step 3: Justification</Text>
      <Text style={styles.stepDescription}>
        Provide justification for chargeable work
      </Text>

      {/* Required Banner */}
      {totalChargeable > 0 && (
        <View style={styles.requiredBanner}>
          <Text style={styles.requiredIcon}>ℹ️</Text>
          <Text style={styles.requiredText}>
            Required: Total chargeable amount is{' '}
            {formatCurrency(totalChargeable)}. Please provide
            justification.
          </Text>
        </View>
      )}

      {/* Templates */}
      <View style={styles.templateSection}>
        <TouchableOpacity
          style={styles.templateButton}
          onPress={() => setShowTemplates(!showTemplates)}>
          <Text style={styles.templateButtonText}>
            📝 Use Template ▼
          </Text>
        </TouchableOpacity>

        {showTemplates && (
          <View style={styles.templateList}>
            {TEMPLATES.map(template => (
              <TouchableOpacity
                key={template.label}
                style={styles.templateItem}
                onPress={() => handleTemplateSelect(template)}>
                <Text style={styles.templateItemText}>
                  {template.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Justification Text */}
      <View style={styles.card}>
        <TextInput
          style={styles.justificationInput}
          placeholder="Explain why this work is chargeable. Include details about customer damage, out-of-warranty work, or customer-requested upgrades..."
          placeholderTextColor={colors.textLight}
          value={justification}
          onChangeText={text => {
            if (text.length <= 500) {
              onJustificationChange(text);
            }
          }}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />
        <Text
          style={[
            styles.charCounter,
            justification.length < 50 && styles.charCounterWarning,
          ]}>
          {justification.length}/500
          {justification.length < 50 && totalChargeable > 0
            ? ` (min 50 required)`
            : ''}
        </Text>
      </View>

      {/* Photo Upload */}
      <View style={styles.card}>
        <Text style={styles.photoTitle}>
          Supporting Photos (Optional)
        </Text>
        <PhotoPicker
          photos={photos}
          onPhotosChange={onPhotosChange}
          maxPhotos={3}
        />
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Charge Summary</Text>
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
          <Text style={styles.summaryLabel}>Labor Chargeable:</Text>
          <Text style={[styles.summaryValue, {color: colors.warning}]}>
            {formatCurrency(laborCharges)}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Grand Total:</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(grandTotal)}
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
  requiredBanner: {
    backgroundColor: colors.warning + '20',
    borderRadius: 8,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  requiredIcon: {fontSize: 16, marginRight: spacing.sm},
  requiredText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.warning,
    lineHeight: typography.lineHeightMd,
  },
  templateSection: {
    marginBottom: spacing.md,
  },
  templateButton: {
    backgroundColor: colors.secondary + '20',
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  templateButtonText: {
    color: colors.secondary,
    fontSize: typography.md,
    fontWeight: typography.medium,
  },
  templateList: {
    backgroundColor: colors.white,
    borderRadius: 8,
    marginTop: spacing.sm,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  templateItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  templateItemText: {
    fontSize: typography.md,
    color: colors.textPrimary,
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
  justificationInput: {
    fontSize: typography.md,
    color: colors.textPrimary,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  charCounter: {
    fontSize: typography.xs,
    color: colors.textLight,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  charCounterWarning: {
    color: colors.error,
  },
  photoTitle: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  summaryCard: {
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
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
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.primary,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
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
});

export default Step3Justification;