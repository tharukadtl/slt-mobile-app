import api from './api';
import {Task} from '@appTypes/technician.types';

const technicianService = {
  getTasks: async (): Promise<Task[]> => {
    const response = await api.get('/technician/tasks');
    return response.data;
  },

  getTaskById: async (id: string): Promise<Task> => {
    const response = await api.get(`/technician/tasks/${id}`);
    return response.data;
  },

  updateTaskStatus: async (id: string, status: string): Promise<Task> => {
    const response = await api.patch(`/technician/tasks/${id}/status`, {
      status,
    });
    return response.data;
  },

  updateLocation: async (
    latitude: number,
    longitude: number,
  ): Promise<void> => {
    await api.post('/technician/location', {latitude, longitude});
  },

  submitMaterials: async (
    taskId: string,
    materials: any[],
  ): Promise<void> => {
    await api.post(`/technician/tasks/${taskId}/materials`, {materials});
  },

  submitSignature: async (
    taskId: string,
    signature: string,
  ): Promise<void> => {
    await api.post(`/technician/tasks/${taskId}/signature`, {signature});
  },
};

export default technicianService;