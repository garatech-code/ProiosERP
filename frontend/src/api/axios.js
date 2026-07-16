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

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor: auto refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check for maintenance mode
    if (error.response?.status === 503 && error.response?.data?.detail === 'maintenance') {
      window.dispatchEvent(new Event('app:maintenance'));
      return Promise.reject(error);
    }

    // The access token is expired or unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refresh_token = localStorage.getItem('refresh_token');
        if (!refresh_token) throw new Error('No refresh token available');

        // request new access token
        const response = await axios.post(`${api.defaults.baseURL}/core/auth/refresh/`, {
          refresh: refresh_token,
        });

        const newAccessToken = response.data.access;
        localStorage.setItem('access_token', newAccessToken);

        if (response.data.refresh) {
          localStorage.setItem('refresh_token', response.data.refresh);
        }

        // retry original request with new token
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        
        processQueue(null, newAccessToken);
        
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        // Refresh token failed or expired -> Logout
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
