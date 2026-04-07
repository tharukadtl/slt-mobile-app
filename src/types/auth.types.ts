export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'client' | 'technician' | 'teamlead';
  profilePhoto?: string;
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
}