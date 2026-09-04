import api from './api';
import {Task, ShortestPathResult, MaterialRequestSummary} from '@appTypes/technician.types';

const technicianService = {
  getTasks: async (): Promise<Task[]> => {
    const response = await api.get('/api/jobs/my');
    return response.data;
  },

  getTaskById: async (id: string): Promise<Task> => {
    const response = await api.get(`/api/jobs/${id}`);
    return response.data;
  },

  updateTaskStatus: async (id: string, status: string): Promise<Task> => {
    const response = await api.patch(`/api/jobs/${id}/status`, {
      status,
    });
    return response.data;
  },

  markArrived: async (id: string): Promise<Task> => {
    const response = await api.post(`/api/jobs/${id}/arrived`);
    return response.data;
  },

  updateLocation: async (
    latitude: number,
    longitude: number,
  ): Promise<void> => {
    await api.post('/api/location/update', {latitude, longitude});
  },

  // FR-29 (SRS 5.6.6) — proxied via fieldops (LocationController ->
  // LocationService.getShortestPathToFault) to the Flask AI module's
  // POST /api/ai/shortest-path, since the mobile app has no direct network
  // path to that service. See ShortestPathResult for the routed:false /
  // Haversine-fallback semantics the UI must honour.
  getShortestPath: async (
    currentLat: number,
    currentLng: number,
    faultLat: number,
    faultLng: number,
  ): Promise<ShortestPathResult> => {
    const response = await api.post('/api/location/shortest-path', {
      currentLat,
      currentLng,
      faultLat,
      faultLng,
    });
    return response.data;
  },

  // GET /api/inventory/materials/search — technician-facing inventory browser
  // (InventoryController.searchMaterials). categoryId is a real Material
  // category ID; omit it and filter client-side by the category strings the
  // server returns when the caller doesn't have IDs on hand.
  searchMaterials: async (search?: string, categoryId?: number): Promise<any[]> => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (categoryId != null) params.categoryId = String(categoryId);
    const response = await api.get('/api/inventory/materials/search', {params});
    return response.data;
  },

  submitMaterials: async (
    taskId: string,
    materials: any[],
  ): Promise<void> => {
    for (const m of materials) {
      await api.post(`/api/jobs/${taskId}/materials`, {
        materialId:   m.materialId,
        quantityUsed: m.quantityUsed ?? m.quantity,
        chargeType:   m.chargeType,
        justification: m.justification,
      });
    }
  },

  submitSignature: async (
    taskId: string,
    signature: string,
  ): Promise<void> => {
    await api.post(`/api/jobs/${taskId}/signature`, {signature});
  },

  // GET /api/inventory/material-requests/my — used by the Material-Delay
  // rejection path (SRS 5.3.1.2) to list the Technician's own still-outstanding
  // requests. Only returns requests submitted under the caller's own account —
  // one submitted by a Team Lead on the Technician's behalf won't appear here,
  // since the endpoint filters by requesterId server-side, not by job.
  getMyOutstandingMaterialRequests: async (): Promise<MaterialRequestSummary[]> => {
    const response = await api.get('/api/inventory/material-requests/my');
    const requests = response.data?.requests ?? [];
    return requests.filter(
      (r: MaterialRequestSummary) => r.status === 'PENDING' || r.status === 'APPROVED',
    );
  },
};

export default technicianService;
