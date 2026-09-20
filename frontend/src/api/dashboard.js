import api from './client';

export const getDashboardSummary = () => {
  return api.get('/dashboard/');
};

export const getBusinessDashboard = (params) => {
  return api.get('/business-dashboard/', { params });
};
