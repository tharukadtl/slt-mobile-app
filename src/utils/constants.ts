export const API_BASE_URL = 'http://10.0.2.2:8080/api';

export const STORAGE_KEYS = {
  TOKEN: 'token',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
  FCM_TOKEN: 'fcmToken',
};

export const OTP_EXPIRY_MINUTES = 5;
export const OTP_LENGTH = 6;

export const ISSUE_CATEGORIES = [
  {label: 'Broadband', value: 'broadband'},
  {label: 'Telephone', value: 'telephone'},
  {label: 'Fiber', value: 'fiber'},
  {label: 'Television', value: 'television'},
  {label: 'Other', value: 'other'},
];

export const ISSUE_STATUSES = [
  {label: 'Pending', value: 'pending'},
  {label: 'Assigned', value: 'assigned'},
  {label: 'In Progress', value: 'in_progress'},
  {label: 'Completed', value: 'completed'},
  {label: 'Cancelled', value: 'cancelled'},
];

export const TASK_STATUSES = [
  {label: 'Assigned', value: 'assigned'},
  {label: 'Accepted', value: 'accepted'},
  {label: 'Travelling', value: 'travelling'},
  {label: 'In Progress', value: 'in_progress'},
  {label: 'Completed', value: 'completed'},
];