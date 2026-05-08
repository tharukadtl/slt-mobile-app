import {
  getMessaging,
  requestPermission,
  getToken,
  onTokenRefresh,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Alert} from 'react-native';
import api from './api';

export interface NotificationData {
  type:
    | 'STATUS_UPDATE'
    | 'TECHNICIAN_ASSIGNED'
    | 'JOB_COMPLETED'
    | 'BILLING';
  issueId?: string;
  billId?: string;
  title: string;
  body: string;
}

const notificationService = {
  requestPermission: async (): Promise<boolean> => {
    try {
      const authStatus = await requestPermission(getMessaging());
      return (
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL
      );
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  },

  getFCMToken: async (): Promise<string | null> => {
    try {
      const token = await getToken(getMessaging());
      if (token) {
        await AsyncStorage.setItem('fcmToken', token);
        try {
          await api.post('/api/users/fcm-token', {fcmToken: token});
        } catch (error) {
          console.log('Failed to save FCM token to server:', error);
        }
      }
      return token;
    } catch (error) {
      console.error('FCM token error:', error);
      return null;
    }
  },

  onTokenRefresh: () => {
    return onTokenRefresh(getMessaging(), async token => {
      await AsyncStorage.setItem('fcmToken', token);
      try {
        await api.post('/api/users/fcm-token', {fcmToken: token});
      } catch (error) {
        console.log('Failed to update FCM token:', error);
      }
    });
  },

  onForegroundMessage: (
    callback: (data: NotificationData) => void,
  ) => {
    return onMessage(getMessaging(), async remoteMessage => {
      const data = remoteMessage.data as unknown as NotificationData;
      if (data) {
        callback(data);
        Alert.alert(
          remoteMessage.notification?.title || 'SLT Notification',
          remoteMessage.notification?.body || '',
        );
      }
    });
  },

  onNotificationOpenedApp: (
    callback: (data: NotificationData) => void,
  ) => {
    return onNotificationOpenedApp(getMessaging(), remoteMessage => {
      const data = remoteMessage.data as unknown as NotificationData;
      if (data) callback(data);
    });
  },

  getInitialNotification: async (): Promise<NotificationData | null> => {
    const remoteMessage = await getInitialNotification(getMessaging());
    if (remoteMessage?.data) {
      return remoteMessage.data as unknown as NotificationData;
    }
    return null;
  },

  initialize: async (
    onNotification: (data: NotificationData) => void,
  ): Promise<void> => {
    const hasPermission = await notificationService.requestPermission();
    if (!hasPermission) {
      console.log('Notification permission denied');
      return;
    }

    await notificationService.getFCMToken();
    notificationService.onTokenRefresh();
    notificationService.onForegroundMessage(onNotification);
    notificationService.onNotificationOpenedApp(onNotification);

    const initialNotification =
      await notificationService.getInitialNotification();
    if (initialNotification) {
      onNotification(initialNotification);
    }
  },
};

export default notificationService;