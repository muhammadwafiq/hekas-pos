/**
 * Integration test — hits actual /api/health and /api/auth/login.
 */

import { test, expect, describe } from 'bun:test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';

describe('Health & Version', () => {
  test('GET /api/health returns ok=true with DB status', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toMatch(/healthy|degraded/);
    expect(json.data.service).toBe('HEKAS POS API');
  });

  test('GET /api/version returns ok=true', async () => {
    const res = await fetch(`${BASE_URL}/api/version`);
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.name).toBe('HEKAS POS API');
  });

  test('GET /api/no-such-route returns 404 with envelope', async () => {
    const res = await fetch(`${BASE_URL}/api/no-such-route`);
    expect(res.status).toBe(404);
    const json: any = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('NOT_FOUND');
  });
});
