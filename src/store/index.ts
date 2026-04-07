import {configureStore} from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import issueReducer from './slices/issueSlice';
import technicianReducer from './slices/technicianSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    issues: issueReducer,
    technician: technicianReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;