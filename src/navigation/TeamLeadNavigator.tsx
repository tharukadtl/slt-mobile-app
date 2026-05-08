import React, {useEffect} from 'react';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {
  TeamLeadTabParamList,
  TeamLeadStackParamList,
} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {useAppDispatch} from '@store/hooks';
import {checkTodaysSession} from '@store/slices/technicianSlice';

import TeamLeadHomeScreen from '@screens/teamlead/HomeScreen';
import TeamLeadTaskListScreen from '@screens/teamlead/TaskListScreen';
import TeamScreen from '@screens/teamlead/TeamScreen';
import TeamLeadProfileScreen from '@screens/teamlead/ProfileScreen';
import PaymentScreen from '@screens/teamlead/PaymentScreen';
import PaymentSubmissionScreen from '@screens/teamlead/PaymentSubmissionScreen';
import PaymentHistoryScreen from '@screens/teamlead/PaymentHistoryScreen';
import TeamMapScreen from '@screens/teamlead/TeamMapScreen';
import KPIPerformanceScreen from '@screens/teamlead/KPIPerformanceScreen';
import FieldOperationsScreen from '@screens/teamlead/FieldOperationsScreen';
import JobNavigationScreen from '@screens/teamlead/JobNavigationScreen';
import MaterialRequestScreen from '@screens/teamlead/MaterialRequestScreen';
import BODScreen from '@screens/teamlead/BODScreen';
import EODScreen from '@screens/teamlead/EODScreen';
import AssignJobsScreen from '@screens/teamlead/AssignJobsScreen';

const Tab = createBottomTabNavigator<TeamLeadTabParamList>();
const Stack = createStackNavigator<TeamLeadStackParamList>();

// ── BOD Gate ─────────────────────────────────────────────────────────────────
// Initial screen: checks whether team lead has an active session today.
// If YES  → replaces itself with TeamLeadTabs (dashboard).
// If NO   → replaces itself with BOD screen.
// Shows a spinner while the check is in flight.
const BODGateScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<StackNavigationProp<TeamLeadStackParamList>>();

  useEffect(() => {
    dispatch(checkTodaysSession())
      .unwrap()
      .then(() => {
        // Active session exists → go to dashboard
        navigation.replace('TeamLeadTabs');
      })
      .catch(() => {
        // No session → must do BOD first
        navigation.replace('BOD');
      });
  }, []);

  return (
    <View style={styles.gate}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

// ── Tab Navigator ─────────────────────────────────────────────────────────────
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
      <Tab.Screen
        name="Home"
        component={TeamLeadHomeScreen}
        options={{tabBarLabel: '🏠 Dashboard'}}
      />
      <Tab.Screen
        name="Tasks"
        component={TeamLeadTaskListScreen}
        options={{tabBarLabel: '📋 Tasks'}}
      />
      <Tab.Screen
        name="Team"
        component={TeamScreen}
        options={{tabBarLabel: '👥 Team'}}
      />
      <Tab.Screen
        name="Profile"
        component={TeamLeadProfileScreen}
        options={{tabBarLabel: '👤 Profile'}}
      />
    </Tab.Navigator>
  );
};

// ── Stack Navigator ───────────────────────────────────────────────────────────
const TeamLeadNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{headerShown: false}}
      initialRouteName="BODGate">
      <Stack.Screen name="BODGate"       component={BODGateScreen} />
      <Stack.Screen name="TeamLeadTabs"  component={TeamLeadTabs} />
      <Stack.Screen name="BOD"           component={BODScreen} />
      <Stack.Screen name="EOD"           component={EODScreen} />
      <Stack.Screen name="AssignJobs"    component={AssignJobsScreen} />
      <Stack.Screen name="Payment"       component={PaymentScreen} />
      <Stack.Screen name="PaymentSubmission" component={PaymentSubmissionScreen} />
      <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
      <Stack.Screen name="TeamMap"       component={TeamMapScreen} />
      <Stack.Screen name="KPIPerformance" component={KPIPerformanceScreen} />
      <Stack.Screen name="FieldOperations" component={FieldOperationsScreen} />
      <Stack.Screen name="JobNavigation" component={JobNavigationScreen} />
      <Stack.Screen name="MaterialRequest" component={MaterialRequestScreen} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  gate: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background},
});

export default TeamLeadNavigator;
