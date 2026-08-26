import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
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
      </View>
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
});

export default SignatureScreen;
