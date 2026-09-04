import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TechnicianStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch} from '@store/hooks';
import {updateTaskStatus} from '@store/slices/technicianSlice';
import technicianService from '@services/technicianService';

type SignatureRouteProp = RouteProp<TechnicianStackParamList, 'Signature'>;
type SignatureNavigationProp = StackNavigationProp<TechnicianStackParamList, 'Signature'>;

// backend rejects this literal (and blank/null) — see JobController.submitSignature
const PLACEHOLDER_SIGNATURE = 'signature_placeholder';

const SignatureScreen = () => {
  const navigation = useNavigation<SignatureNavigationProp>();
  const route = useRoute<SignatureRouteProp>();
  const dispatch = useAppDispatch();
  const {taskId, completionPhotoUrls, completionRemarks, causeOfFault} = route.params;

  const signatureRef = useRef<any>(null);
  const [signature, setSignature] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // SRS 5.3.1.3 (FR-9) — client unavailable or declines to sign. The job can
  // still be completed; a mandatory reason is recorded instead, flagging it
  // for the Team Lead to review before submitting payment.
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [isDeclining, setIsDeclining] = useState(false);

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setSignature('');
  };

  const handleComplete = async () => {
    // Mobile-side guard: never let a placeholder or blank value near the
    // network call, even if something upstream ever regresses to sending one.
    if (!signature || !signature.trim() || signature === PLACEHOLDER_SIGNATURE) {
      Alert.alert(
        'Signature Required',
        'Please ask the customer to sign, then tap "Save Signature", before completing the job.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await technicianService.submitSignature(taskId, signature);

      const result = await dispatch(
        updateTaskStatus({
          id: taskId,
          status: 'completed',
          completionPhotoUrls,
          ...(completionRemarks ? {completionRemarks} : {}),
          ...(causeOfFault ? {causeOfFault} : {}),
        }),
      );

      if (updateTaskStatus.fulfilled.match(result)) {
        Alert.alert('Success', 'Task completed successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('TechnicianTabs'),
          },
        ]);
      } else {
        Alert.alert(
          'Completion Failed',
          (result.payload as string) || 'Could not complete the job.',
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Signature Failed',
        error.response?.data?.message || error.message || 'Could not save the signature.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineConfirm = async () => {
    if (!declineReason.trim()) {
      Alert.alert(
        'Reason Required',
        'Please explain why the client is unavailable or declined to sign.',
      );
      return;
    }

    setIsDeclining(true);
    try {
      // No submitSignature call on this path — the job completes without a
      // signature on record, and the decline reason is routed through this
      // same completion request instead (JobService.updateStatus).
      const result = await dispatch(
        updateTaskStatus({
          id: taskId,
          status: 'completed',
          completionPhotoUrls,
          ...(completionRemarks ? {completionRemarks} : {}),
          ...(causeOfFault ? {causeOfFault} : {}),
          signatureDeclineReason: declineReason.trim(),
        }),
      );

      if (updateTaskStatus.fulfilled.match(result)) {
        setShowDeclineModal(false);
        Alert.alert(
          'Task Completed',
          'Task completed without a signature. This has been flagged for your Team Lead to review before payment submission.',
          [{text: 'OK', onPress: () => navigation.navigate('TechnicianTabs')}],
        );
      } else {
        Alert.alert(
          'Completion Failed',
          (result.payload as string) || 'Could not complete the job.',
        );
      }
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Signature</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>
          Please ask the customer to sign below to confirm the work is
          completed
        </Text>

        <View style={styles.signaturePad}>
          <SignatureCanvas
            ref={signatureRef}
            onOK={setSignature}
            onEmpty={() => setSignature('')}
            descriptionText=""
            clearText="Clear"
            confirmText="Save"
            webStyle={`
              .m-signature-pad { box-shadow: none; border: none; }
              .m-signature-pad--body { border: none; }
              .m-signature-pad--footer { display: none; }
              body, html { width: 100%; height: 100%; }
            `}
            style={styles.signatureCanvas}
          />
        </View>

        <View style={styles.signatureActions}>
          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => signatureRef.current?.readSignature()}>
            <Text style={styles.saveButtonText}>Save Signature</Text>
          </TouchableOpacity>
        </View>

        {signature ? (
          <Text style={styles.signedText}>✅ Signature captured</Text>
        ) : (
          <Text style={styles.notSignedText}>⚠️ Signature required</Text>
        )}

        <TouchableOpacity
          style={[styles.button, (!signature || isSubmitting) && styles.buttonDisabled]}
          onPress={handleComplete}
          disabled={!signature || isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Complete Task</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.declineLink}
          onPress={() => setShowDeclineModal(true)}
          disabled={isSubmitting}>
          <Text style={styles.declineLinkText}>
            Client unavailable / declined to sign
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showDeclineModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeclineModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Client Unavailable / Declined to Sign</Text>
            <Text style={styles.modalSubtitle}>
              The job can still be completed. Please enter a reason — it will
              be flagged for your Team Lead to review before payment
              submission.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Client left the property before work finished"
              placeholderTextColor={colors.textLight}
              value={declineReason}
              onChangeText={setDeclineReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowDeclineModal(false);
                  setDeclineReason('');
                }}
                disabled={isDeclining}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  (!declineReason.trim() || isDeclining) &&
                    styles.buttonDisabled,
                ]}
                onPress={handleDeclineConfirm}
                disabled={!declineReason.trim() || isDeclining}>
                {isDeclining ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>
                    Complete Without Signature
                  </Text>
                )}
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
  content: {
    padding: spacing.lg,
    flex: 1,
  },
  instruction: {
    fontSize: typography.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: typography.lineHeightMd,
  },
  signaturePad: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  signatureCanvas: {
    flex: 1,
  },
  signatureActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  clearButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
  },
  clearButtonText: {
    color: colors.error,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  saveButton: {
    flex: 2,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  signedText: {
    textAlign: 'center',
    color: colors.success,
    fontSize: typography.sm,
    fontWeight: typography.medium,
    marginBottom: spacing.md,
  },
  notSignedText: {
    textAlign: 'center',
    color: colors.error,
    fontSize: typography.sm,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  buttonDisabled: {
    backgroundColor: colors.textLight,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  declineLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  declineLinkText: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalSubtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: typography.lineHeightMd,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.md,
    color: colors.textPrimary,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  modalConfirmButton: {
    flex: 2,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    backgroundColor: colors.warning,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
});

export default SignatureScreen;
