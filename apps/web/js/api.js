/**
 * HEKAS POS API Client — thin wrapper around fetch().
 *
 * Auto-handles:
 * - JSON parsing
 * - Authorization header (dari localStorage 'accessToken')
 * - Error response shape: { ok: false, error: 'code', message: '...' }
 * - 401 → auto-redirect to login
 */

const API_BASE = window.__HEKAS_API__;

/** Get access token from localStorage */
function getToken() {
  return localStorage.getItem('accessToken');
}

/** Set access token (and refresh token) to localStorage */
export function setTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}

/** Clear all auth data */
export function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

/** Core fetch wrapper */
async function request(method, path, { body, headers = {}, auth = true } = {}) {
  const url = `${API_BASE}${path}`;

  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  if (auth && getToken()) {
    opts.headers['Authorization'] = `Bearer ${getToken()}`;
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    throw new ApiError('network_error', 'Tidak bisa terhubung ke server. Cek koneksi kamu.', 0);
  }

  // 204 No Content
  if (res.status === 204) return null;

  // Try parse JSON
  let data;
  try {
    data = await res.json();
  } catch {
    data = { ok: false, error: 'invalid_json', message: res.statusText };
  }

  if (!res.ok || data.ok === false) {
    // Auto-redirect on 401
    if (res.status === 401) {
      clearTokens();
      // Only redirect if not already on login/register page
      if (!window.location.pathname.includes('login') &&
          !window.location.pathname.includes('register')) {
        window.location.href = '/login.html';
      }
    }

    throw new ApiError(
      data.error?.code || data.error || 'unknown_error',
      data.error?.message || data.message || res.statusText,
      res.status,
      data
    );
  }

  return data;
}

/** Custom error class */
export class ApiError extends Error {
  constructor(code, message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

// ===== Auth =====

export const auth = {
  register: (data) => request('POST', '/api/register/', { body: data, auth: false }),
  login: (data) => request('POST', '/api/auth/login', { body: data, auth: false }),
  logout: () => request('POST', '/api/auth/logout'),
  me: () => request('GET', '/api/auth/me'),
  verifyEmail: (token) => request('GET', `/api/auth/verify-email?token=${token}`, { auth: false }),
  forgotPassword: (email) => request('POST', '/api/auth/forgot-password', { body: { email }, auth: false }),
  resetPassword: (token, newPassword) => request('POST', '/api/auth/reset-password', { body: { token, newPassword }, auth: false }),
};

// ===== Public =====

export const publicApi = {
  getPlans: () => request('GET', '/api/public/plans', { auth: false }),
};

// ===== Admin (subscription) =====

export const subscription = {
  getMine: () => request('GET', '/api/admin/subscriptions/me'),
  getStats: () => request('GET', '/api/admin/subscriptions/stats'),
  changePlan: (id, data) => request('PATCH', `/api/admin/subscriptions/${id}`, { body: data }),
  recordPayment: (id, data) => request('POST', `/api/admin/subscriptions/${id}/payments`, { body: data }),
};

// ===== Outlets =====

export const outlets = {
  list: () => request('GET', '/api/admin/outlets'),
  get: (id) => request('GET', `/api/admin/outlets/${id}`),
  create: (data) => request('POST', '/api/admin/outlets', { body: data }),
  update: (id, data) => request('PATCH', `/api/admin/outlets/${id}`, { body: data }),
  deactivate: (id) => request('POST', `/api/admin/outlets/${id}/deactivate`),
  getUsage: () => request('GET', '/api/admin/outlets/stats/usage'),
};

// ===== Users (staff) =====

export const users = {
  list: () => request('GET', '/api/admin/users'),
  get: (id) => request('GET', `/api/admin/users/${id}`),
  create: (data) => request('POST', '/api/admin/users', { body: data }),
  update: (id, data) => request('PATCH', `/api/admin/users/${id}`, { body: data }),
  resetPassword: (id, newPassword) =>
    request('POST', `/api/admin/users/${id}/reset-password`, { body: { newPassword } }),
  listOutlets: (id) => request('GET', `/api/admin/users/${id}/outlets`),
  assignOutlet: (id, data) => request('POST', `/api/admin/users/${id}/outlets`, { body: data }),
  removeOutlet: (id, outletId) => request('DELETE', `/api/admin/users/${id}/outlets/${outletId}`),
};
