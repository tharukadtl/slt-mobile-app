import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import {TeamLeadTabParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';

import TeamLeadHomeScreen from '@screens/teamlead/HomeScreen';
import TeamLeadTaskListScreen from '@screens/teamlead/TaskListScreen';
import TeamScreen from '@screens/teamlead/TeamScreen';
import TeamLeadProfileScreen from '@screens/teamlead/ProfileScreen';
import PaymentScreen from '@screens/teamlead/PaymentScreen';

const Tab = createBottomTabNavigator<TeamLeadTabParamList>();
const Stack = createStackNavigator();

const TeamLeadTabs = () => {
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
      <Tab.Screen name="Home" component={TeamLeadHomeScreen} />
      <Tab.Screen name="Tasks" component={TeamLeadTaskListScreen} />
      <Tab.Screen name="Team" component={TeamScreen} />
      <Tab.Screen name="Profile" component={TeamLeadProfileScreen} />
    </Tab.Navigator>
  );
};

const TeamLeadNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="TeamLeadTabs" component={TeamLeadTabs} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
    </Stack.Navigator>
  );
};

export default TeamLeadNavigator;