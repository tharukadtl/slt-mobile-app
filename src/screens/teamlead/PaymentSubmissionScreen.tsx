import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TeamLeadStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {PaymentMaterial, LaborDetails} from '@appTypes/technician.types';
import {formatCurrency} from '@utils/formatters';
import api from '@services/api';

import Step1Materials from './payment/Step1Materials';
import Step2Labor from './payment/Step2Labor';
import Step3Justification from './payment/Step3Justification';
import Step4Signature from './payment/Step4Signature';

type PaymentSubmissionRouteProp = RouteProp<
  TeamLeadStackParamList,
  'PaymentSubmission'
>;
type PaymentSubmissionNavigationProp =
  StackNavigationProp<TeamLeadStackParamList>;

const STEPS = [
  {id: 1, label: 'Materials'},
  {id: 2, label: 'Labor'},
  {id: 3, label: 'Justification'},
  {id: 4, label: 'Signature'},
];

const PaymentSubmissionScreen = () => {
  const navigation = useNavigation<PaymentSubmissionNavigationProp>();
  const route = useRoute<PaymentSubmissionRouteProp>();
  const {taskId} = route.params;

  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 - Materials
  const [materials, setMaterials] = useState<PaymentMaterial[]>([]);

  // Step 2 - Labor
  const [labor, setLabor] = useState<LaborDetails>({
    startTime: '',
    endTime: '',
    totalHours: 0,
    hourlyRate: 500,
    laborCharges: 0,
    type: 'CHARGEABLE',
  });

  // Step 3 - Justification
  const [justification, setJustification] = useState('');
  const [justificationPhotos, setJustificationPhotos] = useState<string[]>([]);


  // Step 4 - Signature
  const [customerName, setCustomerName] = useState('');
  const [customerSignature, setCustomerSignature] = useState('');
  const [customerAgreed, setCustomerAgreed] = useState(false);

  // Calculations
  const materialsFOC = materials
    .filter(m => m.type === 'FOC')
    .reduce((sum, m) => sum + m.subtotal, 0);

  const materialsChargeable = materials
    .filter(m => m.type === 'CHARGEABLE')
    .reduce((sum, m) => sum + m.subtotal, 0);

  const laborCharges =
    labor.type === 'CHARGEABLE' ? labor.laborCharges : 0;

  const totalFOC =
    materialsFOC + (labor.type === 'FOC' ? labor.laborCharges : 0);

  const totalChargeable = materialsChargeable + laborCharges;
  const grandTotal = totalChargeable;

  const handleNext = () => {
    if (currentStep === 1 && materials.length === 0) {
      Alert.alert('Error', 'Please add at least one material');
      return;
    }
    if (currentStep === 2 && !labor.startTime) {
      Alert.alert('Error', 'Please enter work start and end time');
      return;
    }
    if (
      currentStep === 3 &&
      totalChargeable > 0 &&
      justification.trim().length < 50
    ) {
      Alert.alert(
        'Error',
        'Justification must be at least 50 characters for chargeable work',
      );
      return;
    }
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    if (!customerAgreed) {
      Alert.alert(
        'Error',
        'Customer must agree to all terms before submission',
      );
      return;
    }
    if (!customerSignature) {
      Alert.alert('Error', 'Customer signature is required');
      return;
    }

    Alert.alert(
      'Submit Payment',
      `Total chargeable amount: ${formatCurrency(grandTotal)}\n\nAre you sure you want to submit?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Submit',
          onPress: async () => {
            try {
              await api.post('/api/payments', {
                jobId: Number(taskId),
                materialsFocTotal: materialsFOC,
                materialsChargeableTotal: materialsChargeable,
                labourCharge: laborCharges,
                customerSignatureUrl: customerSignature,
                materialJustification: justification,
                workSummary: justification,
              });
              Alert.alert(
                'Success',
                'Payment submitted successfully for admin review',
                [{text: 'OK', onPress: () => navigation.navigate('TeamLeadTabs')}],
              );
            } catch (e: any) {
              Alert.alert(
                'Submission Failed',
                e.response?.data?.message || e.message || 'Could not submit payment',
              );
            }
          },
        },
      ],
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1Materials
            materials={materials}
            onMaterialsChange={setMaterials}
            materialsFOC={materialsFOC}
            materialsChargeable={materialsChargeable}
          />
        );
      case 2:
        return (
          <Step2Labor
            labor={labor}
            onLaborChange={setLabor}
            materialsTotal={materialsChargeable + materialsFOC}
          />
        );
      case 3:
        return (
          <Step3Justification
            justification={justification}
            onJustificationChange={setJustification}
            photos={justificationPhotos}
            onPhotosChange={setJustificationPhotos}
            totalChargeable={totalChargeable}
            materialsFOC={materialsFOC}
            materialsChargeable={materialsChargeable}
            laborCharges={laborCharges}
            grandTotal={grandTotal}
          />
        );
      case 4:
        return (
          <Step4Signature
            customerName={customerName}
            onCustomerNameChange={setCustomerName}
            customerSignature={customerSignature}
            onSignatureChange={setCustomerSignature}
            customerAgreed={customerAgreed}
            onAgreedChange={setCustomerAgreed}
            materialsFOC={materialsFOC}
            materialsChargeable={materialsChargeable}
            laborCharges={laborCharges}
            totalFOC={totalFOC}
            totalChargeable={totalChargeable}
            grandTotal={grandTotal}
            justification={justification}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Submission</Text>
        <Text style={styles.taskId}>Task #{taskId}</Text>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        {STEPS.map((step, index) => (
          <React.Fragment key={step.id}>
            <View style={styles.stepContainer}>
              <View
                style={[
                  styles.stepCircle,
                  currentStep >= step.id && styles.stepCircleActive,
                  currentStep === step.id && styles.stepCircleCurrent,
                ]}>
                <Text
                  style={[
                    styles.stepNumber,
                    currentStep >= step.id && styles.stepNumberActive,
                  ]}>
                  {currentStep > step.id ? '✓' : step.id}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  currentStep >= step.id && styles.stepLabelActive,
                ]}>
                {step.label}
              </Text>
            </View>
            {index < STEPS.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  currentStep > step.id && styles.stepLineActive,
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Step Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}>
          <Text style={styles.backButtonText}>
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Text>
        </TouchableOpacity>

        {currentStep < 4 ? (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}>
            <Text style={styles.nextButtonText}>Next →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!customerAgreed || !customerSignature) &&
                styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!customerAgreed || !customerSignature}>
            <Text style={styles.submitButtonText}>Submit Payment</Text>
          </TouchableOpacity>
        )}
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
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  backText: {
    color: colors.white,
    fontSize: typography.md,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  taskId: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepContainer: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepCircleActive: {
    backgroundColor: colors.primary + '40',
  },
  stepCircleCurrent: {
    backgroundColor: colors.primary,
  },
  stepNumber: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textSecondary,
  },
  stepNumberActive: {
    color: colors.white,
  },
  stepLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: typography.medium,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  bottomNav: {
    flexDirection: 'row',
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  nextButton: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  submitButton: {
    flex: 2,
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.textLight,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
});

export default PaymentSubmissionScreen;