import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  SafeAreaView,
} from 'react-native';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  timestamp: string;
  isRead: boolean;
}

const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showModal, setShowModal] = useState(false);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const stored = await AsyncStorage.getItem('notifications');
      if (stored) {
        setNotifications(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const markAllAsRead = async () => {
    const updated = notifications.map(n => ({...n, isRead: true}));
    setNotifications(updated);
    await AsyncStorage.setItem('notifications', JSON.stringify(updated));
  };

  const clearAll = async () => {
    setNotifications([]);
    await AsyncStorage.removeItem('notifications');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'STATUS_UPDATE': return '🔄';
      case 'TECHNICIAN_ASSIGNED': return '👨‍🔧';
      case 'JOB_COMPLETED': return '✅';
      case 'BILLING': return '💰';
      default: return '🔔';
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.bellContainer}
        onPress={() => {
          setShowModal(true);
          markAllAsRead();
        }}>
        <Text style={styles.bellIcon}>🔔</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <View style={styles.modalActions}>
              {notifications.length > 0 && (
                <TouchableOpacity onPress={clearAll}>
                  <Text style={styles.clearText}>Clear All</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowModal(false)}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={notifications}
            keyExtractor={item => item.id}
            renderItem={({item}) => (
              <View
                style={[
                  styles.notificationItem,
                  !item.isRead && styles.notificationUnread,
                ]}>
                <Text style={styles.notificationIcon}>
                  {getNotificationIcon(item.type)}
                </Text>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationTitle}>
                    {item.title}
                  </Text>
                  <Text style={styles.notificationBody}>
                    {item.body}
                  </Text>
                  <Text style={styles.notificationTime}>
                    {item.timestamp}
                  </Text>
                </View>
                {!item.isRead && <View style={styles.unreadDot} />}
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔔</Text>
                <Text style={styles.emptyText}>No notifications yet</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bellContainer: {
    position: 'relative',
    padding: spacing.xs,
  },
  bellIcon: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: typography.bold,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.primary,
    paddingTop: 50,
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  clearText: {
    color: colors.white,
    fontSize: typography.sm,
    opacity: 0.8,
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'flex-start',
  },
  notificationUnread: {
    backgroundColor: colors.primary + '08',
  },
  notificationIcon: {
    fontSize: 24,
    marginRight: spacing.md,
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  notificationBody: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: typography.lineHeightMd,
  },
  notificationTime: {
    fontSize: typography.xs,
    color: colors.textLight,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.lg,
    color: colors.textSecondary,
  },
});

export default NotificationBell;