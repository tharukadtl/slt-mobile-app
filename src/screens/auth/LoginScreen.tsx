import React, {useState} from 'react';
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
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {AuthStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {sendOTP} from '@store/slices/authSlice';

type LoginNavigationProp = StackNavigationProp<AuthStackParamList>;
type UserType = 'client' | 'staff';

const LoginScreen = () => {
  const navigation = useNavigation<LoginNavigationProp>();
  const dispatch = useAppDispatch();
  const {isLoading, error} = useAppSelector(state => state.auth);

  const [userType, setUserType] = useState<UserType>('client');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const handleTabSwitch = (type: UserType) => {
    setUserType(type);
    setPhoneNumber('');
    setPhoneError('');
  };

  const handleSendOTP = async () => {
    setPhoneError('');

    if (!phoneNumber) {
      setPhoneError('Please enter your phone number');
      return;
    }

    const digits = phoneNumber.startsWith('0')
      ? phoneNumber.slice(1)
      : phoneNumber;

    if (!/^[0-9]{9}$/.test(digits)) {
      setPhoneError('Please enter a valid mobile number (e.g. 0717 123 456)');
      return;
    }

    const fullPhone = '0' + digits;
    const result = await dispatch(sendOTP({phoneNumber: fullPhone}));

    if (sendOTP.fulfilled.match(result)) {
      navigation.navigate('OTPVerify', {phoneNumber: fullPhone});
    } else {
      const message =
        userType === 'staff'
          ? (result.payload as string) ||
            'Could not send OTP. Please ensure your number is registered by the administrator.'
          : (result.payload as string) ||
            'Could not send OTP. Please check your number and try again.';
      Alert.alert('OTP Failed', message);
    }
  };

  const isStaff = userType === 'staff';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>SLT</Text>
            </View>
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            {isStaff
              ? 'Sign in with your registered staff number'
              : 'Sign in or create a new account'}
          </Text>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, !isStaff && styles.tabActive]}
            onPress={() => handleTabSwitch('client')}>
            <Text style={[styles.tabText, !isStaff && styles.tabTextActive]}>
              Client
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, isStaff && styles.tabActive]}
            onPress={() => handleTabSwitch('staff')}>
            <Text style={[styles.tabText, isStaff && styles.tabTextActive]}>
              Staff
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>

          {/* Staff notice */}
          {isStaff && (
            <View style={styles.staffNotice}>
              <Text style={styles.staffNoticeText}>
                For Technicians & Team Leads. Your account is managed by the SLT administrator.
              </Text>
            </View>
          )}

          <Text style={styles.label}>Mobile Number</Text>
          <View style={styles.phoneInputContainer}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>+94</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="0717730773"
              placeholderTextColor={colors.textLight}
              value={phoneNumber}
              onChangeText={text => {
                setPhoneNumber(text.replace(/[^0-9]/g, ''));
                setPhoneError('');
              }}
              keyboardType="numeric"
              maxLength={10}
              autoFocus={false}
            />
          </View>

          {phoneError !== '' && (
            <Text style={styles.errorText}>{phoneError}</Text>
          )}

          {error && (
            <View style={styles.apiErrorContainer}>
              <Text style={styles.apiErrorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.sendOTPButton,
              (!phoneNumber || isLoading) && styles.sendOTPButtonDisabled,
            ]}
            onPress={handleSendOTP}
            disabled={!phoneNumber || isLoading}>
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.sendOTPButtonText}>Send OTP</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.infoText}>
            {isStaff
              ? 'An OTP will be sent to your registered staff mobile number.'
              : 'An OTP will be sent to verify your identity.'}
          </Text>

          {/* Register link — clients only */}
          {!isStaff && (
            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLinkText}>
                New customer?{' '}
                <Text style={styles.registerLinkBold}>Create an Account</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Sri Lanka Telecom PLC</Text>
          <Text style={styles.footerSubText}>
            SLT After-Service Management System
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: spacing.lg,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  logoText: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.primary,
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
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.border,
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: typography.bold,
  },
  form: {
    padding: spacing.lg,
    marginTop: spacing.md,
    flex: 1,
  },
  staffNotice: {
    backgroundColor: colors.secondary + '18',
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
  },
  staffNoticeText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeightMd,
  },
  label: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  countryCode: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.lg,
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  errorText: {
    fontSize: typography.sm,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  apiErrorContainer: {
    backgroundColor: colors.error + '15',
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  apiErrorText: {
    fontSize: typography.sm,
    color: colors.error,
    lineHeight: typography.lineHeightMd,
  },
  sendOTPButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  sendOTPButtonDisabled: {
    backgroundColor: colors.textLight,
    elevation: 0,
    shadowOpacity: 0,
  },
  sendOTPButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  infoText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeightMd,
    marginBottom: spacing.sm,
  },
  registerLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  registerLinkText: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  registerLinkBold: {
    color: colors.primary,
    fontWeight: typography.bold,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  footerText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  footerSubText: {
    fontSize: typography.xs,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
});

export default LoginScreen;
