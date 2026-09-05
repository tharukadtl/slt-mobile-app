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

// Mirrors the backend's Payment.PaymentStatus enum (fieldops) exactly —
// DRAFT/FINAL/NOT_APPROVED are the admin-review outcomes; the other 4 are
// the bill dispute/amendment cycle (SRS 5.5.2.1).
export type PaymentStatus =
  | 'DRAFT'
  | 'FINAL'
  | 'NOT_APPROVED'
  | 'CLARIFICATION_REQUESTED'
  | 'DISPUTED'
  | 'PENDING_CLIENT_REVIEW'
  | 'CLIENT_ACCEPTED';

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
  // SRS 5.3.1.2 — categorized rejection (issue mismatch / material delay /
  // other). All optional: a job rejected before this feature shipped, or by
  // a caller that doesn't send them, simply has no category.
  rejectionCategory?: 'ISSUE_MISMATCH' | 'MATERIAL_DELAY' | 'OTHER';
  observedIssueType?: 'INTERNET' | 'PHONE' | 'FIBER' | 'TV' | 'OTHER';
  linkedMaterialRequestId?: number;
  linkedMaterialRequestNumber?: string;
  // SRS 5.3.1.4 — set when a Technician's shift ended with this job still
  // open; this is the data shape the future Team Lead pending/escalation
  // queue (Major finding #6) will read to show why. Not consumed anywhere
  // yet — added now so that later work doesn't need a data-shape migration.
  eodHandoverReason?: string;
  eodHandoverAt?: string;
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

// Mirrors the fields this app actually reads from backend's
// MaterialRequestDTO.RequestResponse (InventoryController's
// GET /api/inventory/material-requests/my) — used by the Material-Delay
// rejection path (SRS 5.3.1.2) to let the Technician link an outstanding
// request instead of typing free text.
export interface MaterialRequestSummary {
  id: number;
  requestNumber: string;
  taskId?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELIVERED' | 'CANCELLED';
  totalItems: number;
  submittedTimeAgo?: string;
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
  latitude: number | null;
  longitude: number | null;
  address: string;
}

// Mirrors backend AttendanceDTO.TodaySummaryDTO — always scoped to the
// server's current calendar date, so it's the source of truth for whether
// BOD/EOD has already happened today (a local-only flag can't tell that).
export interface TodayAttendance {
  isCheckedIn: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  currentStatus: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT';
  date: string;
}

// Mirrors the backend's ShortestPathResponseDTO (fieldops), which itself
// mirrors the Flask AI module's POST /api/ai/shortest-path response
// (FR-29, SRS 5.6.6). routed=false means this is a Haversine straight-line
// estimate, not a real routed path — the AI module has no road-network
// graph data source configured yet. UI must not present it as a real route.
export interface ShortestPathWaypoint {
  lat: number;
  lng: number;
}

export interface ShortestPathResult {
  waypoints: ShortestPathWaypoint[];
  distanceKm: number;
  etaMinutes: number;
  routed: boolean;
  algorithm: string;
  avgSpeedKmh: number;
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
  // ATT-017 — distinguishes "BOD done, day running" (ACTIVE) from "BOD and
  // EOD both done" (CLOSED); hasBODToday alone can't tell these apart since
  // it stays true after EOD (by design — it's what stops a second BOD).
  todaySessionStatus: 'ACTIVE' | 'CLOSED' | null;
  todayAttendance: TodayAttendance | null;
  faults: any[];
  currentLocation: {
    latitude: number;
    longitude: number;
  } | null;
  isLoading: boolean;
  error: string | null;
}