import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {TechnicianState, Task} from '@appTypes/technician.types';
import technicianService from '@services/technicianService';

const initialState: TechnicianState = {
  tasks: [],
  selectedTask: null,
  currentLocation: null,
  isLoading: false,
  error: null,
};

export const fetchTasks = createAsyncThunk(
  'technician/fetchTasks',
  async (_, {rejectWithValue}) => {
    try {
      const response = await technicianService.getTasks();
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const updateTaskStatus = createAsyncThunk(
  'technician/updateStatus',
  async (
    {taskId, status}: {taskId: string; status: string},
    {rejectWithValue},
  ) => {
    try {
      const response = await technicianService.updateTaskStatus(
        taskId,
        status,
      );
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

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
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchTasks.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchTasks.fulfilled, (state, action) => {
      state.isLoading = false;
      state.tasks = action.payload;
    });
    builder.addCase(fetchTasks.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    builder.addCase(updateTaskStatus.fulfilled, (state, action) => {
      const index = state.tasks.findIndex(t => t.id === action.payload.id);
      if (index !== -1) {
        state.tasks[index] = action.payload;
      }
      state.selectedTask = action.payload;
    });
  },
});

export const {setCurrentLocation, clearSelectedTask, clearError} =
  technicianSlice.actions;
export default technicianSlice.reducer;