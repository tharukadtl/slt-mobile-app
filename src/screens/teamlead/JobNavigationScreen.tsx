import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {TeamLeadStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import Geolocation from '@react-native-community/geolocation';

type JobNavigationRouteProp = RouteProp<
  TeamLeadStackParamList,
  'JobNavigation'
>;

const JobNavigationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<JobNavigationRouteProp>();
  const {taskId, address, latitude, longitude} = route.params;
  const mapRef = useRef<MapView>(null);

  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [distance, setDistance] = useState<string>('');
  const [eta, setEta] = useState<string>('');

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    setIsLoading(true);
    Geolocation.getCurrentPosition(
      position => {
        const {latitude: lat, longitude: lng} = position.coords;
        setCurrentLocation({latitude: lat, longitude: lng});
        calculateDistanceAndETA(lat, lng, latitude, longitude);
        setIsLoading(false);
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(
            [
              {latitude: lat, longitude: lng},
              {latitude, longitude},
            ],
            {
              edgePadding: {
                top: 80,
                right: 80,
                bottom: 200,
                left: 80,
              },
              animated: true,
            },
          );
        }, 500);
      },
      error => {
        setIsLoading(false);
        console.error(error);
      },
      {enableHighAccuracy: true, timeout: 15000},
    );
  };

  const calculateDistanceAndETA = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;

    if (dist < 1) {
      setDistance(`${(dist * 1000).toFixed(0)} m`);
    } else {
      setDistance(`${dist.toFixed(1)} km`);
    }

    const avgSpeedKmH = 30;
    const timeHours = dist / avgSpeedKmH;
    const timeMinutes = timeHours * 60;
    if (timeMinutes < 1) {
      setEta('Arriving now');
    } else if (timeMinutes < 60) {
      setEta(`${Math.round(timeMinutes)} mins`);
    } else {
      const hours = Math.floor(timeMinutes / 60);
      const mins = Math.round(timeMinutes % 60);
      setEta(`${hours}h ${mins}m`);
    }
  };

  const handleOpenGoogleMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open Google Maps');
    });
  };

  const handleOpenWaze = () => {
    const url = `waze://?ll=${latitude},${longitude}&navigate=yes`;
    Linking.openURL(url).catch(() => {
      Alert.alert(
        'Waze not installed',
        'Please install Waze or use Google Maps',
      );
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Navigate to Job</Text>
        <Text style={styles.taskId}>Task #{taskId}</Text>
      </View>

      {/* Map */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Getting location...</Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: latitude,
            longitude: longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}>
          {/* Current Location */}
          {currentLocation && (
            <Marker
              coordinate={currentLocation}
              title="Your Location"
              pinColor={colors.secondary}>
              <View style={styles.currentLocationMarker}>
                <Text style={styles.currentLocationMarkerText}>
                  📍
                </Text>
              </View>
            </Marker>
          )}

          {/* Destination */}
          <Marker
            coordinate={{latitude, longitude}}
            title="Job Location"
            description={address}>
            <View style={styles.destinationMarker}>
              <Text style={styles.destinationMarkerText}>🔧</Text>
            </View>
          </Marker>

          {/* Route Line */}
          {currentLocation && (
            <Polyline
              coordinates={[currentLocation, {latitude, longitude}]}
              strokeColor={colors.primary}
              strokeWidth={3}
              lineDashPattern={[5, 5]}
            />
          )}
        </MapView>
      )}

      {/* Info Card */}
      <View style={styles.infoCard}>
        {/* Distance and ETA */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>📏</Text>
            <Text style={styles.infoValue}>{distance || '--'}</Text>
            <Text style={styles.infoLabel}>Distance</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>⏱️</Text>
            <Text style={styles.infoValue}>{eta || '--'}</Text>
            <Text style={styles.infoLabel}>ETA</Text>
          </View>
        </View>

        {/* Destination Address */}
        <View style={styles.destinationInfo}>
          <Text style={styles.destinationLabel}>
            📍 Destination
          </Text>
          <Text style={styles.destinationAddress} numberOfLines={2}>
            {address}
          </Text>
        </View>

        {/* Navigation Buttons */}
        <View style={styles.navButtons}>
          <TouchableOpacity
            style={styles.googleMapsButton}
            onPress={handleOpenGoogleMaps}>
            <Text style={styles.googleMapsButtonText}>
              🗺️ Google Maps
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.wazeButton}
            onPress={handleOpenWaze}>
            <Text style={styles.wazeButtonText}>
              🚗 Waze
            </Text>
          </TouchableOpacity>
        </View>

        {/* Refresh Button */}
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={getCurrentLocation}>
          <Text style={styles.refreshButtonText}>
            🔄 Refresh Location
          </Text>
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
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    zIndex: 10,
  },
  backText: {
    color: colors.white,
    fontSize: typography.md,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  taskId: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  map: {
    flex: 1,
  },
  currentLocationMarker: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.xs,
    borderWidth: 2,
    borderColor: colors.secondary,
    elevation: 4,
  },
  currentLocationMarkerText: {
    fontSize: 20,
  },
  destinationMarker: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.xs,
    borderWidth: 2,
    borderColor: colors.primary,
    elevation: 4,
  },
  destinationMarkerText: {
    fontSize: 20,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: -3},
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  infoLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  infoDivider: {
    width: 1,
    height: 50,
    backgroundColor: colors.border,
  },
  destinationInfo: {
    marginBottom: spacing.md,
  },
  destinationLabel: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  destinationAddress: {
    fontSize: typography.md,
    color: colors.textSecondary,
    lineHeight: typography.lineHeightMd,
  },
  navButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  googleMapsButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  googleMapsButtonText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  wazeButton: {
    flex: 1,
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  wazeButtonText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  refreshButton: {
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
});

export default JobNavigationScreen;