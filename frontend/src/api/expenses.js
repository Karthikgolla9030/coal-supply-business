import client from './client';

export const getExpenses = (params) => {
  return client.get('/expenses/', { params });
};

export const getExpenseSummary = (params) => {
  return client.get('/expenses/summary/', { params });
};

export const getExpense = (id) => {
  return client.get(`/expenses/${id}/`);
};

export const createExpense = (data) => {
  return client.post('/expenses/', data);
};

export const updateExpense = (id, data) => {
  return client.patch(`/expenses/${id}/`, data);
};

export const archiveExpense = (id) => {
  return client.post(`/expenses/${id}/archive/`);
};
