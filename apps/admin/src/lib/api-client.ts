import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

function clearTenantScope() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem('current_tenant_id');
  window.dispatchEvent(new CustomEvent('wmsTenantScopeChanged', { detail: null }));
}

// Request interceptor - Add auth token and tenant ID
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      const tenantId = localStorage.getItem('current_tenant_id');

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (tenantId) {
        config.headers['X-Tenant-ID'] = tenantId;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      error.response?.status === 403
      && typeof window !== 'undefined'
      && typeof error.config?.url === 'string'
      && error.config.url.includes('/wms/')
    ) {
      const message =
        error.response?.data?.message
        ?? error.response?.data?.error
        ?? '';
      const shouldResetTenantScope =
        typeof message === 'string'
        && (message.includes('Partner account is not active')
          || message.includes('Tenant account is not active'));

      if (shouldResetTenantScope && !error.config.__tenantScopeRetried) {
        clearTenantScope();
        error.config.__tenantScopeRetried = true;
        if (error.config.headers) {
          delete error.config.headers['X-Tenant-ID'];
        }
        return apiClient.request(error.config);
      }
    }

    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('current_tenant_id');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
