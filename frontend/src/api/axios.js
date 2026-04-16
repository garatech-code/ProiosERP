import axios from 'axios';

// baseURL for API: en Docker Compose mapeamos todo bajo /api/ a Django
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api' || 'https://proioserp.onrender.com/api',
});

// Request interceptor: attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: auto refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // The access token is expired or unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refresh_token = localStorage.getItem('refresh_token');
        if (!refresh_token) throw new Error('No refresh token available');

        // request new access token
        const response = await axios.post(`${api.defaults.baseURL}/core/auth/refresh/`, {
          refresh: refresh_token,
        });

        const newAccessToken = response.data.access;
        localStorage.setItem('access_token', newAccessToken);

        // retry original request with new token
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (err) {
        // Refresh token failed or expired -> Logout
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
