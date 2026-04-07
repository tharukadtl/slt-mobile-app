import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import {ClientTabParamList, ClientStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';

import ClientHomeScreen from '@screens/client/HomeScreen';
import IssueListScreen from '@screens/client/IssueListScreen';
import IssueHistoryScreen from '@screens/client/IssueHistoryScreen';
import ClientProfileScreen from '@screens/client/ProfileScreen';
import ReportIssueScreen from '@screens/client/ReportIssueScreen';
import IssueDetailScreen from '@screens/client/IssueDetailScreen';

const Tab = createBottomTabNavigator<ClientTabParamList>();
const Stack = createStackNavigator<ClientStackParamList>();

const ClientTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          paddingBottom: 5,
          height: 60,
        },
      }}>
      <Tab.Screen name="Home" component={ClientHomeScreen} />
      <Tab.Screen name="MyIssues" component={IssueListScreen} />
      <Tab.Screen name="History" component={IssueHistoryScreen} />
      <Tab.Screen name="Profile" component={ClientProfileScreen} />
    </Tab.Navigator>
  );
};

const ClientNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="ClientTabs" component={ClientTabs} />
      <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
      <Stack.Screen name="IssueDetail" component={IssueDetailScreen} />
    </Stack.Navigator>
  );
};

export default ClientNavigator;