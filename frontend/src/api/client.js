import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,  // send session cookies for Django auth
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor: normalise error shapes
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server returned an error response — pass it through as-is
      return Promise.reject(error);
    }
    if (error.request) {
      // Request was made but no response received (network/CORS)
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
