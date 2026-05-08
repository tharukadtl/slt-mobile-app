import React, {useEffect} from 'react';
import {Provider} from 'react-redux';
import {store} from './src/store/index';
import AppNavigator from './src/navigation/AppNavigator';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {
  getMessaging,
  setBackgroundMessageHandler,
  requestPermission,
  getToken,
  onTokenRefresh,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';

// Handle background messages (must be registered at module level)
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  console.log('Background Message received:', remoteMessage);
});

const App = () => {
  useEffect(() => {
    const m = getMessaging();

    requestPermission(m).then(authStatus => {
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;
      if (enabled) {
        console.log('Notification permission granted');
      }
    });

    getToken(m).then(token => {
      console.log('FCM Token:', token);
    });

    const unsubscribeTokenRefresh = onTokenRefresh(m, token => {
      console.log('FCM Token refreshed:', token);
    });

    return () => {
      unsubscribeTokenRefresh();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <Provider store={store}>
          <AppNavigator />
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;