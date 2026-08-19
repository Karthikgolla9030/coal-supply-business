import api from './client';

export const getDashboardSummary = () => {
  return api.get('/dashboard/');
};
