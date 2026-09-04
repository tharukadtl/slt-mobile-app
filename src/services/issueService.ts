import api from './api';
import uploadService from './uploadService';
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
    case 'FIBER': return 'fiber';
    case 'TV': return 'television';
    default: return 'other';
  }
};

// FaultDTO.photoUrls is a comma-separated string (see FaultService.joinPhotoUrls), not an array.
const parsePhotoUrls = (v?: string): string[] =>
  (v ?? '').split(',').map(s => s.trim()).filter(Boolean);

// Converts a FaultDTO from the backend into the frontend Issue shape
const normalizeFault = (f: any): Issue => ({
  id: String(f.id ?? ''),
  faultNumber: f.faultNumber,
  title: f.faultNumber ?? `Fault #${f.id}`,
  description: f.description ?? '',
  category: normalizeCategory(f.category),
  status: normalizeStatus(f.status),
  clientId: String(f.customerId ?? ''),
  photos: parsePhotoUrls(f.photoUrls),
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

  createIssue: async (data: Partial<Issue> & {opmcId?: number}): Promise<Issue> => {
    // Photos are uploaded separately (POST /api/uploads/photos) and the
    // resulting URLs are referenced on the fault report, per
    // ReportFaultRequest.photoUrls (max 5, JPEG/PNG only — enforced server-side).
    const photoUrls = data.photos && data.photos.length > 0
      ? await uploadService.uploadPhotos(data.photos)
      : undefined;

    const payload = {
      category: (data.category ?? 'other').toUpperCase(),
      description: data.description,
      locationAddress: data.location?.address,
      latitude: data.location?.latitude,
      longitude: data.location?.longitude,
      opmcId: data.opmcId ?? 1,
      ...(photoUrls ? {photoUrls} : {}),
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
    // Client single-bill fetch must use the ClientBillDTO-shaped, CLIENT-scoped endpoint —
    // the general /api/payments/{id} returns the raw Payment entity and is ADMIN/TEAM_LEAD only.
    // This mirrors getBills() (/api/payments/my-bills) so the list and detail share one shape.
    const response = await api.get(`/api/payments/my-bills/${id}`);
    return response.data;
  },

  // FR-31: client accepts a bill, closing the dispute/amendment cycle. The POST returns the raw
  // Payment entity, so callers should re-fetch via getBillById to get the ClientBillDTO shape.
  acceptBill: async (id: string): Promise<void> => {
    await api.post(`/api/billing/${id}/accept`);
  },

  // FR-31: client reports an issue on a bill. An optional photo (local device URI) is uploaded
  // first via the shared uploads endpoint; the backend's disputePhotoUrl expects a single URL.
  reportBillDispute: async (
    id: string,
    data: {category: string; description: string; photoUri?: string},
  ): Promise<void> => {
    let photoUrl: string | undefined;
    if (data.photoUri) {
      const urls = await uploadService.uploadPhotos([data.photoUri]);
      photoUrl = urls[0];
    }
    await api.post(`/api/billing/${id}/dispute`, {
      category: data.category,
      description: data.description,
      ...(photoUrl ? {photoUrl} : {}),
    });
  },

  getTechnicianLocation: async (issueId: string): Promise<TechnicianLocation> => {
    const response = await api.get(`/api/issues/${issueId}/technician-location`);
    return response.data;
  },
};

export default issueService;
