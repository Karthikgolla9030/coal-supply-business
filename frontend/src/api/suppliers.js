import client from './client';

export const getSuppliers = (params) => {
  return client.get('/suppliers/', { params });
};

export const getSupplier = (id) => {
  return client.get(`/suppliers/${id}/`);
};

export const createSupplier = (data) => {
  return client.post('/suppliers/create/', data);
};

export const updateSupplier = (id, data) => {
  return client.patch(`/suppliers/${id}/update/`, data);
};

export const deactivateSupplier = (id) => {
  return client.post(`/suppliers/${id}/deactivate/`);
};

export const reactivateSupplier = (id) => {
  return client.post(`/suppliers/${id}/reactivate/`);
};

export const getSupplierPurchaseSummary = (id) => {
  return client.get(`/suppliers/${id}/purchase-summary/`);
};
