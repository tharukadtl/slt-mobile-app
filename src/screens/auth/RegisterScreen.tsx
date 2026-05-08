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
import {register} from '@store/slices/authSlice';
import {validatePhone} from '@utils/validators';

type RegisterNavigationProp = StackNavigationProp<AuthStackParamList>;

const RegisterScreen = () => {
  const navigation = useNavigation<RegisterNavigationProp>();
  const dispatch = useAppDispatch();
  const {isLoading, error} = useAppSelector(state => state.auth);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [firstNameError, setFirstNameError] = useState('');
  const [lastNameError, setLastNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleRegister = async () => {
    setFirstNameError('');
    setLastNameError('');
    setPhoneError('');
    setPasswordError('');

    if (!firstName.trim()) {
      setFirstNameError('Please enter your first name');
      return;
    }
    if (!lastName.trim()) {
      setLastNameError('Please enter your last name');
      return;
    }
    if (!phoneNumber) {
      setPhoneError('Please enter your phone number');
      return;
    }
    if (!validatePhone(phoneNumber)) {
      setPhoneError('Please enter a valid 9-digit phone number');
      return;
    }
    if (!password) {
      setPasswordError('Please enter a password');
      return;
    }
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    const result = await dispatch(
      register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: '0' + phoneNumber,
        password,
        email: email.trim() || undefined,
      }),
    );

    if (!register.fulfilled.match(result)) {
      Alert.alert(
        'Registration Failed',
        (result.payload as string) || 'Please try again.',
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>SLT</Text>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Register to manage your SLT services
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>

          {/* First Name */}
          <Text style={styles.label}>First Name *</Text>
          <TextInput
            style={[styles.input, firstNameError ? styles.inputError : null]}
            placeholder="Enter your first name"
            placeholderTextColor={colors.textLight}
            value={firstName}
            onChangeText={t => {
              setFirstName(t);
              setFirstNameError('');
            }}
            autoCapitalize="words"
          />
          {firstNameError !== '' && (
            <Text style={styles.errorText}>{firstNameError}</Text>
          )}

          {/* Last Name */}
          <Text style={styles.label}>Last Name *</Text>
          <TextInput
            style={[styles.input, lastNameError ? styles.inputError : null]}
            placeholder="Enter your last name"
            placeholderTextColor={colors.textLight}
            value={lastName}
            onChangeText={t => {
              setLastName(t);
              setLastNameError('');
            }}
            autoCapitalize="words"
          />
          {lastNameError !== '' && (
            <Text style={styles.errorText}>{lastNameError}</Text>
          )}

          {/* Phone */}
          <Text style={styles.label}>Mobile Number *</Text>
          <View
            style={[
              styles.phoneInputContainer,
              phoneError ? styles.inputError : null,
            ]}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>+94</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="771234567"
              placeholderTextColor={colors.textLight}
              value={phoneNumber}
              onChangeText={t => {
                setPhoneNumber(t.replace(/[^0-9]/g, ''));
                setPhoneError('');
              }}
              keyboardType="numeric"
              maxLength={9}
            />
          </View>
          {phoneError !== '' && (
            <Text style={styles.errorText}>{phoneError}</Text>
          )}

          {/* Email (optional) */}
          <Text style={styles.label}>Email (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email address"
            placeholderTextColor={colors.textLight}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Password */}
          <Text style={styles.label}>Password *</Text>
          <View
            style={[
              styles.passwordContainer,
              passwordError ? styles.inputError : null,
            ]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Min. 6 characters"
              placeholderTextColor={colors.textLight}
              value={password}
              onChangeText={t => {
                setPassword(t);
                setPasswordError('');
              }}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(p => !p)}
              style={styles.eyeButton}>
              <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text style={styles.label}>Confirm Password *</Text>
          <View
            style={[
              styles.passwordContainer,
              passwordError ? styles.inputError : null,
            ]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Re-enter your password"
              placeholderTextColor={colors.textLight}
              value={confirmPassword}
              onChangeText={t => {
                setConfirmPassword(t);
                setPasswordError('');
              }}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(p => !p)}
              style={styles.eyeButton}>
              <Text style={styles.eyeText}>
                {showConfirmPassword ? '🙈' : '👁️'}
              </Text>
            </TouchableOpacity>
          </View>
          {passwordError !== '' && (
            <Text style={styles.errorText}>{passwordError}</Text>
          )}

          {/* API Error */}
          {error && (
            <View style={styles.apiErrorContainer}>
              <Text style={styles.apiErrorText}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.registerButton,
              (!firstName || !lastName || !phoneNumber || !password || isLoading) &&
                styles.registerButtonDisabled,
            ]}
            onPress={handleRegister}
            disabled={
              !firstName || !lastName || !phoneNumber || !password || isLoading
            }>
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.registerButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Back to Login */}
          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLinkText}>
              Already have an account?{' '}
              <Text style={styles.loginLinkBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>

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
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
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
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.md,
    color: colors.white,
    opacity: 0.8,
    textAlign: 'center',
  },
  form: {
    padding: spacing.lg,
    flex: 1,
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
  inputError: {
    borderColor: colors.error,
  },
  phoneInputContainer: {
    flexDirection: 'row',
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
  passwordContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.md,
    color: colors.textPrimary,
  },
  eyeButton: {
    paddingHorizontal: spacing.md,
  },
  eyeText: {
    fontSize: 18,
  },
  errorText: {
    fontSize: typography.sm,
    color: colors.error,
    marginTop: spacing.xs,
  },
  apiErrorContainer: {
    backgroundColor: colors.error + '15',
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  apiErrorText: {
    fontSize: typography.sm,
    color: colors.error,
  },
  registerButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  registerButtonDisabled: {
    backgroundColor: colors.textLight,
    elevation: 0,
    shadowOpacity: 0,
  },
  registerButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  loginLinkText: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  loginLinkBold: {
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

export default RegisterScreen;
