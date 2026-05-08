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
  TextInput,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TeamLeadStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {performBOD} from '@store/slices/technicianSlice';
import Geolocation from '@react-native-community/geolocation';
import MapView, {Marker, UrlTile} from 'react-native-maps';
import api from '@services/api';

type BODNavigationProp = StackNavigationProp<TeamLeadStackParamList>;

interface Technician {
  id: number;
  username: string;
  fullName?: string;
  phone?: string;
  isActive?: boolean;
  role?: string;
}

interface Vehicle {
  id: number;
  registrationNumber: string;
  make?: string;
  model?: string;
  status?: string;
}

const BODScreen = () => {
  const navigation = useNavigation<BODNavigationProp>();
  const dispatch = useAppDispatch();
  const {isLoading} = useAppSelector(state => state.technician);
  const {user} = useAppSelector(state => state.auth);

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loadingTechs, setLoadingTechs] = useState(false);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [odometerStart, setOdometerStart] = useState('');

  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(true);

  useEffect(() => {
    fetchTechnicians();
    fetchVehicles();
    getLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.branchId]);

  const fetchTechnicians = async () => {
    setLoadingTechs(true);
    try {
      const branchId = user?.branchId;
      const url = branchId
        ? `/api/users?role=TECHNICIAN&branchId=${branchId}&activeOnly=true`
        : '/api/users?role=TECHNICIAN';
      const response = await api.get(url);
      setTechnicians(response.data);
    } catch {
      Alert.alert('Error', 'Failed to load technicians');
    } finally {
      setLoadingTechs(false);
    }
  };

  const fetchVehicles = async () => {
    setLoadingVehicles(true);
    try {
      const branchId = user?.branchId;
      const url = branchId
        ? `/api/vehicles?branchId=${branchId}&activeOnly=true`
        : '/api/vehicles';
      const response = await api.get(url);
      setVehicles(response.data);
    } catch {
      // non-fatal — vehicle selection remains optional
    } finally {
      setLoadingVehicles(false);
    }
  };

  const applyCoords = async (latitude: number, longitude: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
        {headers: {'User-Agent': 'SLTMobileApp/1.0'}},
      );
      const data = await res.json();
      setLocation({
        latitude,
        longitude,
        address: data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      });
    } catch {
      setLocation({latitude, longitude, address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`});
    }
    setGettingLocation(false);
  };

  const getLocation = async () => {
    // Request permission (Android only — on iOS Geolocation handles it natively)
    if (PermissionsAndroid.request) {
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
        Alert.alert(
          'Permission Denied',
          'Location permission was denied. You can still submit BOD without it.',
        );
        return;
      }
    }

    setGettingLocation(true);

    // First attempt: high-accuracy GPS (15 s)
    Geolocation.getCurrentPosition(
      pos => applyCoords(pos.coords.latitude, pos.coords.longitude),
      () => {
        // Fallback: network/coarse location (10 s)
        Geolocation.getCurrentPosition(
          pos => applyCoords(pos.coords.latitude, pos.coords.longitude),
          error => {
            setGettingLocation(false);
            const msg =
              error.code === 1
                ? 'Location permission denied. Enable it in Settings.'
                : error.code === 2
                ? 'Location unavailable. Make sure GPS or Wi-Fi is on.'
                : 'Location timed out. You can submit BOD without it.';
            Alert.alert('Location Error', msg);
          },
          {enableHighAccuracy: false, timeout: 10000, maximumAge: 60000},
        );
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 0},
    );
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
        {headers: {'User-Agent': 'SLTMobileApp/1.0'}},
      );
      const data = await res.json();
      return data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    } catch {
      return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    }
  };

  const toggleTechnician = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) {
      Alert.alert('Validation', 'Please select at least one technician');
      return;
    }

    const payload: any = {
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      locationAddress: location?.address ?? null,
      technicianIds: selectedIds,
    };
    if (selectedVehicleId != null) {
      payload.vehicleId = selectedVehicleId;
    }
    if (odometerStart.trim()) {
      payload.odometerStart = parseInt(odometerStart, 10);
    }

    const result = await dispatch(performBOD(payload));
    if (performBOD.fulfilled.match(result)) {
      navigation.replace('AssignJobs');
    } else {
      Alert.alert(
        'Error',
        (result.payload as string) || 'BOD submission failed',
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header — no back button; BOD is a required gate */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Beginning of Day</Text>
        <Text style={styles.headerSubtitle}>Start your team's daily session</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Location Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📍 Current Location</Text>
          {gettingLocation ? (
            <View style={styles.row}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.locationText}>Getting location...</Text>
            </View>
          ) : !gettingLocation && !location ? (
            <View>
              <Text style={styles.locationWarning}>
                ⚠️ Location unavailable — you can still submit BOD without it.
              </Text>
              <TouchableOpacity onPress={getLocation} style={styles.retryButton}>
                <Text style={styles.retryText}>🔄 Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : location ? (
            <>
              <MapView
                style={styles.map}
                region={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.004,
                  longitudeDelta: 0.004,
                }}>
                <UrlTile
                  urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maximumZ={19}
                  flipY={false}
                />
                <Marker
                  coordinate={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                  }}
                  draggable
                  onDragEnd={async e => {
                    const {latitude, longitude} = e.nativeEvent.coordinate;
                    const address = await reverseGeocode(latitude, longitude);
                    setLocation({latitude, longitude, address});
                  }}
                />
              </MapView>
              <Text style={styles.locationText} numberOfLines={2}>
                {location.address}
              </Text>
              <Text style={styles.coordsText}>
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Text>
              <TouchableOpacity onPress={getLocation} style={styles.retryButton}>
                <Text style={styles.retryText}>🔄 Refresh Location</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={getLocation} style={styles.retryButton}>
              <Text style={styles.retryText}>🔄 Get Location</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Vehicle Selection (Optional) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🚗 Vehicle (Optional)</Text>
          {loadingVehicles ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : vehicles.length === 0 ? (
            <Text style={styles.emptyText}>No active vehicles found</Text>
          ) : (
            <>
              {/* None option */}
              <TouchableOpacity
                style={[
                  styles.vehicleRow,
                  selectedVehicleId === null && styles.vehicleRowSelected,
                ]}
                onPress={() => setSelectedVehicleId(null)}>
                <View
                  style={[
                    styles.radio,
                    selectedVehicleId === null && styles.radioSelected,
                  ]}>
                  {selectedVehicleId === null && (
                    <View style={styles.radioDot} />
                  )}
                </View>
                <Text style={styles.vehicleLabel}>None</Text>
              </TouchableOpacity>

              {vehicles.map(v => {
                const selected = selectedVehicleId === v.id;
                const label = [v.registrationNumber, v.make, v.model]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      styles.vehicleRow,
                      selected && styles.vehicleRowSelected,
                    ]}
                    onPress={() => setSelectedVehicleId(v.id)}>
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.vehicleInfo}>
                      <Text style={styles.vehicleLabel}>{label}</Text>
                      {v.status && (
                        <Text style={styles.vehicleStatus}>{v.status}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {selectedVehicleId != null && (
            <TextInput
              style={[styles.input, {marginTop: spacing.sm}]}
              placeholder="Odometer Start (km)"
              placeholderTextColor={colors.textLight}
              value={odometerStart}
              onChangeText={setOdometerStart}
              keyboardType="numeric"
            />
          )}
        </View>

        {/* Technician Selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            👥 Select Technicians ({selectedIds.length} selected)
          </Text>
          {loadingTechs ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : technicians.length === 0 ? (
            <Text style={styles.emptyText}>No technicians found</Text>
          ) : (
            technicians.map(tech => {
              const selected = selectedIds.includes(tech.id);
              const displayName = tech.fullName || tech.username || 'User';
              return (
                <TouchableOpacity
                  key={tech.id}
                  style={[styles.techRow, selected && styles.techRowSelected]}
                  onPress={() => toggleTechnician(tech.id)}>
                  <View
                    style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.techAvatar}>
                    <Text style={styles.techAvatarText}>
                      {displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.techInfo}>
                    <Text style={styles.techName}>{displayName}</Text>
                    {tech.phone && (
                      <Text style={styles.techPhone}>{tech.phone}</Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: tech.isActive
                          ? colors.success
                          : colors.error,
                      },
                    ]}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (isLoading || selectedIds.length === 0) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isLoading || selectedIds.length === 0}>
          {isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>🌅 Start BOD Session</Text>
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
  map: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: spacing.sm,
    overflow: 'hidden',
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
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.md,
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: typography.md,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.xs,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  vehicleRowSelected: {
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleLabel: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  vehicleStatus: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.xs,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  techRowSelected: {
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: typography.bold,
  },
  techAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  techAvatarText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  techInfo: {
    flex: 1,
  },
  techName: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  techPhone: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
