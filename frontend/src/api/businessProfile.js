import client from './client';

export const getBusinessProfile = () =>
  client.get('/business-profile/');

export const createBusinessProfile = (data) =>
  client.post('/business-profile/create/', data);

export const updateBusinessProfile = (data) =>
  client.patch('/business-profile/update/', data);

/**
 * Convenience: create if none exists, update if one does.
 * The component decides which to call based on whether a profile was loaded.
 */
export const saveBusinessProfile = (data, exists) =>
  exists ? updateBusinessProfile(data) : createBusinessProfile(data);
