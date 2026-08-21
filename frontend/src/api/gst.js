import client from './client';

export const verifyGSTIN = (gstin) =>
  client.post('/gst/verify/', { gstin });
