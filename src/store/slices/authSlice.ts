import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {AuthState, OTPRequest, OTPVerify, AuthResponse} from '@appTypes/auth.types';
import authService from '@services/authService';

const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const sendOTP = createAsyncThunk(
  'auth/sendOTP',
  async (data: OTPRequest, {rejectWithValue}) => {
    try {
      await authService.sendOTP(data);
      return true;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || error.message || 'Failed to send OTP',
      );
    }
  },
);

export const verifyOTP = createAsyncThunk(
  'auth/verifyOTP',
  async (data: OTPVerify, {rejectWithValue}) => {
    try {
      const response: AuthResponse = await authService.verifyOTP(data);
      return response;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || error.message || 'Invalid OTP',
      );
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: state => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder.addCase(sendOTP.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(sendOTP.fulfilled, state => {
      state.isLoading = false;
    });
    builder.addCase(sendOTP.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(verifyOTP.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(verifyOTP.fulfilled, (state, action) => {
      state.isLoading = false;
      state.isAuthenticated = true;
      state.token = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.user = {
        id: action.payload.userId.toString(),
        name: action.payload.fullName,
        phone: action.payload.username,
        role: mapRole(action.payload.role),
      };
    });
    builder.addCase(verifyOTP.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
  },
});

const mapRole = (role: string): 'client' | 'technician' | 'teamlead' => {
  switch (role?.toUpperCase()) {
    case 'TECHNICIAN': return 'technician';
    case 'TEAM_LEAD':
    case 'TEAMLEAD': return 'teamlead';
    default: return 'client';
  }
};

export const {logout, clearError} = authSlice.actions;
export default authSlice.reducer;