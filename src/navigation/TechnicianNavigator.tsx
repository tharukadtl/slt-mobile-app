import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import {TechnicianTabParamList, TechnicianStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';

import TechnicianHomeScreen from '@screens/technician/HomeScreen';
import TaskListScreen from '@screens/technician/TaskListScreen';
import TechnicianProfileScreen from '@screens/technician/ProfileScreen';
import TaskDetailScreen from '@screens/technician/TaskDetailScreen';
import NavigationScreen from '@screens/technician/NavigationScreen';
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
      <Tab.Screen name="Home" component={TechnicianHomeScreen} />
      <Tab.Screen name="Tasks" component={TaskListScreen} />
      <Tab.Screen name="Profile" component={TechnicianProfileScreen} />
    </Tab.Navigator>
  );
};

const TechnicianNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="TechnicianTabs" component={TechnicianTabs} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen name="Navigation" component={NavigationScreen} />
      <Stack.Screen name="UpdateStatus" component={UpdateStatusScreen} />
      <Stack.Screen name="Materials" component={MaterialsScreen} />
      <Stack.Screen name="Signature" component={SignatureScreen} />
    </Stack.Navigator>
  );
};

export default TechnicianNavigator;