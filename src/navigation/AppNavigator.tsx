import React, {useEffect, useState} from 'react';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {restoreSession} from '@store/slices/authSlice';
import {setAuthToken} from '@services/api';
import {colors} from '@theme/colors';

import AuthNavigator from './AuthNavigator';
import ClientNavigator from './ClientNavigator';
import TechnicianNavigator from './TechnicianNavigator';
import TeamLeadNavigator from './TeamLeadNavigator';

const AppNavigator = () => {
  const dispatch = useAppDispatch();
  const {isAuthenticated, user} = useAppSelector(
    state => state.auth,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
    console.log('isAuthenticated:', isAuthenticated);
    console.log('user:', user);
    console.log('isLoading:', isLoading);
    
  }, []);

  const checkAuthState = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');

      if (token && storedUser) {
        setAuthToken(token);
        const parsedUser = JSON.parse(storedUser);
        dispatch(restoreSession(parsedUser));
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const getNavigator = () => {
    if (!isAuthenticated || !user) {
      return <AuthNavigator />;
    }
    console.log('[NAV] Routing for role:', user.role);
    switch (user.role) {
      case 'client':
        return <ClientNavigator />;
      case 'technician':
        return <TechnicianNavigator />;
      case 'teamlead':
      case 'admin':
      case 'super_admin':
        return <TeamLeadNavigator />;
      default:
        console.warn('[NAV] Unrecognised role, showing auth:', user.role);
        return <AuthNavigator />;
    }
  };

  return (
    <NavigationContainer>
      {getNavigator()}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

export default AppNavigator;