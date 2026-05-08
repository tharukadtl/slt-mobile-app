import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  Region,
} from 'react-native-maps';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TechnicianStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppSelector} from '@store/hooks';
import Geolocation from '@react-native-community/geolocation';

type NavigationRouteProp = RouteProp<
  TechnicianStackParamList,
  'Navigation'
>;

type NavigationNavProp = StackNavigationProp<
  TechnicianStackParamList,
  'Navigation'
>;

interface LocationPoint {
  latitude: number;
  longitude: number;
}

const TechnicianNavigationScreen = () => {
  const navigation = useNavigation<NavigationNavProp>();
  const route = useRoute<NavigationRouteProp>();
  const {taskId} = route.params;
  const mapRef = useRef<MapView>(null);

  const {tasks} = useAppSelector(state => state.technician);
  const task = tasks.find(t => t.id === taskId);

  const [currentLocation, setCurrentLocation] =
    useState<LocationPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [distance, setDistance] = useState<string>('--');
  const [eta, setEta] = useState<string>('--');
  const [etaMinutes, setEtaMinutes] = useState<number>(0);
  const [isTracking, setIsTracking] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [routeCoordinates, setRouteCoordinates] = useState<LocationPoint[]>([]);

  const [speed, setSpeed] = useState<string>('0 km/h');

  const watchId = useRef<number | null>(null);

  const jobLocation: LocationPoint = {
    latitude: task?.location?.latitude || 6.9271,
    longitude: task?.location?.longitude || 79.8612,
  };

  useEffect(() => {
    requestLocationAndStart();
    return () => {
      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  const requestLocationAndStart = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'Navigation needs your location',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(
          'Permission Denied',
          'Location permission required for navigation',
        );
        setIsLoading(false);
        return;
      }
    }
    startLocationTracking();
  };

  const startLocationTracking = () => {
    // Get initial position
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude, speed: spd} = position.coords;
        const loc = {latitude, longitude};
        setCurrentLocation(loc);
        setIsLoading(false);
        setLastUpdated(new Date().toLocaleTimeString());
        if (spd !== null && spd !== undefined) {
          setSpeed(`${(spd * 3.6).toFixed(0)} km/h`);
        }
        calculateDistanceAndETA(loc, jobLocation);
        setRouteCoordinates([loc, jobLocation]);
        fitMapToCoordinates(loc);
      },
      error => {
        setIsLoading(false);
        console.error('Location error:', error);
        // Use mock location for demo
        const mockLoc = {
          latitude: jobLocation.latitude + 0.02,
          longitude: jobLocation.longitude + 0.02,
        };
        setCurrentLocation(mockLoc);
        calculateDistanceAndETA(mockLoc, jobLocation);
        setRouteCoordinates([mockLoc, jobLocation]);
        fitMapToCoordinates(mockLoc);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      },
    );

    // Start watching position
    watchId.current = Geolocation.watchPosition(
      position => {
        const {latitude, longitude, speed: spd} = position.coords;
        const loc = {latitude, longitude};
        setCurrentLocation(loc);
        setLastUpdated(new Date().toLocaleTimeString());
        if (spd !== null && spd !== undefined) {
          setSpeed(`${(spd * 3.6).toFixed(0)} km/h`);
        }
        calculateDistanceAndETA(loc, jobLocation);
        setRouteCoordinates([loc, jobLocation]);
      },
      error => console.error('Watch error:', error),
      {
        enableHighAccuracy: true,
        distanceFilter: 10, // Update every 10 meters
        interval: 5000, // Update every 5 seconds
        fastestInterval: 2000,
      },
    );
  };

  const calculateDistanceAndETA = (
    from: LocationPoint,
    to: LocationPoint,
  ) => {
    const R = 6371; // Earth radius in km
    const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
    const dLon =
      ((to.longitude - from.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((from.latitude * Math.PI) / 180) *
        Math.cos((to.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;

    // Set distance
    if (dist < 1) {
      setDistance(`${(dist * 1000).toFixed(0)} m`);
    } else {
      setDistance(`${dist.toFixed(1)} km`);
    }

    // Calculate ETA (assuming 30 km/h avg speed in city)
    const avgSpeedKmH = 30;
    const timeMinutes = (dist / avgSpeedKmH) * 60;
    setEtaMinutes(Math.round(timeMinutes));

    if (timeMinutes < 1) {
      setEta('Arriving now');
    } else if (timeMinutes < 60) {
      setEta(`${Math.round(timeMinutes)} min`);
    } else {
      const hours = Math.floor(timeMinutes / 60);
      const mins = Math.round(timeMinutes % 60);
      setEta(`${hours}h ${mins}m`);
    }
  };

  const fitMapToCoordinates = (myLocation: LocationPoint) => {
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        [myLocation, jobLocation],
        {
          edgePadding: {
            top: 80,
            right: 80,
            bottom: 250,
            left: 80,
          },
          animated: true,
        },
      );
    }, 500);
  };

  const handleCenterOnMe = () => {
    if (currentLocation) {
      mapRef.current?.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500,
      );
    }
  };

  const handleFitAll = () => {
    if (currentLocation) {
      fitMapToCoordinates(currentLocation);
    }
  };

  const handleOpenGoogleMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${jobLocation.latitude},${jobLocation.longitude}&travelmode=driving`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open Google Maps'),
    );
  };

  const handleOpenWaze = () => {
    const url = `waze://?ll=${jobLocation.latitude},${jobLocation.longitude}&navigate=yes`;
    Linking.openURL(url).catch(() => {
      Alert.alert(
        'Waze Not Installed',
        'Would you like to open Google Maps instead?',
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Open Google Maps', onPress: handleOpenGoogleMaps},
        ],
      );
    });
  };

  const toggleTracking = () => {
    if (isTracking) {
      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    } else {
      startLocationTracking();
    }
    setIsTracking(!isTracking);
  };

  const getETAColor = () => {
    if (etaMinutes <= 10) return colors.success;
    if (etaMinutes <= 30) return colors.warning;
    return colors.error;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          Getting your location...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Navigation</Text>
          <Text style={styles.headerSubtitle}>
            Task #{taskId}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.trackingButton,
            isTracking && styles.trackingButtonActive,
          ]}
          onPress={toggleTracking}>
          <Text style={styles.trackingButtonText}>
            {isTracking ? '🔴 Live' : '⏸ Paused'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={false}
        showsMyLocationButton={false}
        initialRegion={{
          latitude: jobLocation.latitude,
          longitude: jobLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}>
        {/* Current Location Marker */}
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="Your Location"
            anchor={{x: 0.5, y: 0.5}}>
            <View style={styles.currentLocationMarker}>
              <View style={styles.currentLocationOuter}>
                <View style={styles.currentLocationInner} />
              </View>
              <Text style={styles.youText}>You</Text>
            </View>
          </Marker>
        )}

        {/* Job Location Marker */}
        <Marker
          coordinate={jobLocation}
          title={task?.customerName || 'Job Location'}
          description={task?.location?.address}>
          <View style={styles.jobMarker}>
            <Text style={styles.jobMarkerIcon}>🔧</Text>
            <View style={styles.jobMarkerBubble}>
              <Text style={styles.jobMarkerText} numberOfLines={1}>
                {task?.customerName?.split(' ')[0] || 'Job'}
              </Text>
            </View>
          </View>
        </Marker>

        {/* Route Line */}
        {routeCoordinates.length >= 2 && (
          <>
            {/* Shadow line */}
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="rgba(0,0,0,0.2)"
              strokeWidth={6}
            />
            {/* Main route line */}
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={colors.primary}
              strokeWidth={4}
              lineDashPattern={[8, 4]}
            />
          </>
        )}
      </MapView>

      {/* Map Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity
          style={styles.mapControlButton}
          onPress={handleCenterOnMe}>
          <Text style={styles.mapControlIcon}>📍</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapControlButton}
          onPress={handleFitAll}>
          <Text style={styles.mapControlIcon}>⊙</Text>
        </TouchableOpacity>
      </View>

      {/* Info Panel */}
      <View style={styles.infoPanel}>
        {/* ETA & Distance Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>⏱️</Text>
            <Text
              style={[
                styles.statValue,
                {color: getETAColor()},
              ]}>
              {eta}
            </Text>
            <Text style={styles.statLabel}>ETA</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>📏</Text>
            <Text style={styles.statValue}>{distance}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>🚗</Text>
            <Text style={styles.statValue}>{speed}</Text>
            <Text style={styles.statLabel}>Speed</Text>
          </View>
        </View>

        {/* Destination Info */}
        <View style={styles.destinationRow}>
          <Text style={styles.destinationLabel}>
            📍 Destination
          </Text>
          <Text style={styles.destinationAddress} numberOfLines={1}>
            {task?.location?.address || 'Job Location'}
          </Text>
          {lastUpdated && (
            <Text style={styles.lastUpdated}>
              🔄 Updated: {lastUpdated}
            </Text>
          )}
        </View>

        {/* Navigation App Buttons */}
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
              🚙 Waze
            </Text>
          </TouchableOpacity>
        </View>

        {/* Arrived Button */}
        {etaMinutes <= 2 && etaMinutes > 0 && (
          <TouchableOpacity
            style={styles.arrivedButton}
            onPress={() => {
              Alert.alert(
                '📍 Arrived at Location',
                'Great! You have arrived at the job site.',
                [
                  {
                    text: 'Start Work',
                    onPress: () => navigation.goBack(),
                  },
                ],
              );
            }}>
            <Text style={styles.arrivedButtonText}>
              ✅ I Have Arrived
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  backText: {
    color: colors.white,
    fontSize: typography.md,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: typography.xs,
    color: colors.white,
    opacity: 0.8,
  },
  trackingButton: {
    backgroundColor: colors.white + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  trackingButtonActive: {
    backgroundColor: colors.error + '40',
  },
  trackingButtonText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  map: {
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    right: spacing.md,
    top: 130,
    gap: spacing.sm,
  },
  mapControlButton: {
    backgroundColor: colors.white,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  mapControlIcon: {
    fontSize: 20,
  },
  currentLocationMarker: {
    alignItems: 'center',
  },
  currentLocationOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.secondary + '40',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  currentLocationInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.secondary,
  },
  youText: {
    fontSize: 9,
    fontWeight: typography.bold,
    color: colors.secondary,
    backgroundColor: colors.white,
    paddingHorizontal: 3,
    borderRadius: 3,
    marginTop: 2,
    overflow: 'hidden',
  },
  jobMarker: {
    alignItems: 'center',
  },
  jobMarkerIcon: {
    fontSize: 28,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 3,
  },
  jobMarkerBubble: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
    maxWidth: 80,
  },
  jobMarkerText: {
    fontSize: 9,
    color: colors.white,
    fontWeight: typography.bold,
    textAlign: 'center',
  },
  infoPanel: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    elevation: 10,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: colors.border,
  },
  destinationRow: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  lastUpdated: {
    fontSize: typography.xs,
    color: colors.textLight,
    marginTop: spacing.xs,
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
    borderRadius: 10,
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
    borderRadius: 10,
    alignItems: 'center',
  },
  wazeButtonText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  arrivedButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  arrivedButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
});

export default TechnicianNavigationScreen;