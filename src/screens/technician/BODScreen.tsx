import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TechnicianStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {
  submitBODCheckIn,
  setHasBODToday,
  fetchTodayAttendance,
} from '@store/slices/technicianSlice';
import Geolocation from '@react-native-community/geolocation';

type BODNavigationProp = StackNavigationProp<TechnicianStackParamList>;

const BODScreen = () => {
  const navigation = useNavigation<BODNavigationProp>();
  const dispatch = useAppDispatch();
  const {user} = useAppSelector(state => state.auth);

  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  useEffect(() => {
    getLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
        {headers: {'User-Agent': 'SLTMobileApp/1.0'}},
      );
      const data = await res.json();
      return (
        data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      );
    } catch {
      return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    }
  };

  const getLocation = async () => {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'SLT App needs your location for BOD check-in',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      setGettingLocation(false);
      return;
    }

    setGettingLocation(true);
    Geolocation.getCurrentPosition(
      async pos => {
        const {latitude, longitude} = pos.coords;
        const address = await reverseGeocode(latitude, longitude);
        setLocation({latitude, longitude, address});
        setGettingLocation(false);
      },
      () => setGettingLocation(false),
      {enableHighAccuracy: true, timeout: 15000},
    );
  };

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      await dispatch(
        submitBODCheckIn({
          // null, not (0,0) — a fake coordinate would be indistinguishable
          // from a real check-in at 0°N 0°E and could silently pollute
          // location-aware features (heat maps, clustering, resource
          // planning) as a phantom hotspot.
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          address: location?.address ?? 'Location unavailable',
        }),
      ).unwrap();
      dispatch(setHasBODToday(true));
      await dispatch(fetchTodayAttendance());
      navigation.replace('TechnicianTabs');
    } catch (error: any) {
      Alert.alert(
        'Check-In Failed',
        error || 'Could not check in. Please try again.',
      );
    } finally {
      setIsCheckingIn(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header — no back button; BOD is a required gate */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Beginning of Day</Text>
        <Text style={styles.headerSubtitle}>
          Check in to start your day{user?.name ? `, ${user.name}` : ''}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📍 Current Location</Text>
          {gettingLocation ? (
            <View style={styles.row}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.locationText}>Getting location...</Text>
            </View>
          ) : location ? (
            <>
              <Text style={styles.locationText} numberOfLines={2}>
                {location.address}
              </Text>
              <Text style={styles.coordsText}>
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Text>
            </>
          ) : (
            <Text style={styles.locationWarning}>
              ⚠️ Location unavailable — you can still check in without it.
            </Text>
          )}
          <TouchableOpacity onPress={getLocation} style={styles.retryButton}>
            <Text style={styles.retryText}>🔄 Refresh Location</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.instruction}>
            You must check in before you can view or work on your assigned
            jobs today.
          </Text>
        </View>
      </ScrollView>

      {/* Check-In Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            isCheckingIn && styles.submitButtonDisabled,
          ]}
          onPress={handleCheckIn}
          disabled={isCheckingIn}>
          {isCheckingIn ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>
              ✅ Check In & Start Day
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  locationText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  coordsText: {
    fontSize: typography.xs,
    color: colors.textLight,
    fontFamily: 'monospace',
    marginTop: spacing.xs,
  },
  retryButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  retryText: {
    color: colors.primary,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  locationWarning: {
    fontSize: typography.sm,
    color: colors.warning,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  instruction: {
    fontSize: typography.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeightMd,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.textLight,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
});

export default BODScreen;
