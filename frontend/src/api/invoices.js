import client from './client';

export const getInvoices = (params) =>
  client.get('/invoices/', { params });

export const createInvoice = (data) =>
  client.post('/invoices/create/', data);

export const getInvoice = (id) =>
  client.get(`/invoices/${id}/`);

export const downloadInvoicePdf = (id) =>
  client.get(`/invoices/${id}/pdf/`, { responseType: 'blob' });

export const uploadToGoogleDrive = (id) =>
  client.post(`/invoices/${id}/upload-to-drive/`);
