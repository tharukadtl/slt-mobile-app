import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import {
  ClientTabParamList,
  ClientStackParamList,
} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';

import ClientHomeScreen from '@screens/client/HomeScreen';
import IssueListScreen from '@screens/client/IssueListScreen';
import IssueHistoryScreen from '@screens/client/IssueHistoryScreen';
import ClientProfileScreen from '@screens/client/ProfileScreen';
import ReportIssueScreen from '@screens/client/ReportIssueScreen';
import IssueDetailScreen from '@screens/client/IssueDetailScreen';
import BillingHistoryScreen from '@screens/client/BillingHistoryScreen';
import BillDetailScreen from '@screens/client/BillDetailScreen';
import TechnicianTrackingScreen from '@screens/client/TechnicianTrackingScreen';
import EditProfileScreen from '@screens/client/EditProfileScreen';
import NotificationSettingsScreen from '@screens/client/NotificationSettingsScreen';
import LanguageSettingsScreen from '@screens/client/LanguageSettingsScreen';

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
      <Tab.Screen
        name="Home"
        component={ClientHomeScreen}
        options={{tabBarLabel: 'Home'}}
      />
      <Tab.Screen
        name="MyIssues"
        component={IssueListScreen}
        options={{tabBarLabel: 'My Issues'}}
      />
      <Tab.Screen
        name="History"
        component={IssueHistoryScreen}
        options={{tabBarLabel: 'History'}}
      />
      <Tab.Screen
        name="Profile"
        component={ClientProfileScreen}
        options={{tabBarLabel: 'Profile'}}
      />
    </Tab.Navigator>
  );
};

const ClientNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="ClientTabs" component={ClientTabs} />
      <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
      <Stack.Screen name="IssueDetail" component={IssueDetailScreen} />
      <Stack.Screen
        name="BillingHistory"
        component={BillingHistoryScreen}
      />
      <Stack.Screen name="BillDetail" component={BillDetailScreen} />
      <Stack.Screen
        name="TechnicianTracking"
        component={TechnicianTrackingScreen}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
      />
      <Stack.Screen
        name="LanguageSettings"
        component={LanguageSettingsScreen}
      />
    </Stack.Navigator>
  );
};

export default ClientNavigator;