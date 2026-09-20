import client from './client';

export const getSales = (params) => {
  return client.get('/sales/', { params });
};

export const getSaleSummary = (params) => {
  return client.get('/sales/summary/', { params });
};

export const getSale = (id) => {
  return client.get(`/sales/${id}/`);
};

export const createSale = (data) => {
  return client.post('/sales/create/', data);
};

export const updateSale = (id, data) => {
  return client.patch(`/sales/${id}/update/`, data);
};

export const archiveSale = (id) => {
  return client.post(`/sales/${id}/archive/`);
};
