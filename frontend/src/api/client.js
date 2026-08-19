import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,  // send session cookies for Django auth
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach token
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: normalise error shapes and handle 401
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If it's a 401 Unauthorized and not a retry yet, and we have a refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      // If we are already trying to hit /auth/refresh/, don't loop
      if (refreshToken && !originalRequest.url.includes('/auth/refresh/')) {
        try {
          const resp = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
            refresh: refreshToken,
          });
          
          const newAccessToken = resp.data.access;
          localStorage.setItem('access_token', newAccessToken);
          
          // Update the failed request with new token and retry
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
          return client(originalRequest);
        } catch (refreshError) {
          // Refresh failed (token expired). Log out.
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token or we just failed to refresh
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        // Only redirect if not already on login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    if (error.response) {
      return Promise.reject(error);
    }
    if (error.request) {
      return Promise.reject({
        response: {
          data: { detail: 'Cannot reach the server. Please check your connection.' },
          status: 0,
        },
      });
    }
    return Promise.reject(error);
  }
);

export default client;
