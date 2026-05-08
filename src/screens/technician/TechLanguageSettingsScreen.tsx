import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {updateProfile} from '@store/slices/authSlice';

const LANGUAGES = [
  {code: 'ENGLISH', label: 'English', nativeLabel: 'English', flag: '🇬🇧'},
  {code: 'SINHALA', label: 'Sinhala', nativeLabel: 'සිංහල', flag: '🇱🇰'},
  {code: 'TAMIL', label: 'Tamil', nativeLabel: 'தமிழ்', flag: '🇱🇰'},
];

const TechLanguageSettingsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const {user} = useAppSelector(state => state.auth);
  const [selectedLanguage, setSelectedLanguage] = useState(
    user?.language || 'ENGLISH',
  );

  const handleSave = async () => {
    const result = await dispatch(
      updateProfile({
        fullName: user?.name || '',
        email: user?.email || '',
        language: selectedLanguage,
        notificationPreferences: user?.notificationPreferences || {
          statusUpdates: true,
          technicianAssigned: true,
          jobCompleted: true,
          billing: true,
          promotions: false,
        },
      }),
    );
    if (updateProfile.fulfilled.match(result)) {
      Alert.alert('Success', 'Language updated successfully', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Language</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionInfo}>
          Select your preferred language for the app
        </Text>

        <View style={styles.card}>
          {LANGUAGES.map((lang, index) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageItem,
                index < LANGUAGES.length - 1 &&
                  styles.languageItemBorder,
                selectedLanguage === lang.code &&
                  styles.languageItemSelected,
              ]}
              onPress={() => setSelectedLanguage(lang.code)}>
              <Text style={styles.languageFlag}>{lang.flag}</Text>
              <View style={styles.languageInfo}>
                <Text style={styles.languageLabel}>
                  {lang.label}
                </Text>
                <Text style={styles.languageNative}>
                  {lang.nativeLabel}
                </Text>
              </View>
              <View
                style={[
                  styles.radioButton,
                  selectedLanguage === lang.code &&
                    styles.radioButtonSelected,
                ]}>
                {selectedLanguage === lang.code && (
                  <View style={styles.radioButtonInner} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Language</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  },
  sectionInfo: {
    fontSize: typography.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
  },
  languageItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  languageItemSelected: {
    backgroundColor: colors.primary + '08',
  },
  languageFlag: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  languageInfo: {
    flex: 1,
  },
  languageLabel: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  languageNative: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: colors.primary,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
});

export default TechLanguageSettingsScreen;