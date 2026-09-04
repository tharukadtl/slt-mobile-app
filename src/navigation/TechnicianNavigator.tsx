import React, {useEffect} from 'react';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {
  TechnicianTabParamList,
  TechnicianStackParamList,
} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {useAppDispatch} from '@store/hooks';
import {fetchTodayAttendance} from '@store/slices/technicianSlice';

import TechnicianHomeScreen from '@screens/technician/HomeScreen';
import TechnicianTaskListScreen from '@screens/technician/TaskListScreen';
import TechnicianTaskDetailScreen from '@screens/technician/TaskDetailScreen';
import TechnicianNavigationScreen from '@screens/technician/NavigationScreen';
import JobsMapScreen from '@screens/technician/JobsMapScreen';
import ResourceManagementScreen from '@screens/technician/ResourceManagementScreen';
import KPITargetsScreen from '@screens/technician/KPITargetsScreen';
import TechnicianProfileScreen from '@screens/technician/ProfileScreen';
import TechEditProfileScreen from '@screens/technician/TechEditProfileScreen';
import TechNotificationSettingsScreen from '@screens/technician/TechNotificationSettingsScreen';
import TechLanguageSettingsScreen from '@screens/technician/TechLanguageSettingsScreen';
import UpdateStatusScreen from '@screens/technician/UpdateStatusScreen';
import MaterialsScreen from '@screens/technician/MaterialsScreen';
import SignatureScreen from '@screens/technician/SignatureScreen';
import TechnicianBODScreen from '@screens/technician/BODScreen';

const Tab = createBottomTabNavigator<TechnicianTabParamList>();
const Stack = createStackNavigator<TechnicianStackParamList>();

// ── BOD Gate ─────────────────────────────────────────────────────────────────
// Initial screen: checks today's attendance status via the same source of
// truth (GET /api/attendance/me/today, via fetchTodayAttendance) that
// HomeScreen's hasCheckedInToday/hasCheckedOutToday already use to block a
// second same-day BOD (issue 2.3) — job-list access and the once-per-day
// BOD limit share one source of truth rather than two separate mechanisms.
// If already checked in today (CHECKED_IN or CHECKED_OUT) → dashboard.
// If not checked in yet (NOT_CHECKED_IN, or the check fails)  → BOD screen.
// Shows a spinner while the check is in flight. Mirrors TeamLeadNavigator's
// BODGateScreen pattern.
const TechnicianBODGateScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<StackNavigationProp<TechnicianStackParamList>>();

  useEffect(() => {
    dispatch(fetchTodayAttendance())
      .unwrap()
      .then(result => {
        const hasCheckedInToday = result?.currentStatus !== 'NOT_CHECKED_IN';
        navigation.replace(hasCheckedInToday ? 'TechnicianTabs' : 'BOD');
      })
      .catch(() => {
        navigation.replace('BOD');
      });
  }, []);

  return (
    <View style={styles.gate}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

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
    <Stack.Navigator
      screenOptions={{headerShown: false}}
      initialRouteName="BODGate">
      <Stack.Screen name="BODGate" component={TechnicianBODGateScreen} />
      <Stack.Screen
        name="TechnicianTabs"
        component={TechnicianTabs}
      />
      <Stack.Screen name="BOD" component={TechnicianBODScreen} />
      <Stack.Screen
        name="TaskDetail"
        component={TechnicianTaskDetailScreen}
      />
      <Stack.Screen
        name="Navigation"
        component={TechnicianNavigationScreen}
      />
      <Stack.Screen name="JobsMap" component={JobsMapScreen} />
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

const styles = StyleSheet.create({
  gate: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background},
});

export default TechnicianNavigator;