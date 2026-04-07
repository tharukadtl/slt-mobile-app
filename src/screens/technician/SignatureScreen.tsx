import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
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

const SignatureScreen = () => {
  const navigation = useNavigation<SignatureNavigationProp>();
  const route = useRoute<SignatureRouteProp>();
  const dispatch = useAppDispatch();
  const {taskId} = route.params;

  const handleComplete = async () => {
    await technicianService.submitSignature(taskId, 'signature_placeholder');
    await dispatch(updateTaskStatus({taskId, status: 'completed'}));
    Alert.alert('Success', 'Task completed successfully!', [
      {
        text: 'OK',
        onPress: () => navigation.navigate('TechnicianTabs'),
      },
    ]);
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
          <Text style={styles.signaturePlaceholder}>
            Signature Pad{'\n'}(Sign here)
          </Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleComplete}>
          <Text style={styles.buttonText}>Complete Task</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  signaturePlaceholder: {
    fontSize: typography.lg,
    color: colors.textLight,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
});

export default SignatureScreen;