import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';

interface LocationData {
  address: string;
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  location: LocationData | null;
  onLocationChange: (location: LocationData) => void;
}

const LocationPicker: React.FC<LocationPickerProps> = ({
  location,
  onLocationChange,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'SLT App needs location access to report your issue',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        return false;
      }
    }
    return true;
  };

  const getAddressFromCoords = async (
    lat: number,
    lng: number,
  ): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'SLTMobileApp/1.0',
          },
        },
      );
      const data = await response.json();
      return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const handleDetectLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Denied',
        'Location permission is required to auto-detect your location',
      );
      return;
    }

    setIsLoading(true);
    Geolocation.getCurrentPosition(
      async position => {
        const {latitude, longitude} = position.coords;
        const address = await getAddressFromCoords(latitude, longitude);
        onLocationChange({address, latitude, longitude});
        setShowMap(true);
        setIsLoading(false);
      },
      error => {
        setIsLoading(false);
        setShowManualInput(true);
        Alert.alert(
          'Location Error',
          'Unable to get your location. Please enter your address manually below.',
        );
        console.error(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  };

  const handleManualAddressSubmit = () => {
    if (!manualAddress.trim()) {
      Alert.alert('Error', 'Please enter an address');
      return;
    }
    onLocationChange({
      address: manualAddress.trim(),
      latitude: 6.9271,  // default: Colombo, Sri Lanka
      longitude: 79.8612,
    });
    setShowManualInput(false);
  };

  const handleMapPress = async (event: any) => {
    const {latitude, longitude} = event.nativeEvent.coordinate;
    setIsLoading(true);
    const address = await getAddressFromCoords(latitude, longitude);
    onLocationChange({address, latitude, longitude});
    setIsLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Service Location *</Text>

      {/* Detect Location Button */}
      <TouchableOpacity
        style={styles.detectButton}
        onPress={handleDetectLocation}
        disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.detectButtonText}>
            📍 Auto-Detect My Location
          </Text>
        )}
      </TouchableOpacity>

      {/* Manual Address Input */}
      {!location && (
        <TouchableOpacity
          style={styles.manualToggle}
          onPress={() => setShowManualInput(prev => !prev)}>
          <Text style={styles.manualToggleText}>
            ✏️ Enter address manually
          </Text>
        </TouchableOpacity>
      )}

      {(showManualInput && !location) && (
        <View style={styles.manualInputContainer}>
          <TextInput
            style={styles.manualInput}
            placeholder="e.g. 42 Galle Road, Colombo 03"
            placeholderTextColor={colors.textLight}
            value={manualAddress}
            onChangeText={setManualAddress}
            multiline={false}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={styles.manualSubmitButton}
            onPress={handleManualAddressSubmit}>
            <Text style={styles.manualSubmitText}>Use This Address</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Location Info */}
      {location && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationAddress} numberOfLines={2}>
            {location.address}
          </Text>
          <TouchableOpacity onPress={() => setShowMap(!showMap)}>
            <Text style={styles.mapToggle}>
              {showMap ? 'Hide Map' : 'Show Map'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map View */}
      {showMap && location && (
        <View style={styles.mapContainer}>
          <Text style={styles.mapHint}>
            Tap on map to adjust location
          </Text>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            onPress={handleMapPress}>
            <Marker
              coordinate={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              title="Issue Location"
              description={location.address}
              pinColor={colors.primary}
            />
          </MapView>
          <View style={styles.coordsContainer}>
            <Text style={styles.coordsText}>
              📍 {location.latitude.toFixed(6)},{' '}
              {location.longitude.toFixed(6)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  manualToggle: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  manualToggleText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  manualInputContainer: {
    marginBottom: spacing.sm,
  },
  manualInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.md,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  manualSubmitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  manualSubmitText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.medium,
  },
  detectButton: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  detectButtonText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.medium,
  },
  locationInfo: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  locationIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  locationAddress: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textPrimary,
    lineHeight: typography.lineHeightMd,
  },
  mapToggle: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
    marginLeft: spacing.sm,
  },
  mapContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapHint: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
  },
  map: {
    height: 200,
    width: '100%',
  },
  coordsContainer: {
    backgroundColor: colors.background,
    padding: spacing.sm,
    alignItems: 'center',
  },
  coordsText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
});

export default LocationPicker;