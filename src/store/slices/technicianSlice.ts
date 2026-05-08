import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {
  TechnicianState,
  PaymentHistoryItem,
} from '@appTypes/technician.types';
import api from '@services/api';

const initialState: TechnicianState = {
  tasks: [],
  selectedTask: null,
  teamMembers: [],
  teamStats: null,
  teamKPI: null,
  targets: [],
  paymentHistory: [],
  selectedPayment: null,
  bodCheckIn: null,
  hasBODToday: false,
  faults: [],
  currentLocation: null,
  isLoading: false,
  error: null,
};

export const fetchTasks = createAsyncThunk(
  'technician/fetchTasks',
  async (_, {rejectWithValue}) => {
    try {
      const response = await api.get('/api/jobs/my');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

// Checks if a BOD session exists for today — used to restore hasBODToday on app restart
export const checkTodaysSession = createAsyncThunk(
  'technician/checkTodaysSession',
  async (_, {rejectWithValue}) => {
    try {
      const response = await api.get('/api/jobs/session');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchTeamTasks = createAsyncThunk(
  'technician/fetchTeamTasks',
  async (_, {rejectWithValue}) => {
    try {
      const response = await api.get('/api/jobs/today');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchTeamMembers = createAsyncThunk(
  'technician/fetchTeamMembers',
  async (_, {rejectWithValue}) => {
    try {
      const response = await api.get('/api/team/members');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchTeamStats = createAsyncThunk(
  'technician/fetchTeamStats',
  async (_, {rejectWithValue}) => {
    try {
      const response = await api.get('/api/team/stats');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchTeamKPI = createAsyncThunk(
  'technician/fetchTeamKPI',
  async (period: string, {rejectWithValue}) => {
    try {
      const response = await api.get(
        `/api/kpi/team?period=${period}`,
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchTargets = createAsyncThunk(
  'technician/fetchTargets',
  async (_, {rejectWithValue}) => {
    try {
      const response = await api.get('/api/kpi/targets/my-targets');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchPaymentHistory = createAsyncThunk(
  'technician/fetchPaymentHistory',
  async (_, {rejectWithValue}) => {
    try {
      const response = await api.get('/api/payments/my');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchPaymentById = createAsyncThunk(
  'technician/fetchPaymentById',
  async (id: string, {rejectWithValue}) => {
    try {
      const response = await api.get(`/api/payments/${id}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const updateTaskStatus = createAsyncThunk(
  'technician/updateTaskStatus',
  async (
    {id, status, reason}: {id: string; status: string; reason?: string},
    {rejectWithValue},
  ) => {
    try {
      const response = await api.patch(`/api/jobs/${id}/status`, {
        status,
        ...(reason ? {reason} : {}),
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const submitBODCheckIn = createAsyncThunk(
  'technician/bodCheckIn',
  async (
    data: {latitude: number; longitude: number; address: string},
    {rejectWithValue},
  ) => {
    try {
      const response = await api.post(
        '/api/attendance/check-in',
        data,
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const submitEODCheckOut = createAsyncThunk(
  'technician/eodCheckOut',
  async (
    data: {latitude: number; longitude: number; address: string},
    {rejectWithValue},
  ) => {
    try {
      const response = await api.post(
        '/api/attendance/check-out',
        data,
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const assignTask = createAsyncThunk(
  'technician/assignTask',
  async (
    {id, technicianId}: {id: string; technicianId: string},
    {rejectWithValue},
  ) => {
    try {
      const response = await api.post(`/api/jobs/${id}/reassign`, {
        newTechnicianId: technicianId,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || error.message,
      );
    }
  },
);

export const performBOD = createAsyncThunk(
  'technician/performBOD',
  async (
    data: {
      vehicleId?: number | null;
      odometerStart?: number | null;
      latitude: number;
      longitude: number;
      locationAddress: string;
      technicianIds: number[];
    },
    {rejectWithValue},
  ) => {
    try {
      const response = await api.post('/api/jobs/bod', data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || error.message,
      );
    }
  },
);

export const fetchMyFaults = createAsyncThunk(
  'technician/fetchMyFaults',
  async (_, {rejectWithValue}) => {
    try {
      const response = await api.get('/api/faults/my');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const submitMaterialRequest = createAsyncThunk(
  'technician/submitMaterialRequest',
  async (
    data: {
      taskId: string;
      materials: {materialId: string; quantity: number}[];
      notes: string;
    },
    {rejectWithValue},
  ) => {
    try {
      const response = await api.post(
        '/api/inventory/material-request',
        data,
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

// Maps backend Job entity fields to the frontend Task shape
const normalizeJob = (job: any): any => ({
  id: String(job.id ?? ''),
  jobNumber: job.jobNumber,
  issueId: String(job.faultId ?? job.issueId ?? ''),
  faultNumber: job.faultNumber,
  technicianId: String(job.technicianId ?? ''),
  technicianName: job.technicianName,
  teamLeadId: String(job.teamLeadId ?? ''),
  customerName: job.customerName,
  customerPhone: job.customerPhone,
  category: job.category,
  description: job.description,
  status: (job.status ?? 'PENDING').toLowerCase() as any,
  priority: job.priority,
  scheduledDate: job.scheduledDate ?? '',
  estimatedDuration: job.laborHours ?? 0,
  location: {
    address: job.locationAddress ?? '',
    latitude: job.latitude ?? 0,
    longitude: job.longitude ?? 0,
  },
  notes: job.workNotes ?? job.description,
  causeOfFault: job.causeOfFault,
  completionRemarks: job.completionRemarks,
  completedAt: job.completedAt,
  acceptedAt: job.acceptedAt,
  startedAt: job.startedAt,
  rejectionReason: job.rejectionReason,
  rejectedByRole: job.rejectedByRole,
});

const technicianSlice = createSlice({
  name: 'technician',
  initialState,
  reducers: {
    setCurrentLocation: (state, action) => {
      state.currentLocation = action.payload;
    },
    clearSelectedTask: state => {
      state.selectedTask = null;
    },
    clearSelectedPayment: state => {
      state.selectedPayment = null;
    },
    clearError: state => {
      state.error = null;
    },
    setBODCheckIn: (state, action) => {
      state.bodCheckIn = action.payload;
    },
    setHasBODToday: (state, action) => {
      state.hasBODToday = action.payload;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchTasks.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchTasks.fulfilled, (state, action) => {
      state.isLoading = false;
      state.tasks = action.payload.map(normalizeJob);
    });
    builder.addCase(fetchTasks.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(fetchTeamTasks.fulfilled, (state, action) => {
      state.tasks = action.payload.map(normalizeJob);
    });
    builder.addCase(fetchTeamMembers.fulfilled, (state, action) => {
      state.teamMembers = action.payload;
    });
    builder.addCase(fetchTeamStats.fulfilled, (state, action) => {
      state.teamStats = action.payload;
    });
    builder.addCase(fetchTeamKPI.pending, state => {
      state.isLoading = true;
    });
    builder.addCase(fetchTeamKPI.fulfilled, (state, action) => {
      state.isLoading = false;
      state.teamKPI = action.payload;
    });
    builder.addCase(fetchTeamKPI.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(fetchTargets.fulfilled, (state, action) => {
      state.targets = action.payload;
    });
    builder.addCase(fetchPaymentHistory.pending, state => {
      state.isLoading = true;
    });
    builder.addCase(
      fetchPaymentHistory.fulfilled,
      (state, action) => {
        state.isLoading = false;
        state.paymentHistory = action.payload;
      },
    );
    builder.addCase(fetchPaymentHistory.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(fetchPaymentById.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchPaymentById.fulfilled, (state, action) => {
      state.isLoading = false;
      state.selectedPayment = action.payload;
    });
    builder.addCase(fetchPaymentById.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(updateTaskStatus.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(updateTaskStatus.fulfilled, (state, action) => {
      state.isLoading = false;
      const normalized = normalizeJob(action.payload);
      const index = state.tasks.findIndex(t => t.id === normalized.id);
      if (index !== -1) {
        state.tasks[index] = normalized;
      }
    });
    builder.addCase(updateTaskStatus.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(assignTask.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(assignTask.fulfilled, (state, action) => {
      state.isLoading = false;
      const normalized = normalizeJob(action.payload);
      const index = state.tasks.findIndex(t => t.id === normalized.id);
      if (index !== -1) {
        state.tasks[index] = normalized;
      }
    });
    builder.addCase(assignTask.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(submitBODCheckIn.pending, state => {
      state.isLoading = true;
    });
    builder.addCase(submitBODCheckIn.fulfilled, (state, action) => {
      state.isLoading = false;
      state.bodCheckIn = action.payload;
    });
    builder.addCase(submitBODCheckIn.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(submitEODCheckOut.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(submitEODCheckOut.fulfilled, state => {
      state.isLoading = false;
      state.bodCheckIn = null;
    });
    builder.addCase(submitEODCheckOut.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(performBOD.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(performBOD.fulfilled, state => {
      state.isLoading = false;
      state.hasBODToday = true;
    });
    builder.addCase(performBOD.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(checkTodaysSession.fulfilled, state => {
      state.hasBODToday = true;
    });
    builder.addCase(checkTodaysSession.rejected, state => {
      state.hasBODToday = false;
    });
    builder.addCase(fetchMyFaults.fulfilled, (state, action) => {
      state.faults = action.payload;
    });
    builder.addCase(submitMaterialRequest.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(submitMaterialRequest.fulfilled, state => {
      state.isLoading = false;
    });
    builder.addCase(submitMaterialRequest.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
  },
});

export const {
  setCurrentLocation,
  clearSelectedTask,
  clearSelectedPayment,
  clearError,
  setBODCheckIn,
  setHasBODToday,
} = technicianSlice.actions;
export default technicianSlice.reducer;