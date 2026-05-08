export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'travelling'
  | 'in_progress'
  | 'hold'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type PaymentStatus =
  | 'DRAFT'
  | 'FINAL'
  | 'NOT_APPROVED';

export interface Task {
  id: string;
  issueId: string;
  technicianId: string;
  technicianName?: string;
  customerName?: string;
  category?: string;
  status: TaskStatus;
  priority?: TaskPriority;
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
  rejectionReason?: string;
  rejectedByRole?: string;
  jobNumber?: string;
  faultNumber?: string;
  teamLeadId?: string;
  customerPhone?: string;
  description?: string;
  causeOfFault?: string;
  completionRemarks?: string;
  completedAt?: string;
  acceptedAt?: string;
  startedAt?: string;
}

export interface Material {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  type?: 'FOC' | 'CHARGEABLE';
  subtotal?: number;
}

export interface PaymentMaterial {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  type: 'FOC' | 'CHARGEABLE';
  subtotal: number;
}

export interface LaborDetails {
  startTime: string;
  endTime: string;
  totalHours: number;
  hourlyRate: number;
  laborCharges: number;
  type: 'FOC' | 'CHARGEABLE';
}

export interface PaymentSubmission {
  taskId: string;
  materials: PaymentMaterial[];
  labor: LaborDetails;
  justification: string;
  justificationPhotos: string[];
  customerName: string;
  customerSignature: string;
  customerAgreed: boolean;
  materialsFOC: number;
  materialsChargeable: number;
  laborCharges: number;
  totalFOC: number;
  totalChargeable: number;
  grandTotal: number;
}

export interface PaymentHistoryItem {
  id: string;
  taskId: string;
  customerName: string;
  submittedAt: string;
  reviewedAt?: string;
  status: PaymentStatus;
  materialsFOC: number;
  materialsChargeable: number;
  laborCharges: number;
  totalFOC: number;
  totalChargeable: number;
  grandTotal: number;
  adminNotes?: string;
  materials: PaymentMaterial[];
  labor: LaborDetails;
  justification: string;
  category?: string;
  address?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  fullName?: string;
  username?: string;
  phone: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
  currentJobId?: string;
  currentJobStatus?: TaskStatus;
  location?: {
    latitude: number;
    longitude: number;
    lastUpdated: string;
  };
  completedToday: number;
  totalJobs: number;
  avgTime: number;
}

export interface TeamStats {
  totalJobs: number;
  inProgress: number;
  completed: number;
  avgTime: number;
  completionRate: number;
}

export interface Target {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  category: 'JOBS' | 'TIME' | 'SATISFACTION' | 'REVENUE';
  assignedBy: string;
  dueDate: string;
  status: 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'ACHIEVED';
}

export interface TechnicianKPI {
  technicianId: string;
  technicianName: string;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  totalJobs: number;
  completedJobs: number;
  completionRate: number;
  avgResponseTime: number;
  avgJobDuration: number;
  customerSatisfaction: number;
  onTimeCompletion: number;
  targets: Target[];
}

export interface TeamKPI {
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  totalJobs: number;
  completedJobs: number;
  completionRate: number;
  avgResponseTime: number;
  avgJobDuration: number;
  customerSatisfaction: number;
  revenue: number;
  technicianKPIs: TechnicianKPI[];
}

export interface BODCheckIn {
  id: string;
  userId: string;
  checkInTime: string;
  checkOutTime?: string;
  latitude: number;
  longitude: number;
  address: string;
}

export interface TechnicianState {
  tasks: Task[];
  selectedTask: Task | null;
  teamMembers: TeamMember[];
  teamStats: TeamStats | null;
  teamKPI: TeamKPI | null;
  targets: Target[];
  paymentHistory: PaymentHistoryItem[];
  selectedPayment: PaymentHistoryItem | null;
  bodCheckIn: BODCheckIn | null;
  hasBODToday: boolean;
  faults: any[];
  currentLocation: {
    latitude: number;
    longitude: number;
  } | null;
  isLoading: boolean;
  error: string | null;
}