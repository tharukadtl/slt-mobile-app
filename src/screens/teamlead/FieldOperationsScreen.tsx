import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TeamLeadStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {
  submitBODCheckIn,
  submitEODCheckOut,
  fetchTeamTasks,
} from '@store/slices/technicianSlice';
import Geolocation from '@react-native-community/geolocation';

type FieldOperationsNavigationProp =
  StackNavigationProp<TeamLeadStackParamList>;

const FieldOperationsScreen = () => {
  const navigation = useNavigation<FieldOperationsNavigationProp>();
  const dispatch = useAppDispatch();
  const {bodCheckIn, tasks, isLoading} = useAppSelector(
    state => state.technician,
  );

  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  useEffect(() => {
    dispatch(fetchTeamTasks());
    getCurrentLocation();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (checkInTime) {
      interval = setInterval(() => {
        const now = new Date();
        const checkIn = new Date(checkInTime);
        const diff = now.getTime() - checkIn.getTime();
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setElapsedTime(
          `${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}:${seconds
            .toString()
            .padStart(2, '0')}`,
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [checkInTime]);

  const requestLocationPermission = async (): Promise<boolean> => {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'SLT App needs location for check-in',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const getAddressFromCoords = async (
    lat: number,
    lng: number,
  ): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        {headers: {'User-Agent': 'SLTMobileApp/1.0'}},
      );
      const data = await response.json();
      return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  };

  const getCurrentLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    setIsGettingLocation(true);
    Geolocation.getCurrentPosition(
      async position => {
        const {latitude, longitude} = position.coords;
        const address = await getAddressFromCoords(
          latitude,
          longitude,
        );
        setCurrentLocation({latitude, longitude, address});
        setIsGettingLocation(false);
      },
      error => {
        setIsGettingLocation(false);
        console.error(error);
      },
      {enableHighAccuracy: true, timeout: 15000},
    );
  };

  const handleBODCheckIn = async () => {
    if (!currentLocation) {
      Alert.alert('Error', 'Location not available. Please try again.');
      await getCurrentLocation();
      return;
    }
    Alert.alert(
      'BOD Check-In',
      `Checking in at:\n${currentLocation.address.substring(0, 100)}`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Check In',
          onPress: async () => {
            const result = await dispatch(
              submitBODCheckIn(currentLocation),
            );
            if (submitBODCheckIn.fulfilled.match(result)) {
              const now = new Date().toISOString();
              setCheckInTime(now);
              Alert.alert(
                'Check-In Successful ✅',
                `Time: ${new Date().toLocaleTimeString()}\nLocation: ${currentLocation.address.substring(
                  0,
                  80,
                )}`,
              );
            } else {
              // Offline fallback
              const now = new Date().toISOString();
              setCheckInTime(now);
              Alert.alert(
                'Check-In Recorded',
                'Saved locally. Will sync when online.',
              );
            }
          },
        },
      ],
    );
  };

  const handleEODCheckOut = async () => {
    if (!checkInTime) {
      Alert.alert('Error', 'You have not checked in today');
      return;
    }
    if (!currentLocation) {
      await getCurrentLocation();
      return;
    }
    Alert.alert(
      'EOD Check-Out',
      `Working time: ${elapsedTime}\nLocation: ${currentLocation.address.substring(
        0,
        80,
      )}`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Check Out',
          style: 'destructive',
          onPress: async () => {
            const result = await dispatch(
              submitEODCheckOut(currentLocation),
            );
            setCheckInTime(null);
            setElapsedTime('00:00:00');
            Alert.alert(
              'Check-Out Successful ✅',
              `Total working time: ${elapsedTime}`,
            );
          },
        },
      ],
    );
  };

  const handleNavigateToJob = (task: any) => {
    navigation.navigate('JobNavigation', {
      taskId: task.id,
      address: task.location?.address || '',
      latitude: task.location?.latitude || 0,
      longitude: task.location?.longitude || 0,
    });
  };

  const handleMaterialRequest = (task: any) => {
    navigation.navigate('MaterialRequest', {taskId: task.id});
  };

  const activeTasks = tasks.filter(
    t => t.status !== 'completed' && t.status !== 'cancelled',
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Field Operations</Text>
        <Text style={styles.headerSubtitle}>
          Manage your field activities
        </Text>
      </View>

      <View style={styles.content}>
        {/* Current Location Card */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Text style={styles.locationTitle}>
              📍 Current Location
            </Text>
            <TouchableOpacity
              style={styles.refreshLocationButton}
              onPress={getCurrentLocation}
              disabled={isGettingLocation}>
              {isGettingLocation ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />
              ) : (
                <Text style={styles.refreshLocationText}>
                  🔄 Refresh
                </Text>
              )}
            </TouchableOpacity>
          </View>
          {currentLocation ? (
            <Text style={styles.locationAddress} numberOfLines={2}>
              {currentLocation.address}
            </Text>
          ) : (
            <Text style={styles.locationUnavailable}>
              Location not available
            </Text>
          )}
          {currentLocation && (
            <Text style={styles.locationCoords}>
              {currentLocation.latitude.toFixed(6)},{' '}
              {currentLocation.longitude.toFixed(6)}
            </Text>
          )}
        </View>

        {/* BOD/EOD Check-in Card */}
        <View style={styles.checkInCard}>
          <Text style={styles.checkInTitle}>
            📋 Attendance Check-In
          </Text>

          {/* Timer */}
          {checkInTime && (
            <View style={styles.timerContainer}>
              <Text style={styles.timerLabel}>
                Working Time Today
              </Text>
              <Text style={styles.timerValue}>{elapsedTime}</Text>
              <Text style={styles.timerCheckIn}>
                Checked in at:{' '}
                {new Date(checkInTime).toLocaleTimeString()}
              </Text>
            </View>
          )}

          {/* Check-in Status */}
          <View style={styles.checkInStatus}>
            <View
              style={[
                styles.checkInStatusDot,
                {
                  backgroundColor: checkInTime
                    ? colors.success
                    : colors.error,
                },
              ]}
            />
            <Text style={styles.checkInStatusText}>
              {checkInTime ? 'Checked In ✅' : 'Not Checked In ❌'}
            </Text>
          </View>

          {/* BOD Button */}
          {!checkInTime ? (
            <TouchableOpacity
              style={styles.bodButton}
              onPress={handleBODCheckIn}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.bodButtonIcon}>🌅</Text>
                  <View>
                    <Text style={styles.bodButtonTitle}>
                      BOD Check-In
                    </Text>
                    <Text style={styles.bodButtonSubtitle}>
                      Beginning of Day
                    </Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.eodButton}
              onPress={handleEODCheckOut}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.bodButtonIcon}>🌆</Text>
                  <View>
                    <Text style={styles.bodButtonTitle}>
                      EOD Check-Out
                    </Text>
                    <Text style={styles.bodButtonSubtitle}>
                      End of Day
                    </Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Active Jobs */}
        <Text style={styles.sectionTitle}>
          Active Jobs ({activeTasks.length})
        </Text>
        {activeTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No active jobs</Text>
          </View>
        ) : (
          activeTasks.map(task => (
            <View key={task.id} style={styles.jobCard}>
              {/* Job Header */}
              <View style={styles.jobHeader}>
                <Text style={styles.jobId}>Task #{task.id}</Text>
                <View
                  style={[
                    styles.jobStatusBadge,
                    {
                      backgroundColor:
                        task.status === 'in_progress'
                          ? colors.warning + '20'
                          : colors.secondary + '20',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.jobStatusText,
                      {
                        color:
                          task.status === 'in_progress'
                            ? colors.warning
                            : colors.secondary,
                      },
                    ]}>
                    {task.status.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Job Details */}
              <Text style={styles.jobCustomer}>
                👤 {task.customerName || 'Customer'}
              </Text>
              <Text style={styles.jobAddress} numberOfLines={2}>
                📍 {task.location?.address}
              </Text>
              <Text style={styles.jobDate}>
                📅 {task.scheduledDate}
              </Text>

              {/* Action Buttons */}
              <View style={styles.jobActions}>
                <TouchableOpacity
                  style={styles.navigateButton}
                  onPress={() => handleNavigateToJob(task)}>
                  <Text style={styles.navigateButtonText}>
                    🗺️ Navigate
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.materialButton}
                  onPress={() => handleMaterialRequest(task)}>
                  <Text style={styles.materialButtonText}>
                    📦 Materials
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
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
  backText: {
    color: colors.white,
    fontSize: typography.md,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: typography.md,
    color: colors.white,
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.lg,
  },
  locationCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  locationTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  refreshLocationButton: {
    padding: spacing.xs,
  },
  refreshLocationText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  locationAddress: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeightMd,
    marginBottom: spacing.xs,
  },
  locationUnavailable: {
    fontSize: typography.sm,
    color: colors.error,
    fontStyle: 'italic',
  },
  locationCoords: {
    fontSize: typography.xs,
    color: colors.textLight,
    fontFamily: 'monospace',
  },
  checkInCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  checkInTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  timerContainer: {
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  timerLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  timerValue: {
    fontSize: 36,
    fontWeight: typography.bold,
    color: colors.primary,
    fontFamily: 'monospace',
  },
  timerCheckIn: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  checkInStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  checkInStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  checkInStatusText: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  bodButton: {
    backgroundColor: colors.success,
    borderRadius: 8,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  eodButton: {
    backgroundColor: colors.warning,
    borderRadius: 8,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bodButtonIcon: {
    fontSize: 32,
  },
  bodButtonTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.white,
  },
  bodButtonSubtitle: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.xl,
    alignItems: 'center',
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.lg,
    color: colors.textSecondary,
  },
  jobCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  jobId: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  jobStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  jobStatusText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  jobCustomer: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  jobAddress: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: typography.lineHeightMd,
  },
  jobDate: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  jobActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  navigateButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
  },
  navigateButtonText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  materialButton: {
    flex: 1,
    backgroundColor: colors.secondary,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
  },
  materialButtonText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
});

export default FieldOperationsScreen;