import client from './client';

export const getCustomers = (params = {}) =>
  client.get('/customers/', { params });

export const createCustomer = (data) =>
  client.post('/customers/create/', data);

export const getCustomer = (id) =>
  client.get(`/customers/${id}/`);

export const updateCustomer = (id, data) =>
  client.patch(`/customers/${id}/update/`, data);

export const deactivateCustomer = (id) => {
  return client.post(`/customers/${id}/deactivate/`);
};

export const reactivateCustomer = (id) => {
  return client.post(`/customers/${id}/reactivate/`);
};

export const getCustomerSaleSummary = (id) => {
  return client.get(`/customers/${id}/sale-summary/`);
};

export const getCustomerLedgerHistory = (id) =>
  client.get(`/customers/${id}/ledger-history/`);
