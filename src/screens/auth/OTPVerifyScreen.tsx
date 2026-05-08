import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {AuthStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {verifyOTP, sendOTP} from '@store/slices/authSlice';

type OTPRouteProp = RouteProp<AuthStackParamList, 'OTPVerify'>;

const OTPVerifyScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<OTPRouteProp>();
  const dispatch = useAppDispatch();
  const {isLoading} = useAppSelector(state => state.auth);
  const {phoneNumber} = route.params;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<TextInput[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    // Auto submit when all 6 digits entered
    if (value && index === 5) {
      const otpString = [...newOtp.slice(0, 5), value].join('');
      if (otpString.length === 6) {
        handleVerify(otpString);
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (
      e.nativeEvent.key === 'Backspace' &&
      !otp[index] &&
      index > 0
    ) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpString?: string) => {
    const code = otpString || otp.join('');
    console.log('=== OTP VERIFY DEBUG ===');
    console.log('Phone:', phoneNumber);
    console.log('OTP:', code);

    if (code.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit OTP');
      return;
    }

    const result = await dispatch(
      verifyOTP({phoneNumber, otp: code}),
    );

    console.log('Result type:', result.type);
    console.log('Result payload:', JSON.stringify(result.payload));

    if (verifyOTP.rejected.match(result)) {
      Alert.alert(
        'Error',
        (result.payload as string) ||
          'Invalid OTP. Please try again.',
      );
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
    // If fulfilled — AppNavigator will automatically route
    // based on user role from Redux state
  };

  const handleResend = async () => {
    if (!canResend) return;
    const result = await dispatch(sendOTP({phoneNumber}));
    if (sendOTP.fulfilled.match(result)) {
      setCountdown(60);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      Alert.alert('Success', 'OTP sent again successfully');
    } else {
      Alert.alert('Error', 'Failed to resend OTP');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={styles.phoneText}>{phoneNumber}</Text>
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {/* OTP Inputs */}
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={ref => {
                if (ref) inputRefs.current[index] = ref;
              }}
              style={[
                styles.otpInput,
                digit ? styles.otpInputFilled : null,
              ]}
              value={digit}
              onChangeText={value =>
                handleOtpChange(value, index)
              }
              onKeyPress={e => handleKeyPress(e, index)}
              keyboardType="numeric"
              maxLength={1}
              textAlign="center"
              autoFocus={index === 0}
            />
          ))}
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={[
            styles.verifyButton,
            (otp.join('').length !== 6 || isLoading) &&
              styles.verifyButtonDisabled,
          ]}
          onPress={() => handleVerify()}
          disabled={otp.join('').length !== 6 || isLoading}>
          {isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.verifyButtonText}>
              Verify OTP
            </Text>
          )}
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendContainer}>
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendLink}>
                Resend OTP
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.countdownText}>
              Resend OTP in{' '}
              <Text style={styles.countdownNumber}>
                {countdown}s
              </Text>
            </Text>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            💡 Check your IntelliJ console for the OTP code
            during development
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  backText: {
    color: colors.white,
    fontSize: typography.md,
  },
  title: {
    fontSize: typography.xxxl,
    fontWeight: typography.bold,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.md,
    color: colors.white,
    opacity: 0.8,
    lineHeight: typography.lineHeightMd,
  },
  phoneText: {
    fontWeight: typography.bold,
    opacity: 1,
  },
  form: {
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.white,
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    elevation: 1,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  otpInputFilled: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primary + '08',
  },
  verifyButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.lg,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  verifyButtonDisabled: {
    backgroundColor: colors.textLight,
    elevation: 0,
    shadowOpacity: 0,
  },
  verifyButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  countdownText: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  countdownNumber: {
    color: colors.primary,
    fontWeight: typography.bold,
  },
  resendLink: {
    color: colors.primary,
    fontSize: typography.md,
    fontWeight: typography.bold,
    textDecorationLine: 'underline',
  },
  infoContainer: {
    backgroundColor: colors.secondary + '15',
    borderRadius: 8,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
  },
  infoText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeightMd,
  },
});

export default OTPVerifyScreen;