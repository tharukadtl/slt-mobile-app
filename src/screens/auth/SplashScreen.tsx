import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {AuthStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAppDispatch} from '@store/hooks';
import {logout} from '@store/slices/authSlice';

type SplashNavigationProp =
  StackNavigationProp<AuthStackParamList>;

const SplashScreen = () => {
  const navigation = useNavigation<SplashNavigationProp>();
  const dispatch = useAppDispatch();

  useEffect(() => {
    checkToken();
  }, []);

  const checkToken = async () => {
    console.log('in the checkToken')
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const token = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      console.log('token:', token);
      console.log('storedUser:', storedUser);
      if (token && storedUser) {
        // Token exists — AppNavigator will handle routing
        // by checking isAuthenticated from Redux store
      } else {
        navigation.replace('Login');
      }
    } catch (error) {
      navigation.replace('Login');
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo Section */}
      <View style={styles.logoSection}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>SLT</Text>
        </View>
        <Text style={styles.appName}>SLT Mobile App</Text>
        <Text style={styles.tagline}>
          After-Service Issue Management
        </Text>
      </View>

      {/* Loading Section */}
      <View style={styles.loadingSection}>
        <ActivityIndicator size="large" color={colors.white} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Sri Lanka Telecom PLC
        </Text>
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: spacing.xl,
  },
  logoSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  logoText: {
    fontSize: 40,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  appName: {
    fontSize: typography.xxxl,
    fontWeight: typography.bold,
    color: colors.white,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  tagline: {
    fontSize: typography.md,
    color: colors.white,
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: typography.lineHeightMd,
  },
  loadingSection: {
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.md,
    color: colors.white,
    opacity: 0.8,
  },
  footer: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerText: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.7,
  },
  versionText: {
    fontSize: typography.xs,
    color: colors.white,
    opacity: 0.5,
  },
});

export default SplashScreen;