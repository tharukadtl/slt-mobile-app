import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {
  AuthState,
  OTPRequest,
  OTPVerify,
  AuthResponse,
  UpdateProfileRequest,
} from '@appTypes/auth.types';
import authService from '@services/authService';

const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const register = createAsyncThunk(
  'auth/register',
  async (
    data: {firstName: string; lastName: string; phone: string; password: string; email?: string},
    {rejectWithValue},
  ) => {
    try {
      const response: AuthResponse = await authService.register(data);
      return response;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          'Registration failed',
      );
    }
  },
);

export const sendOTP = createAsyncThunk(
  'auth/sendOTP',
  async (data: OTPRequest, {rejectWithValue}) => {
    try {
      await authService.sendOTP(data);
      return true;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          'Failed to send OTP',
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
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          'Invalid OTP',
      );
    }
  },
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (data: UpdateProfileRequest, {rejectWithValue}) => {
    try {
      const response = await authService.updateProfile(data);
      return response;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          'Failed to update profile',
      );
    }
  },
);

const mapRole = (
  role: string,
): 'client' | 'technician' | 'teamlead' | 'admin' | 'super_admin' => {
  console.log('[AUTH] Backend role received:', role);
  switch (role?.toUpperCase()) {
    case 'CLIENT':
    case 'CUSTOMER':          return 'client';
    case 'TECHNICIAN':
    case 'FIELD_TECHNICIAN':  return 'technician';
    case 'TEAM_LEAD':
    case 'TEAMLEAD':
    case 'TEAM_LEADER':       return 'teamlead';
    case 'ADMIN':             return 'admin';
    case 'SUPER_ADMIN':       return 'super_admin';
    default:
      console.warn('[AUTH] Unknown role, defaulting to client:', role);
      return 'client';
  }
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    restoreSession: (state, action: PayloadAction<AuthResponse>) => {
      state.isAuthenticated = true;
      state.token = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.user = {
        id: action.payload.userId.toString(),
        username: action.payload.username,
        name: action.payload.fullName,
        phone: action.payload.phoneNumber ?? action.payload.username,
        branchId: action.payload.branchId,
        role: mapRole(action.payload.role),
        language: 'ENGLISH',
        notificationPreferences: {
          statusUpdates: true,
          technicianAssigned: true,
          jobCompleted: true,
          billing: true,
          promotions: false,
        },
      };
    },
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
    updateNotificationPreferences: (state, action) => {
      if (state.user) {
        state.user.notificationPreferences = action.payload;
      }
    },
    updateLanguage: (state, action) => {
      if (state.user) {
        state.user.language = action.payload;
      }
    },
  },
  extraReducers: builder => {
    builder.addCase(register.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(register.fulfilled, (state, action) => {
      state.isLoading = false;
      state.isAuthenticated = true;
      state.token = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.user = {
        id: action.payload.userId.toString(),
        username: action.payload.username,
        name: action.payload.fullName,
        phone: action.payload.phoneNumber ?? action.payload.username,
        branchId: action.payload.branchId,
        role: mapRole(action.payload.role),
        language: 'ENGLISH',
        notificationPreferences: {
          statusUpdates: true,
          technicianAssigned: true,
          jobCompleted: true,
          billing: true,
          promotions: false,
        },
      };
    });
    builder.addCase(register.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
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
        username: action.payload.username,
        name: action.payload.fullName,
        phone: action.payload.phoneNumber ?? action.payload.username,
        branchId: action.payload.branchId,
        role: mapRole(action.payload.role),
        language: 'ENGLISH',
        notificationPreferences: {
          statusUpdates: true,
          technicianAssigned: true,
          jobCompleted: true,
          billing: true,
          promotions: false,
        },
      };
    });
    builder.addCase(verifyOTP.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(updateProfile.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(updateProfile.fulfilled, (state, action) => {
      state.isLoading = false;
      if (state.user) {
        state.user.name = action.payload.fullName;
        state.user.email = action.payload.email;
        state.user.language = action.payload.language;
        state.user.notificationPreferences =
          action.payload.notificationPreferences;
      }
    });
    builder.addCase(updateProfile.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
  },
});

export {register};
export const {
  restoreSession,
  logout,
  clearError,
  updateNotificationPreferences,
  updateLanguage,
} = authSlice.actions;
export default authSlice.reducer;