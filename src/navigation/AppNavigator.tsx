import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {useAppSelector} from '@store/hooks';
import AuthNavigator from './AuthNavigator';
import ClientNavigator from './ClientNavigator';
import TechnicianNavigator from './TechnicianNavigator';
import TeamLeadNavigator from './TeamLeadNavigator';
import authService from '@services/authService';
import {ActivityIndicator, View} from 'react-native';
import {colors} from '@theme/colors';

const AppNavigator = () => {
  const {isAuthenticated, user} = useAppSelector(state => state.auth);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkStoredAuth();
  }, []);

  const checkStoredAuth = async () => {
    try {
      await authService.getStoredUser();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const getNavigator = () => {
    if (!isAuthenticated) return <AuthNavigator />;
    if (user?.role === 'teamlead') return <TeamLeadNavigator />;
    if (user?.role === 'technician') return <TechnicianNavigator />;
    return <ClientNavigator />;
  };

  return (
    <NavigationContainer>
      {getNavigator()}
    </NavigationContainer>
  );
};

export default AppNavigator;