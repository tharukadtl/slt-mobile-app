import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';

interface CancelIssueModalProps {
  visible: boolean;
  issueId: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

const CANCEL_REASONS = [
  'Issue resolved on my own',
  'Wrong category selected',
  'Duplicate request',
  'No longer needed',
  'Other',
];

const CancelIssueModal: React.FC<CancelIssueModalProps> = ({
  visible,
  issueId,
  onConfirm,
  onClose,
  isLoading,
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const handleConfirm = () => {
    const reason =
      selectedReason === 'Other' ? customReason : selectedReason;
    if (!reason) return;
    onConfirm(reason);
  };

  const isValid =
    selectedReason !== '' &&
    (selectedReason !== 'Other' || customReason.trim().length > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Cancel Issue</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Warning */}
          <View style={styles.warningBanner}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              Are you sure you want to cancel issue #{issueId}? This
              action cannot be undone.
            </Text>
          </View>

          {/* Reason Selection */}
          <Text style={styles.label}>Select a reason *</Text>
          {CANCEL_REASONS.map(reason => (
            <TouchableOpacity
              key={reason}
              style={[
                styles.reasonOption,
                selectedReason === reason && styles.reasonOptionSelected,
              ]}
              onPress={() => setSelectedReason(reason)}>
              <View
                style={[
                  styles.radioButton,
                  selectedReason === reason && styles.radioButtonSelected,
                ]}>
                {selectedReason === reason && (
                  <View style={styles.radioButtonInner} />
                )}
              </View>
              <Text
                style={[
                  styles.reasonText,
                  selectedReason === reason && styles.reasonTextSelected,
                ]}>
                {reason}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Custom Reason */}
          {selectedReason === 'Other' && (
            <TextInput
              style={styles.customReasonInput}
              placeholder="Please describe your reason..."
              placeholderTextColor={colors.textLight}
              value={customReason}
              onChangeText={setCustomReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.keepButton}
              onPress={onClose}>
              <Text style={styles.keepButtonText}>Keep Issue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                !isValid && styles.cancelButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!isValid || isLoading}>
              {isLoading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.cancelButtonText}>
                  Cancel Issue
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  closeButton: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    padding: spacing.xs,
  },
  warningBanner: {
    backgroundColor: colors.error + '15',
    borderRadius: 8,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.error,
    lineHeight: typography.lineHeightMd,
  },
  label: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  reasonOptionSelected: {
    borderColor: colors.error,
    backgroundColor: colors.error + '08',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  radioButtonSelected: {
    borderColor: colors.error,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
  },
  reasonText: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  reasonTextSelected: {
    color: colors.error,
    fontWeight: typography.medium,
  },
  customReasonInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.md,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    minHeight: 80,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  keepButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  keepButtonText: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.error,
  },
  cancelButtonDisabled: {
    backgroundColor: colors.textLight,
  },
  cancelButtonText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.white,
  },
});

export default CancelIssueModal;