import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {OTPRequest, OTPVerify, AuthResponse} from '@appTypes/auth.types';

const authService = {
  sendOTP: async (data: OTPRequest): Promise<void> => {
    await api.post('/api/auth/otp/send', {
      phoneNumber: data.phoneNumber,
    });
  },

  verifyOTP: async (data: OTPVerify): Promise<AuthResponse> => {
    const response = await api.post('/api/auth/otp/verify', {
      phoneNumber: data.phoneNumber,
      otp: data.otp,
    });
    await AsyncStorage.setItem('token', response.data.accessToken);
    await AsyncStorage.setItem('refreshToken', response.data.refreshToken);
    await AsyncStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.log('Logout error:', error);
    }
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('user');
  },

  getStoredUser: async () => {
    const user = await AsyncStorage.getItem('user');
    const token = await AsyncStorage.getItem('token');
    if (user && token) {
      return {user: JSON.parse(user), token};
    }
    return null;
  },

  refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
    const response = await api.post('/api/auth/refresh', {refreshToken});
    return response.data;
  },
};

export default authService;