export interface User {
  id: string;
  username?: string;
  name: string;
  phone: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  role: 'client' | 'technician' | 'teamlead' | 'admin' | 'super_admin';
  branchId?: number;
  profilePhoto?: string;
  language?: string;
  notificationPreferences?: NotificationPreferences;
}

export interface NotificationPreferences {
  statusUpdates: boolean;
  technicianAssigned: boolean;
  jobCompleted: boolean;
  billing: boolean;
  promotions: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface OTPRequest {
  phoneNumber: string;
}

export interface OTPVerify {
  phoneNumber: string;
  otp: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  userId: number;
  username: string;
  role: string;
  fullName: string;
  branchId: number;
  expiresIn: number;
  phoneNumber?: string;
}

export interface UpdateProfileRequest {
  fullName: string;
  email: string;
  language: string;
  notificationPreferences: NotificationPreferences;
}