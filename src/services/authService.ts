import axios from 'axios';
import api, {setAuthToken} from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  OTPRequest,
  OTPVerify,
  AuthResponse,
  UpdateProfileRequest,
} from '@appTypes/auth.types';
import {API_BASE_URL} from '@config/api.config';

// Public axios instance — no auth token, used for login/register/OTP endpoints
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

publicApi.interceptors.response.use(
  response => response,
  error => {
    console.log(
      `[API ERROR] ${error.response?.status} ${error.config?.url}`,
      error.response?.data,
    );
    return Promise.reject(error);
  },
);

const authService = {
  register: async (data: {
    firstName: string;
    lastName: string;
    phone: string;
    password: string;
    email?: string;
  }): Promise<AuthResponse> => {
    const response = await publicApi.post('/api/auth/register', {
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      password: data.password,
      email: data.email,
    });
    setAuthToken(response.data.accessToken);
    await AsyncStorage.setItem('token', response.data.accessToken);
    await AsyncStorage.setItem('refreshToken', response.data.refreshToken);
    await AsyncStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
  },

  sendOTP: async (data: OTPRequest): Promise<void> => {
    await publicApi.post('/api/auth/otp/send', {
      phoneNumber: data.phoneNumber,
    });
  },

  verifyOTP: async (data: OTPVerify): Promise<AuthResponse> => {
    const response = await publicApi.post('/api/auth/otp/verify', {
      phoneNumber: data.phoneNumber,
      otp: data.otp,
      deviceInfo: 'SLT Mobile App',
    });
    setAuthToken(response.data.accessToken);
    await AsyncStorage.setItem('token', response.data.accessToken);
    await AsyncStorage.setItem(
      'refreshToken',
      response.data.refreshToken,
    );
    await AsyncStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.log('Logout error:', error);
    }
    setAuthToken(null);
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

  updateProfile: async (
    data: UpdateProfileRequest,
  ): Promise<UpdateProfileRequest> => {
    await api.patch('/api/users/profile', {
      full_name: data.fullName,
      email: data.email,
      preferred_language: data.language,
    });
    const stored = await AsyncStorage.getItem('user');
    if (stored) {
      const user = JSON.parse(stored);
      await AsyncStorage.setItem('user', JSON.stringify({...user, ...data}));
    }
    return data;
  },
};

export default authService;