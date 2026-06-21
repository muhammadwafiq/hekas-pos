/**
 * Auth helpers — login state, redirects, role guards.
 */

import { setTokens, clearTokens, auth, ApiError } from './api.js';

/** Get current user from localStorage */
export function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

/** Check if user is logged in */
export function isLoggedIn() {
  return !!localStorage.getItem('accessToken');
}

/** Login and store tokens */
export async function login(username, password) {
  const res = await auth.login({ username, password });
  if (res.ok && res.data) {
    setTokens(res.data.accessToken, res.data.refreshToken);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    return res.data.user;
  }
  throw new Error('Login failed');
}

/** Logout and redirect to login page */
export async function logout() {
  try {
    await auth.logout();
  } catch (e) {
    // Ignore network error on logout
  }
  clearTokens();
  window.location.href = '/login.html';
}

/** Redirect to login if not authenticated */
export function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

/** Redirect if user doesn't have required role */
export function requireRole(roles) {
  if (!requireAuth()) return false;
  const user = getUser();
  if (!roles.includes(user?.role)) {
    window.location.href = '/dashboard.html';
    return false;
  }
  return true;
}

/** Show toast notification (simple) */
export function toast(message, type = 'info', duration = 3000) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'toast';
  div.className = `toast toast-${type}`;
  div.textContent = message;
  document.body.appendChild(div);

  setTimeout(() => div.remove(), duration);
}
