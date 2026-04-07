export type TaskStatus =
  | 'assigned'
  | 'accepted'
  | 'travelling'
  | 'in_progress'
  | 'completed';

export interface Task {
  id: string;
  issueId: string;
  technicianId: string;
  status: TaskStatus;
  scheduledDate: string;
  estimatedDuration: number;
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  materials?: Material[];
  customerSignature?: string;
  notes?: string;
}

export interface Material {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface TechnicianState {
  tasks: Task[];
  selectedTask: Task | null;
  currentLocation: {
    latitude: number;
    longitude: number;
  } | null;
  isLoading: boolean;
  error: string | null;
}