import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '@config/api.config';

const BASE_URL = API_BASE_URL;

// In-memory token avoids async AsyncStorage reads on every request
let _authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  _authToken = token;
};

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

api.interceptors.request.use(
  config => {
    if (_authToken) {
      config.headers.Authorization = `Bearer ${_authToken}`;
    }
    console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, config.data);
    return config;
  },
  error => Promise.reject(error),
);

api.interceptors.response.use(
  response => response,
  async error => {
    console.log(`[API ERROR] ${error.response?.status} ${error.config?.url}`, error.response?.data);
    if (error.response?.status === 401) {
      setAuthToken(null);
      await AsyncStorage.clear();
    }
    return Promise.reject(error);
  },
);

export default api;
