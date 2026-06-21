/**
 * API Configuration — ganti API_BASE_URL sesuai environment.
 *
 * Development: http://localhost:3001
 * Staging:     https://api-staging.hekaspos.id
 * Production:  https://api.hekaspos.id (Phase B) atau https://api.hekaspos.app
 *
 * Untuk ganti: edit baris di bawah, atau set window.__HEKAS_API__ di <head>.
 */
window.__HEKAS_API__ =
  window.__HEKAS_API__ || 'http://localhost:3001';
