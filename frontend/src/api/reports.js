import api from './client';

export const getBusinessReport = (params) => {
  return api.get('/business-reports/', { params });
};

export const downloadBusinessReport = (params) => {
  return api.get('/business-reports/', { 
    params,
    responseType: 'blob' 
  });
};
