import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const notificationService = {
  requestPermission: async (): Promise<boolean> => {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  },

  getFCMToken: async (): Promise<string | null> => {
    try {
      const token = await messaging().getToken();
      await AsyncStorage.setItem('fcmToken', token);
      await api.post('/notifications/token', {token});
      return token;
    } catch (error) {
      return null;
    }
  },

  onForegroundMessage: (callback: (message: any) => void) => {
    return messaging().onMessage(async remoteMessage => {
      callback(remoteMessage);
    });
  },
};

export default notificationService;