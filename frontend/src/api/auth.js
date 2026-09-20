import client from './client';

/**
 * Send password reset request email.
 * Always resolves with generic message to avoid email enumeration.
 */
export const requestPasswordReset = (email) => {
  return client.post('/auth/forgot-password/', { email });
};

/**
 * Check if the reset token and uid are still valid.
 */
export const validateResetToken = (uid, token) => {
  return client.get('/auth/reset-password/validate/', {
    params: { uid, token },
  });
};

/**
 * Confirm password reset with new password.
 */
export const confirmPasswordReset = ({ uid, token, password, password_confirm }) => {
  return client.post('/auth/reset-password/', {
    uid,
    token,
    password,
    password_confirm,
  });
};
