import client from './client';

export const getPurchases = (params) => {
  return client.get('/purchases/', { params });
};

export const getPurchaseSummary = (params) => {
  return client.get('/purchases/summary/', { params });
};

export const getPurchase = (id) => {
  return client.get(`/purchases/${id}/`);
};

export const createPurchase = (data) => {
  return client.post('/purchases/create/', data);
};

export const updatePurchase = (id, data) => {
  return client.patch(`/purchases/${id}/update/`, data);
};

export const archivePurchase = (id) => {
  return client.post(`/purchases/${id}/archive/`);
};
