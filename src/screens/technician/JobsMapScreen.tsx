import React, {useEffect, useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TechnicianStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {fetchTasks} from '@store/slices/technicianSlice';
import {Task} from '@appTypes/technician.types';
import Geolocation from '@react-native-community/geolocation';
import technicianService from '@services/technicianService';

type JobsMapNavigationProp = StackNavigationProp<TechnicianStackParamList>;

interface LocationPoint {
  latitude: number;
  longitude: number;
}

type SortMode = 'DISTANCE' | 'PRIORITY';

// Same priority helpers as HomeScreen.tsx / TaskListScreen.tsx — this app
// doesn't centralise these, so matching the existing per-screen convention
// rather than introducing a new shared util file.
const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'HIGH': return colors.error;
    case 'MEDIUM': return colors.warning;
    case 'LOW': return colors.success;
    default: return colors.secondary;
  }
};

const getPriorityIcon = (priority?: string) => {
  switch (priority) {
    case 'HIGH': return '🔴';
    case 'MEDIUM': return '🟡';
    case 'LOW': return '🟢';
    default: return '⚪';
  }
};

// "Pending" here means still actionable today — excludes completed/rejected/
// cancelled jobs, and jobs with no GPS location to plot.
const isPending = (task: Task) =>
  !['completed', 'rejected', 'cancelled'].includes(task.status) &&
  !!task.location?.latitude &&
  !!task.location?.longitude;

const JobsMapScreen = () => {
  const navigation = useNavigation<JobsMapNavigationProp>();
  const dispatch = useAppDispatch();
  const mapRef = useRef<MapView>(null);
  const {tasks, isLoading} = useAppSelector(state => state.technician);

  const [currentLocation, setCurrentLocation] =
    useState<LocationPoint | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('PRIORITY');
  const [distances, setDistances] = useState<Record<string, number>>({});
  const [etas, setEtas] = useState<Record<string, number>>({});
  const [isCalculatingDistances, setIsCalculatingDistances] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchTasks());
    }, [dispatch]),
  );

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'Job map needs your location to sort jobs by distance',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        return;
      }
    }
    Geolocation.getCurrentPosition(
      position => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      error => console.error('Location error:', error),
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  const pendingTasks = tasks.filter(isPending);

  // FR-29 (SRS 5.6.6) — one call to the shortest-path proxy per pending job,
  // in parallel. This is a small, user-triggered, one-off computation (not
  // continuous polling), and pending-job counts are realistically single
  // digits, so calling the existing per-pair endpoint N times in parallel
  // is proportionate — a separate distance-only/batch endpoint would be
  // premature optimisation for the actual scale involved here.
  const calculateDistances = async (from: LocationPoint) => {
    if (pendingTasks.length === 0) return;
    setIsCalculatingDistances(true);
    try {
      const results = await Promise.allSettled(
        pendingTasks.map(task =>
          technicianService.getShortestPath(
            from.latitude,
            from.longitude,
            task.location!.latitude,
            task.location!.longitude,
          ),
        ),
      );
      const newDistances: Record<string, number> = {};
      const newEtas: Record<string, number> = {};
      results.forEach((result, index) => {
        const taskId = pendingTasks[index].id;
        if (result.status === 'fulfilled') {
          newDistances[taskId] = result.value.distanceKm;
          newEtas[taskId] = result.value.etaMinutes;
        }
        // A failed lookup just leaves that job out of the distance map —
        // it sorts to the end (see sortedTasks) rather than blocking the
        // whole list.
      });
      setDistances(newDistances);
      setEtas(newEtas);
    } finally {
      setIsCalculatingDistances(false);
    }
  };

  const handleSelectSort = (mode: SortMode) => {
    setSortMode(mode);
    if (mode === 'DISTANCE' && Object.keys(distances).length === 0) {
      if (currentLocation) {
        calculateDistances(currentLocation);
      } else {
        Alert.alert(
          'Location Unavailable',
          'Could not get your current location. Please check location permissions and try again.',
        );
      }
    }
  };

  const handleRefreshDistances = () => {
    if (currentLocation) {
      calculateDistances(currentLocation);
    }
  };

  const sortedTasks = [...pendingTasks].sort((a, b) => {
    if (sortMode === 'DISTANCE') {
      const aDist = distances[a.id] ?? Infinity;
      const bDist = distances[b.id] ?? Infinity;
      return aDist - bDist;
    }
    const priorityOrder = {HIGH: 0, MEDIUM: 1, LOW: 2};
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return (
      new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
    );
  });

  const topTaskId = sortedTasks.length > 0 ? sortedTasks[0].id : null;

  const handleFitAll = () => {
    const points = sortedTasks.map(t => ({
      latitude: t.location!.latitude,
      longitude: t.location!.longitude,
    }));
    if (currentLocation) points.push(currentLocation);
    if (points.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(points, {
        edgePadding: {top: 80, right: 80, bottom: 220, left: 80},
        animated: true,
      });
    }
  };

  const handleFocusTask = (task: Task) => {
    setSelectedTaskId(task.id);
    mapRef.current?.animateToRegion({
      latitude: task.location!.latitude,
      longitude: task.location!.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  };

  const formatDistance = (taskId: string) => {
    const km = distances[taskId];
    if (km === undefined) return null;
    return km < 1 ? `≈ ${(km * 1000).toFixed(0)} m` : `≈ ${km.toFixed(1)} km`;
  };

  const formatEta = (taskId: string) => {
    const mins = etas[taskId];
    if (mins === undefined) return null;
    return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Job Map</Text>
          <Text style={styles.headerSubtitle}>
            {sortedTasks.length} pending job{sortedTasks.length === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={{width: 60}} />
      </View>

      {/* Sort Toggle */}
      <View style={styles.sortToggleRow}>
        <TouchableOpacity
          style={[
            styles.sortToggleButton,
            sortMode === 'PRIORITY' && styles.sortToggleButtonActive,
          ]}
          onPress={() => handleSelectSort('PRIORITY')}>
          <Text
            style={[
              styles.sortToggleText,
              sortMode === 'PRIORITY' && styles.sortToggleTextActive,
            ]}>
            ⭐ Priority
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sortToggleButton,
            sortMode === 'DISTANCE' && styles.sortToggleButtonActive,
          ]}
          onPress={() => handleSelectSort('DISTANCE')}>
          {isCalculatingDistances ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text
              style={[
                styles.sortToggleText,
                sortMode === 'DISTANCE' && styles.sortToggleTextActive,
              ]}>
              📍 Distance
            </Text>
          )}
        </TouchableOpacity>
        {sortMode === 'DISTANCE' && !isCalculatingDistances && (
          <TouchableOpacity onPress={handleRefreshDistances} style={styles.refreshDistanceButton}>
            <Text style={styles.refreshDistanceText}>🔄</Text>
          </TouchableOpacity>
        )}
      </View>
      {sortMode === 'DISTANCE' && (
        <Text style={styles.approxNote}>
          ≈ Straight-line estimates — not a real routed distance (no
          road-network data source available yet)
        </Text>
      )}

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: currentLocation?.latitude ?? 6.9271,
          longitude: currentLocation?.longitude ?? 79.8612,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
        onMapReady={handleFitAll}>
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="Your Location"
            anchor={{x: 0.5, y: 0.5}}>
            <View style={styles.currentLocationMarker}>
              <View style={styles.currentLocationOuter}>
                <View style={styles.currentLocationInner} />
              </View>
            </View>
          </Marker>
        )}

        {sortedTasks.map((task, index) => {
          const isTop = task.id === topTaskId;
          return (
            <Marker
              key={task.id}
              coordinate={{
                latitude: task.location!.latitude,
                longitude: task.location!.longitude,
              }}
              onPress={() => handleFocusTask(task)}>
              <View
                style={[
                  styles.jobMarker,
                  isTop && styles.jobMarkerTop,
                  selectedTaskId === task.id && styles.jobMarkerSelected,
                ]}>
                <View
                  style={[
                    styles.jobMarkerCircle,
                    {backgroundColor: getPriorityColor(task.priority)},
                  ]}>
                  <Text style={styles.jobMarkerRank}>{index + 1}</Text>
                </View>
                {isTop && (
                  <View style={styles.topPickBadge}>
                    <Text style={styles.topPickBadgeText}>🏆 Top Pick</Text>
                  </View>
                )}
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Map Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity style={styles.mapControlButton} onPress={handleFitAll}>
          <Text style={styles.mapControlIcon}>⊙</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Job List */}
      <View style={styles.jobListContainer}>
        <View style={styles.jobListHeader}>
          <Text style={styles.jobListTitle}>
            Jobs ({sortedTasks.length}) — sorted by{' '}
            {sortMode === 'DISTANCE' ? 'Distance' : 'Priority'}
          </Text>
          <TouchableOpacity onPress={() => dispatch(fetchTasks())}>
            <Text style={styles.refreshText}>{isLoading ? '...' : '🔄 Refresh'}</Text>
          </TouchableOpacity>
        </View>

        {sortedTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No pending jobs</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.jobListContent}>
            {sortedTasks.map((task, index) => {
              const isTop = task.id === topTaskId;
              const distanceLabel = formatDistance(task.id);
              const etaLabel = formatEta(task.id);
              return (
                <TouchableOpacity
                  key={task.id}
                  style={[
                    styles.jobListCard,
                    isTop && styles.jobListCardTop,
                    selectedTaskId === task.id && styles.jobListCardSelected,
                  ]}
                  onPress={() => handleFocusTask(task)}>
                  {isTop && (
                    <View style={styles.jobListTopBadge}>
                      <Text style={styles.jobListTopBadgeText}>🏆 #1</Text>
                    </View>
                  )}
                  <View style={styles.jobListCardHeader}>
                    <Text style={styles.jobListRank}>#{index + 1}</Text>
                    <Text style={styles.jobListPriorityIcon}>
                      {getPriorityIcon(task.priority)}
                    </Text>
                  </View>
                  <Text style={styles.jobListCustomer} numberOfLines={1}>
                    {task.customerName || 'Customer'}
                  </Text>
                  <Text style={styles.jobListAddress} numberOfLines={1}>
                    📍 {task.location?.address}
                  </Text>
                  {sortMode === 'DISTANCE' ? (
                    distanceLabel ? (
                      <Text style={styles.jobListMeta}>
                        {distanceLabel}
                        {etaLabel ? ` • ${etaLabel}` : ''}
                      </Text>
                    ) : (
                      <Text style={styles.jobListMeta}>Distance unavailable</Text>
                    )
                  ) : (
                    <Text
                      style={[
                        styles.jobListMeta,
                        {color: getPriorityColor(task.priority)},
                      ]}>
                      {task.priority || 'NORMAL'} PRIORITY
                    </Text>
                  )}
                  <TouchableOpacity
                    style={styles.jobListNavigateButton}
                    onPress={() =>
                      navigation.navigate('Navigation', {taskId: task.id})
                    }>
                    <Text style={styles.jobListNavigateButtonText}>
                      🗺️ Navigate
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
  header: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: typography.xs,
    color: colors.white,
    opacity: 0.8,
    textAlign: 'center',
  },
  sortToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    alignItems: 'center',
  },
  sortToggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.white + '20',
  },
  sortToggleButtonActive: {
    backgroundColor: colors.white,
  },
  sortToggleText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  sortToggleTextActive: {
    color: colors.primary,
  },
  refreshDistanceButton: {
    padding: spacing.xs,
  },
  refreshDistanceText: {
    fontSize: 18,
  },
  approxNote: {
    backgroundColor: colors.warning + '25',
    color: colors.textPrimary,
    fontSize: typography.xs,
    fontWeight: typography.medium,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  map: {
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    right: spacing.md,
    top: 140,
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
  jobMarker: {
    alignItems: 'center',
  },
  jobMarkerTop: {
    transform: [{scale: 1.15}],
  },
  jobMarkerSelected: {
    transform: [{scale: 1.25}],
  },
  jobMarkerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  jobMarkerRank: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  topPickBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: 8,
    marginTop: 2,
  },
  topPickBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: typography.bold,
  },
  jobListContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.md,
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: -3},
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  jobListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  jobListTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  refreshText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  jobListContent: {
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  jobListCard: {
    width: 170,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.sm,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  jobListCardTop: {
    borderColor: colors.accent,
    borderWidth: 2,
    backgroundColor: colors.accent + '10',
  },
  jobListCardSelected: {
    borderColor: colors.primary,
  },
  jobListTopBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: 6,
    marginBottom: spacing.xs,
  },
  jobListTopBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: typography.bold,
  },
  jobListCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  jobListRank: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: colors.textSecondary,
  },
  jobListPriorityIcon: {
    fontSize: 14,
  },
  jobListCustomer: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  jobListAddress: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  jobListMeta: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: typography.medium,
    marginTop: spacing.xs,
  },
  jobListNavigateButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.secondary,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    alignItems: 'center',
  },
  jobListNavigateButtonText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
});

export default JobsMapScreen;
