import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {
  IssueState,
  Issue,
  Bill,
  TechnicianLocation,
} from '@appTypes/issue.types';
import issueService from '@services/issueService';

const initialState: IssueState = {
  issues: [],
  selectedIssue: null,
  bills: [],
  selectedBill: null,
  technicianLocation: null,
  isLoading: false,
  error: null,
};

export const fetchIssues = createAsyncThunk(
  'issues/fetchAll',
  async (_, {rejectWithValue}) => {
    try {
      const response = await issueService.getIssues();
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchIssueById = createAsyncThunk(
  'issues/fetchById',
  async (id: string, {rejectWithValue}) => {
    try {
      const response = await issueService.getIssueById(id);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const createIssue = createAsyncThunk(
  'issues/create',
  async (data: Partial<Issue>, {rejectWithValue}) => {
    try {
      const response = await issueService.createIssue(data);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const cancelIssue = createAsyncThunk(
  'issues/cancel',
  async (
    {id, reason}: {id: string; reason: string},
    {rejectWithValue},
  ) => {
    try {
      await issueService.cancelIssue(id, reason);
      return id;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || error.message || 'Failed to cancel issue',
      );
    }
  },
);

export const fetchBills = createAsyncThunk(
  'issues/fetchBills',
  async (_, {rejectWithValue}) => {
    try {
      const response = await issueService.getBills();
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchBillById = createAsyncThunk(
  'issues/fetchBillById',
  async (id: string, {rejectWithValue}) => {
    try {
      const response = await issueService.getBillById(id);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

// FR-31: accept a bill, then re-fetch it so selectedBill carries the correct ClientBillDTO
// shape (the accept POST returns the raw Payment entity, not the DTO the screen renders).
export const acceptBill = createAsyncThunk(
  'issues/acceptBill',
  async (id: string, {rejectWithValue}) => {
    try {
      await issueService.acceptBill(id);
      return await issueService.getBillById(id);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || error.message || 'Failed to accept bill',
      );
    }
  },
);

// FR-31: report an issue on a bill (category + mandatory description + optional photo), then
// re-fetch so selectedBill reflects the new DISPUTED status in ClientBillDTO shape.
export const reportBillDispute = createAsyncThunk(
  'issues/reportBillDispute',
  async (
    {
      id,
      category,
      description,
      photoUri,
    }: {id: string; category: string; description: string; photoUri?: string},
    {rejectWithValue},
  ) => {
    try {
      await issueService.reportBillDispute(id, {category, description, photoUri});
      return await issueService.getBillById(id);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || error.message || 'Failed to report issue',
      );
    }
  },
);

export const fetchTechnicianLocation = createAsyncThunk(
  'issues/fetchTechnicianLocation',
  async (issueId: string, {rejectWithValue}) => {
    try {
      const response = await issueService.getTechnicianLocation(issueId);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

const issueSlice = createSlice({
  name: 'issues',
  initialState,
  reducers: {
    clearSelectedIssue: state => {
      state.selectedIssue = null;
    },
    clearSelectedBill: state => {
      state.selectedBill = null;
    },
    clearTechnicianLocation: state => {
      state.technicianLocation = null;
    },
    clearError: state => {
      state.error = null;
    },
    updateTechnicianLocation: (state, action) => {
      state.technicianLocation = action.payload;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchIssues.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchIssues.fulfilled, (state, action) => {
      state.isLoading = false;
      state.issues = action.payload;
    });
    builder.addCase(fetchIssues.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(fetchIssueById.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchIssueById.fulfilled, (state, action) => {
      state.isLoading = false;
      state.selectedIssue = action.payload;
    });
    builder.addCase(fetchIssueById.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(createIssue.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(createIssue.fulfilled, (state, action) => {
      state.isLoading = false;
      state.issues.unshift(action.payload);
    });
    builder.addCase(createIssue.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(cancelIssue.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(cancelIssue.fulfilled, (state, action) => {
      state.isLoading = false;
      const index = state.issues.findIndex(i => i.id === action.payload);
      if (index !== -1) {
        state.issues[index].status = 'cancelled';
      }
      if (state.selectedIssue?.id === action.payload) {
        state.selectedIssue.status = 'cancelled';
      }
    });
    builder.addCase(cancelIssue.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(fetchBills.pending, state => {
      state.isLoading = true;
    });
    builder.addCase(fetchBills.fulfilled, (state, action) => {
      state.isLoading = false;
      state.bills = action.payload;
    });
    builder.addCase(fetchBills.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(fetchBillById.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchBillById.fulfilled, (state, action) => {
      state.isLoading = false;
      state.selectedBill = action.payload;
    });
    builder.addCase(fetchBillById.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    // acceptBill / reportBillDispute both resolve to the refreshed bill (ClientBillDTO). Reflect
    // the new status on the selected bill and, if present, its entry in the cached list.
    const applyUpdatedBill = (state: IssueState, bill: Bill) => {
      state.isLoading = false;
      state.selectedBill = bill;
      const index = state.bills.findIndex(b => b.id === bill.id);
      if (index !== -1) {
        state.bills[index] = bill;
      }
    };
    builder.addCase(acceptBill.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(acceptBill.fulfilled, (state, action) => {
      applyUpdatedBill(state, action.payload);
    });
    builder.addCase(acceptBill.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(reportBillDispute.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(reportBillDispute.fulfilled, (state, action) => {
      applyUpdatedBill(state, action.payload);
    });
    builder.addCase(reportBillDispute.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(fetchTechnicianLocation.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchTechnicianLocation.fulfilled, (state, action) => {
      state.isLoading = false;
      state.technicianLocation = action.payload;
    });
    builder.addCase(fetchTechnicianLocation.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
  },
});

export const {
  clearSelectedIssue,
  clearSelectedBill,
  clearTechnicianLocation,
  clearError,
  updateTechnicianLocation,
} = issueSlice.actions;
export default issueSlice.reducer;