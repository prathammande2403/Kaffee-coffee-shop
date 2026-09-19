import axios from 'axios';

const getBaseUrl = (): string => {
  let url = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '/api';
  // Remove any trailing slashes
  url = url.replace(/\/+$/, '');
  // If it's a full URL and doesn't end with /api, append /api
  if (url !== '/api' && !url.endsWith('/api')) {
    url = `${url}/api`;
  }
  return url;
};

export const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT access token to every outgoing request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Global response error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear storage on token expiration and redirect to login
      localStorage.removeItem('access_token');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);