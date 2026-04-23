import { test, expect } from '@playwright/test';

test('Playwright can reach the health endpoint', async ({ request }) => {
  const response = await request.get('/api/health.php');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toEqual({ status: 'ok', db: 'ok' });
});
