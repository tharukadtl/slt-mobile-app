import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import {
  TechnicianTabParamList,
  TechnicianStackParamList,
} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';

import TechnicianHomeScreen from '@screens/technician/HomeScreen';
import TechnicianTaskListScreen from '@screens/technician/TaskListScreen';
import TechnicianTaskDetailScreen from '@screens/technician/TaskDetailScreen';
import TechnicianNavigationScreen from '@screens/technician/NavigationScreen';
import ResourceManagementScreen from '@screens/technician/ResourceManagementScreen';
import KPITargetsScreen from '@screens/technician/KPITargetsScreen';
import TechnicianProfileScreen from '@screens/technician/ProfileScreen';
import TechEditProfileScreen from '@screens/technician/TechEditProfileScreen';
import TechNotificationSettingsScreen from '@screens/technician/TechNotificationSettingsScreen';
import TechLanguageSettingsScreen from '@screens/technician/TechLanguageSettingsScreen';
import UpdateStatusScreen from '@screens/technician/UpdateStatusScreen';
import MaterialsScreen from '@screens/technician/MaterialsScreen';
import SignatureScreen from '@screens/technician/SignatureScreen';

const Tab = createBottomTabNavigator<TechnicianTabParamList>();
const Stack = createStackNavigator<TechnicianStackParamList>();

const TechnicianTabs = () => {
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
        component={TechnicianHomeScreen}
        options={{tabBarLabel: '🏠 Dashboard'}}
      />
      <Tab.Screen
        name="Tasks"
        component={TechnicianTaskListScreen}
        options={{tabBarLabel: '📋 My Jobs'}}
      />
      <Tab.Screen
        name="Resources"
        component={ResourceManagementScreen}
        options={{tabBarLabel: '📦 Resources'}}
      />
      <Tab.Screen
        name="Profile"
        component={TechnicianProfileScreen}
        options={{tabBarLabel: '👤 Profile'}}
      />
    </Tab.Navigator>
  );
};

const TechnicianNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen
        name="TechnicianTabs"
        component={TechnicianTabs}
      />
      <Stack.Screen
        name="TaskDetail"
        component={TechnicianTaskDetailScreen}
      />
      <Stack.Screen
        name="Navigation"
        component={TechnicianNavigationScreen}
      />
      <Stack.Screen
        name="ResourceManagement"
        component={ResourceManagementScreen}
      />
      <Stack.Screen
        name="KPITargets"
        component={KPITargetsScreen}
      />
      <Stack.Screen
        name="TechEditProfile"
        component={TechEditProfileScreen}
      />
      <Stack.Screen
        name="TechNotificationSettings"
        component={TechNotificationSettingsScreen}
      />
      <Stack.Screen
        name="TechLanguageSettings"
        component={TechLanguageSettingsScreen}
      />
      <Stack.Screen
        name="UpdateStatus"
        component={UpdateStatusScreen}
      />
      <Stack.Screen name="Materials" component={MaterialsScreen} />
      <Stack.Screen name="Signature" component={SignatureScreen} />
    </Stack.Navigator>
  );
};

export default TechnicianNavigator;