import client from './client';

export const getCustomers = (params = {}) =>
  client.get('/customers/', { params });

export const createCustomer = (data) =>
  client.post('/customers/create/', data);

export const getCustomer = (id) =>
  client.get(`/customers/${id}/`);

export const updateCustomer = (id, data) =>
  client.patch(`/customers/${id}/update/`, data);

export const deactivateCustomer = (id) =>
  client.post(`/customers/${id}/deactivate/`);

export const reactivateCustomer = (id) =>
  client.post(`/customers/${id}/reactivate/`);
