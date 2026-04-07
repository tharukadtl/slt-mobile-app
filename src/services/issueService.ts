import api from './api';
import {Issue} from '@appTypes/issue.types';

const issueService = {
  getIssues: async (): Promise<Issue[]> => {
    const response = await api.get('/issues');
    return response.data;
  },

  getIssueById: async (id: string): Promise<Issue> => {
    const response = await api.get(`/issues/${id}`);
    return response.data;
  },

  createIssue: async (data: Partial<Issue>): Promise<Issue> => {
    const response = await api.post('/issues', data);
    return response.data;
  },

  updateIssue: async (id: string, data: Partial<Issue>): Promise<Issue> => {
    const response = await api.put(`/issues/${id}`, data);
    return response.data;
  },

  cancelIssue: async (id: string): Promise<void> => {
    await api.patch(`/issues/${id}/cancel`);
  },

  getIssueHistory: async (): Promise<Issue[]> => {
    const response = await api.get('/issues/history');
    return response.data;
  },
};

export default issueService;