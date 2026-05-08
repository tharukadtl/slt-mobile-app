import api from './api';
import {Task} from '@appTypes/technician.types';

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

  updateLocation: async (
    latitude: number,
    longitude: number,
  ): Promise<void> => {
    await api.post('/api/location/update', {latitude, longitude});
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
};

export default technicianService;
