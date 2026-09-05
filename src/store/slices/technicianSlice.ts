import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {
  TechnicianState,
  PaymentHistoryItem,
  TodayAttendance,
} from '@appTypes/technician.types';
import api from '@services/api';
import offlineQueue from '@services/offlineQueue';

// Marker returned by thunks whose payload was held on-device instead of being
// dropped, so screens can tell "saved, will send later" apart from "failed".
export const QUEUED_OFFLINE = 'QUEUED_OFFLINE';

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
  todaySessionStatus: null,
  todayAttendance: null,
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
    {
      id,
      status,
      reason,
      causeOfFault,
      completionRemarks,
      completionPhotoUrls,
      workNotes,
      rejectionCategory,
      observedIssueType,
      linkedMaterialRequestId,
      signatureDeclineReason,
    }: {
      id: string;
      status: string;
      reason?: string;
      causeOfFault?: string;
      completionRemarks?: string;
      completionPhotoUrls?: string;
      workNotes?: string;
      // SRS 5.3.1.2 — only meaningful when status is REJECTED.
      rejectionCategory?: 'ISSUE_MISMATCH' | 'MATERIAL_DELAY' | 'OTHER';
      observedIssueType?: string;
      linkedMaterialRequestId?: number;
      // SRS 5.3.1.3 (FR-9) — only meaningful when status is COMPLETED and the client was
      // unavailable/declined to sign. Routed through this same request rather than a
      // separate call — /signature is simply never called on this path.
      signatureDeclineReason?: string;
    },
    {rejectWithValue},
  ) => {
    const url = `/api/jobs/${id}/status`;
    const body = {
      status,
      ...(reason ? {reason} : {}),
      ...(causeOfFault ? {causeOfFault} : {}),
      ...(completionRemarks ? {completionRemarks} : {}),
      ...(completionPhotoUrls ? {completionPhotoUrls} : {}),
      ...(workNotes ? {workNotes} : {}),
      ...(rejectionCategory ? {rejectionCategory} : {}),
      ...(observedIssueType ? {observedIssueType} : {}),
      ...(linkedMaterialRequestId != null ? {linkedMaterialRequestId} : {}),
      ...(signatureDeclineReason ? {signatureDeclineReason} : {}),
    };
    try {
      const response = await api.patch(url, body);
      return response.data;
    } catch (error: any) {
      // No `error.response` means the request never reached the server
      // (offline, DNS failure, timeout). Dropping it here is what lost a
      // technician's job update made without signal — Critical #25 / JOB-016.
      // Hold it on-device for replay instead. A server that DID respond has
      // genuinely rejected the update; replaying that would fail identically,
      // so it still fails loudly.
      if (!error?.response) {
        try {
          await offlineQueue.enqueue({
            method: 'patch',
            url,
            body,
            label: `Job ${id} → ${status}`,
          });
          return rejectWithValue(
            `${QUEUED_OFFLINE}: No connection. This update is saved on your device and will be sent when you sync.`,
          );
        } catch {
          // Could not even persist it — say so rather than implying it is safe.
          return rejectWithValue(
            'No connection, and this update could not be saved on your device. Please retry.',
          );
        }
      }
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

// POST /api/jobs/{id}/arrived — technician marks arrival while TRAVELLING
// (server-side only valid from that status; sets Job.arrivedAt).
export const markArrived = createAsyncThunk(
  'technician/markArrived',
  async (id: string, {rejectWithValue}) => {
    try {
      const response = await api.post(`/api/jobs/${id}/arrived`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const submitBODCheckIn = createAsyncThunk(
  'technician/bodCheckIn',
  async (
    // latitude/longitude are nullable — when GPS is unavailable, callers
    // must send null, never a fake coordinate like (0,0), which the backend
    // (AttendanceDTO.CheckInRequest) would otherwise store as an
    // indistinguishable-from-real phantom location.
    data: {
      latitude: number | null;
      longitude: number | null;
      address: string;
      // ATT-008 — starting odometer reading, required client-side before
      // BOD check-in completes.
      odometerStart?: number;
    },
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
    // latitude/longitude are nullable for the same reason as submitBODCheckIn:
    // when GPS is unavailable, callers must send null, never a fake coordinate
    // like (0,0), which the backend (AttendanceDTO.CheckOutRequest) would
    // otherwise store as an indistinguishable-from-real phantom location.
    data: {
      latitude: number | null;
      longitude: number | null;
      address: string;
      // SRS 5.3.1.4 — one mandatory reason per job still open at checkout;
      // omitted entirely when there are none.
      openJobReasons?: {jobId: string; reason: string}[];
      // ATT-008 — ending odometer reading, required client-side before EOD
      // check-out completes. The response echoes back distanceKm once both
      // readings exist (AttendanceService.mapToResponse).
      odometerEnd?: number;
    },
    {rejectWithValue},
  ) => {
    try {
      const response = await api.post(
        '/api/attendance/check-out',
        data,
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

// Authoritative source for "has this technician already done BOD/EOD today" —
// scoped to the server's calendar date, unlike a locally-tracked variable
// which can't tell today's completed session from no session at all.
export const fetchTodayAttendance = createAsyncThunk(
  'technician/fetchTodayAttendance',
  async (_, {rejectWithValue}) => {
    try {
      const response = await api.get('/api/attendance/me/today');
      return response.data as TodayAttendance;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
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
      taskId?: string;
      faultId?: string;
      materials: {materialId: string; quantity: number}[];
      notes?: string;
      urgency?: 'NORMAL' | 'URGENT';
    },
    {rejectWithValue},
  ) => {
    try {
      // Backend's MaterialRequestDTO.SubmitRequest field is `items`, not
      // `materials` — this used to be sent as `materials` directly, which
      // Jackson silently drops (fail-on-unknown-properties: false), leaving
      // `items` null and every submission rejected with 400 "At least one
      // item is required". Remapped here at the API boundary rather than
      // renaming `materials` everywhere, so callers keep the clearer name.
      const response = await api.post('/api/inventory/material-request', {
        items: data.materials,
        taskId: data.taskId,
        faultId: data.faultId,
        notes: data.notes,
        urgency: data.urgency,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
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
  // SRS 5.3.1.2 / 5.3.1.4 — categorized-rejection and EOD-handover fields the
  // Team Lead "Needs Attention" queue reads (Major #6). The backend Job entity
  // carries these; without copying them here they were silently dropped, so no
  // screen could ever surface the escalation/handover context.
  rejectionCategory: job.rejectionCategory,
  observedIssueType: job.observedIssueType,
  linkedMaterialRequestId: job.linkedMaterialRequestId,
  linkedMaterialRequestNumber: job.linkedMaterialRequestNumber,
  eodHandoverReason: job.eodHandoverReason,
  eodHandoverAt: job.eodHandoverAt,
  travelStartedAt: job.travelStartedAt,
  arrivedAt: job.arrivedAt,
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
    builder.addCase(markArrived.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(markArrived.fulfilled, (state, action) => {
      state.isLoading = false;
      const normalized = normalizeJob(action.payload);
      const index = state.tasks.findIndex(t => t.id === normalized.id);
      if (index !== -1) {
        state.tasks[index] = normalized;
      }
    });
    builder.addCase(markArrived.rejected, (state, action) => {
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
    builder.addCase(checkTodaysSession.fulfilled, (state, action) => {
      state.hasBODToday = true;
      // GET /api/jobs/session returns today's session regardless of status
      // (ACTIVE or CLOSED) — keep it instead of discarding it, so the
      // dashboard can tell "day running" from "day over" (ATT-017).
      state.todaySessionStatus = action.payload?.status ?? null;
    });
    builder.addCase(checkTodaysSession.rejected, state => {
      state.hasBODToday = false;
      state.todaySessionStatus = null;
    });
    builder.addCase(fetchTodayAttendance.fulfilled, (state, action) => {
      state.todayAttendance = action.payload;
    });
    builder.addCase(fetchTodayAttendance.rejected, state => {
      state.todayAttendance = null;
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