import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {updateProfile} from '@store/slices/authSlice';

const TechNotificationSettingsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const {user} = useAppSelector(state => state.auth);

  const [preferences, setPreferences] = useState({
    statusUpdates:
      user?.notificationPreferences?.statusUpdates ?? true,
    technicianAssigned:
      user?.notificationPreferences?.technicianAssigned ?? true,
    jobCompleted:
      user?.notificationPreferences?.jobCompleted ?? true,
    billing: user?.notificationPreferences?.billing ?? true,
    promotions:
      user?.notificationPreferences?.promotions ?? false,
  });

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences(prev => ({...prev, [key]: !prev[key]}));
  };

  const handleSave = async () => {
    const result = await dispatch(
      updateProfile({
        fullName: user?.name || '',
        email: user?.email || '',
        language: user?.language || 'ENGLISH',
        notificationPreferences: preferences,
      }),
    );
    if (updateProfile.fulfilled.match(result)) {
      Alert.alert('Success', 'Notification settings saved', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    }
  };

  const notificationItems = [
    {
      key: 'statusUpdates' as const,
      title: 'Job Status Updates',
      description: 'Notifications when job status changes',
      icon: '🔄',
    },
    {
      key: 'technicianAssigned' as const,
      title: 'New Job Assigned',
      description: 'Notify when a new job is assigned to you',
      icon: '📋',
    },
    {
      key: 'jobCompleted' as const,
      title: 'Job Completion',
      description: 'Notifications for completed jobs',
      icon: '✅',
    },
    {
      key: 'billing' as const,
      title: 'Payment Updates',
      description: 'Payment submission status updates',
      icon: '💰',
    },
    {
      key: 'promotions' as const,
      title: 'General Announcements',
      description: 'Team announcements and updates',
      icon: '📢',
    },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionInfo}>
          Choose which notifications you want to receive
        </Text>

        <View style={styles.card}>
          {notificationItems.map((item, index) => (
            <View
              key={item.key}
              style={[
                styles.notificationItem,
                index < notificationItems.length - 1 &&
                  styles.notificationItemBorder,
              ]}>
              <Text style={styles.notificationIcon}>
                {item.icon}
              </Text>
              <View style={styles.notificationInfo}>
                <Text style={styles.notificationTitle}>
                  {item.title}
                </Text>
                <Text style={styles.notificationDescription}>
                  {item.description}
                </Text>
              </View>
              <Switch
                value={preferences[item.key]}
                onValueChange={() => handleToggle(item.key)}
                trackColor={{
                  false: colors.border,
                  true: colors.primary + '80',
                }}
                thumbColor={
                  preferences[item.key]
                    ? colors.primary
                    : colors.textLight
                }
              />
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Settings</Text>
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
    lineHeight: typography.lineHeightMd,
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
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  notificationItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  notificationIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  notificationInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  notificationTitle: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  notificationDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeightMd,
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

export default TechNotificationSettingsScreen;