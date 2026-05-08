import api from './api';
import {Issue, Bill, TechnicianLocation} from '@appTypes/issue.types';

// Maps backend FaultStatus (uppercase) to frontend IssueStatus (lowercase)
const normalizeStatus = (s?: string): Issue['status'] => {
  switch ((s ?? '').toUpperCase()) {
    case 'REPORTED': return 'pending';
    case 'ASSIGNED': return 'assigned';
    case 'IN_PROGRESS': return 'in_progress';
    case 'COMPLETED': return 'completed';
    case 'CANCELLED': return 'cancelled';
    default: return 'pending';
  }
};

// Maps backend FaultCategory to frontend IssueCategory
const normalizeCategory = (c?: string): Issue['category'] => {
  switch ((c ?? '').toUpperCase()) {
    case 'INTERNET': return 'broadband';
    case 'PHONE': return 'telephone';
    case 'TV': return 'television';
    default: return 'other';
  }
};

// Converts a FaultDTO from the backend into the frontend Issue shape
const normalizeFault = (f: any): Issue => ({
  id: String(f.id ?? ''),
  faultNumber: f.faultNumber,
  title: f.faultNumber ?? `Fault #${f.id}`,
  description: f.description ?? '',
  category: normalizeCategory(f.category),
  status: normalizeStatus(f.status),
  clientId: String(f.customerId ?? ''),
  location: {
    address: f.locationAddress ?? '',
    latitude: f.latitude ?? 0,
    longitude: f.longitude ?? 0,
  },
  createdAt: f.reportedAt ?? f.createdAt ?? '',
  updatedAt: f.updatedAt ?? '',
  completedAt: f.completedAt ?? undefined,
  causeOfFault: f.causeOfFault,
  completionRemarks: f.completionRemarks,
  assignedTeamLeadName: f.assignedTeamLeadName,
  priority: f.priority,
});

const issueService = {
  getIssues: async (): Promise<Issue[]> => {
    const response = await api.get('/api/faults/my-reports');
    return (response.data as any[]).map(normalizeFault);
  },

  getIssueById: async (id: string): Promise<Issue> => {
    const response = await api.get(`/api/faults/${id}`);
    return normalizeFault(response.data);
  },

  createIssue: async (data: Partial<Issue> & {branchId?: number}): Promise<Issue> => {
    const payload = {
      category: (data.category ?? 'other').toUpperCase(),
      description: data.description,
      locationAddress: data.location?.address,
      latitude: data.location?.latitude,
      longitude: data.location?.longitude,
      branchId: data.branchId ?? 1,
    };
    const response = await api.post('/api/faults', payload);
    return normalizeFault(response.data);
  },

  cancelIssue: async (id: string, reason: string): Promise<void> => {
    await api.patch(`/api/faults/${id}/cancel`, {reason});
  },

  getIssueHistory: async (): Promise<Issue[]> => {
    const response = await api.get('/api/faults/my-reports');
    return (response.data as any[])
      .map(normalizeFault)
      .filter(i => i.status === 'completed' || i.status === 'cancelled');
  },

  getBills: async (): Promise<Bill[]> => {
    const response = await api.get('/api/payments/my-bills');
    return response.data;
  },

  getBillById: async (id: string): Promise<Bill> => {
    const response = await api.get(`/api/payments/${id}`);
    return response.data;
  },

  getTechnicianLocation: async (issueId: string): Promise<TechnicianLocation> => {
    const response = await api.get(`/api/issues/${issueId}/technician-location`);
    return response.data;
  },
};

export default issueService;
