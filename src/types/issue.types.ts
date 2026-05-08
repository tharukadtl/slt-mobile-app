export type IssueStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type IssueCategory =
  | 'broadband'
  | 'telephone'
  | 'fiber'
  | 'television'
  | 'other';

export interface Issue {
  id: string;
  faultNumber?: string;
  title: string;
  description: string;
  category: IssueCategory;
  status: IssueStatus;
  clientId: string;
  technicianId?: string;
  photos?: string[];
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  priority?: string;
  assignedTeamLeadName?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  causeOfFault?: string;
  completionRemarks?: string;
}

export interface TechnicianLocation {
  technicianId: string;
  technicianName: string;
  technicianPhone: string;
  latitude: number;
  longitude: number;
  eta: number;
  distance: string;
  lastUpdated: string;
}

export interface BillingItem {
  name: string;
  quantity: number;
  unitPrice: number;
  type: 'FOC' | 'CHARGEABLE';
  subtotal: number;
}

export interface Bill {
  id: string;
  issueId: string;
  issueTitle: string;
  technicianName: string;
  completedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  materials: BillingItem[];
  laborHours: number;
  laborRate: number;
  laborCharges: number;
  materialsFOC: number;
  materialsChargeable: number;
  totalChargeable: number;
  totalFOC: number;
  grandTotal: number;
}

export interface IssueState {
  issues: Issue[];
  selectedIssue: Issue | null;
  bills: Bill[];
  selectedBill: Bill | null;
  technicianLocation: TechnicianLocation | null;
  isLoading: boolean;
  error: string | null;
}