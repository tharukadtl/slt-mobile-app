import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  AnimatedRegion,
} from 'react-native-maps';
import {ClientStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {
  fetchIssueById,
  fetchTechnicianLocation,
} from '@store/slices/issueSlice';

type TrackingRouteProp = RouteProp<
  ClientStackParamList,
  'TechnicianTracking'
>;

const TechnicianTrackingScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<TrackingRouteProp>();
  const dispatch = useAppDispatch();
  const {issueId} = route.params;
  const mapRef = useRef<MapView>(null);

  const {selectedIssue, technicianLocation, isLoading} = useAppSelector(
    state => state.issues,
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchIssueById(issueId));
    dispatch(fetchTechnicianLocation(issueId));

    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      dispatch(fetchTechnicianLocation(issueId));
    }, 30000);

    return () => clearInterval(interval);
  }, [issueId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await dispatch(fetchTechnicianLocation(issueId));
    setIsRefreshing(false);
  };

  const handleCallTechnician = () => {
    if (technicianLocation?.technicianPhone) {
      Linking.openURL(`tel:${technicianLocation.technicianPhone}`);
    }
  };

  const handleFitMap = () => {
    if (mapRef.current && technicianLocation && selectedIssue) {
      mapRef.current.fitToCoordinates(
        [
          {
            latitude: technicianLocation.latitude,
            longitude: technicianLocation.longitude,
          },
          {
            latitude: selectedIssue.location.latitude,
            longitude: selectedIssue.location.longitude,
          },
        ],
        {
          edgePadding: {top: 80, right: 80, bottom: 80, left: 80},
          animated: true,
        },
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return colors.warning;
      case 'travelling': return colors.secondary;
      case 'in_progress': return colors.accent;
      case 'completed': return colors.success;
      default: return colors.textSecondary;
    }
  };

  const formatETA = (minutes: number): string => {
    if (minutes < 1) return 'Arriving now';
    if (minutes < 60) return `${Math.round(minutes)} mins`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  if (isLoading && !technicianLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading tracking info...</Text>
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
        <Text style={styles.headerTitle}>Track Technician</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Text style={styles.refreshText}>
            {isRefreshing ? '...' : '🔄'}
          </Text>
        </TouchableOpacity>
      </View>

      {technicianLocation ? (
        <>
          {/* Map */}
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: technicianLocation.latitude,
              longitude: technicianLocation.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            onMapReady={handleFitMap}>
            {/* Technician Marker */}
            <Marker
              coordinate={{
                latitude: technicianLocation.latitude,
                longitude: technicianLocation.longitude,
              }}
              title={technicianLocation.technicianName}
              description="Technician Location">
              <View style={styles.techMarker}>
                <Text style={styles.techMarkerText}>🔧</Text>
              </View>
            </Marker>

            {/* Customer Location Marker */}
            {selectedIssue && (
              <Marker
                coordinate={{
                  latitude: selectedIssue.location.latitude,
                  longitude: selectedIssue.location.longitude,
                }}
                title="Your Location"
                description={selectedIssue.location.address}
                pinColor={colors.primary}
              />
            )}

            {/* Route Line */}
            {selectedIssue && (
              <Polyline
                coordinates={[
                  {
                    latitude: technicianLocation.latitude,
                    longitude: technicianLocation.longitude,
                  },
                  {
                    latitude: selectedIssue.location.latitude,
                    longitude: selectedIssue.location.longitude,
                  },
                ]}
                strokeColor={colors.primary}
                strokeWidth={3}
                lineDashPattern={[5, 5]}
              />
            )}
          </MapView>

          {/* ETA Banner */}
          <View style={styles.etaBanner}>
            <Text style={styles.etaIcon}>🚗</Text>
            <View style={styles.etaInfo}>
              <Text style={styles.etaTime}>
                {formatETA(technicianLocation.eta)}
              </Text>
              <Text style={styles.etaLabel}>Estimated Arrival</Text>
            </View>
            <View style={styles.etaDistance}>
              <Text style={styles.etaDistanceText}>
                {technicianLocation.distance}
              </Text>
              <Text style={styles.etaDistanceLabel}>away</Text>
            </View>
          </View>

          {/* Technician Card */}
          <View style={styles.techCard}>
            <View style={styles.techAvatar}>
              <Text style={styles.techAvatarText}>
                {technicianLocation.technicianName?.charAt(0) || 'T'}
              </Text>
            </View>
            <View style={styles.techInfo}>
              <Text style={styles.techName}>
                {technicianLocation.technicianName}
              </Text>
              <Text style={styles.techStatus}>
                {selectedIssue?.status
                  ? selectedIssue.status.replace('_', ' ').toUpperCase()
                  : 'ON THE WAY'}
              </Text>
              <Text style={styles.lastUpdated}>
                Updated: {technicianLocation.lastUpdated}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.callButton}
              onPress={handleCallTechnician}>
              <Text style={styles.callButtonText}>📞 Call</Text>
            </TouchableOpacity>
          </View>

          {/* Fit Map Button */}
          <TouchableOpacity
            style={styles.fitMapButton}
            onPress={handleFitMap}>
            <Text style={styles.fitMapText}>⊙ Fit Map</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.noTrackingContainer}>
          <Text style={styles.noTrackingIcon}>📍</Text>
          <Text style={styles.noTrackingText}>
            Technician tracking not available yet
          </Text>
          <Text style={styles.noTrackingSubText}>
            Tracking will be available once a technician is assigned
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
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
  },
  loadingText: {
    fontSize: typography.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
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
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.white,
  },
  refreshText: {
    color: colors.white,
    fontSize: typography.lg,
  },
  map: {
    flex: 1,
  },
  techMarker: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.xs,
    borderWidth: 2,
    borderColor: colors.primary,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  techMarkerText: {
    fontSize: 20,
  },
  etaBanner: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  etaIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  etaInfo: {
    flex: 1,
  },
  etaTime: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  etaLabel: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
  },
  etaDistance: {
    alignItems: 'flex-end',
  },
  etaDistanceText: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.white,
  },
  etaDistanceLabel: {
    fontSize: typography.xs,
    color: colors.white,
    opacity: 0.8,
  },
  techCard: {
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  techAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  techAvatarText: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  techInfo: {
    flex: 1,
  },
  techName: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  techStatus: {
    fontSize: typography.sm,
    color: colors.secondary,
    fontWeight: typography.medium,
    marginTop: 2,
  },
  lastUpdated: {
    fontSize: typography.xs,
    color: colors.textLight,
    marginTop: 2,
  },
  callButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  callButtonText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  fitMapButton: {
    position: 'absolute',
    bottom: 140,
    right: spacing.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  fitMapText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  noTrackingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  noTrackingIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  noTrackingText: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  noTrackingSubText: {
    fontSize: typography.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: typography.lineHeightMd,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
});

export default TechnicianTrackingScreen;
