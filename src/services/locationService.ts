import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import technicianService from './technicianService';

const locationService = {
  requestPermission: async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  },

  getCurrentLocation: (): Promise<{latitude: number; longitude: number}> => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        error => reject(error),
        {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
      );
    });
  },

  startTracking: (
    callback: (location: {latitude: number; longitude: number}) => void,
  ) => {
    return Geolocation.watchPosition(
      position => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        callback(location);
        technicianService.updateLocation(
          location.latitude,
          location.longitude,
        );
      },
      error => console.error(error),
      {enableHighAccuracy: true, distanceFilter: 10},
    );
  },

  stopTracking: (watchId: number) => {
    Geolocation.clearWatch(watchId);
  },
};

export default locationService;