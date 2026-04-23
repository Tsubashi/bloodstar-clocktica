import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test('API auth shortcut creates a user, injects token, lands signed-in', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await expect(page.locator('#signedInLabel')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#userName')).toContainText(user.username, { timeout: 10000 });
  } finally {
    await deleteTestUser(request, user);
  }
});
