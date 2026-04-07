import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {IssueState, Issue} from '@appTypes/issue.types';
import issueService from '@services/issueService';

const initialState: IssueState = {
  issues: [],
  selectedIssue: null,
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

const issueSlice = createSlice({
  name: 'issues',
  initialState,
  reducers: {
    clearSelectedIssue: state => {
      state.selectedIssue = null;
    },
    clearError: state => {
      state.error = null;
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
    builder.addCase(fetchIssueById.fulfilled, (state, action) => {
      state.selectedIssue = action.payload;
    });
    builder.addCase(createIssue.fulfilled, (state, action) => {
      state.issues.unshift(action.payload);
    });
  },
});

export const {clearSelectedIssue, clearError} = issueSlice.actions;
export default issueSlice.reducer;