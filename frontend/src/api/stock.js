import client from './client';

export const getStockSummary = (params) => {
  return client.get('/stock/summary/', { params });
};

export const getStockMovements = (params) => {
  return client.get('/stock/movements/', { params });
};
