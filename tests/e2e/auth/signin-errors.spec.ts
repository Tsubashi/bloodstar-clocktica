import { test, expect, createTestUser, deleteTestUser } from '../fixtures';

test.describe('signin errors', () => {
  test('wrong password shows an error', async ({ request, page }) => {
    const user = await createTestUser(request);
    try {
      await page.goto('/');
      // Sign-in dialog appears automatically on load.
      // The dialog container id is 'sign-in1' (baseOpen appends a counter).
      const dialog = page.locator('[id^="sign-in"]').filter({ has: page.locator('#signInDlgUsername') });

      await dialog.getByLabel('Username or email').fill(user.username);
      await dialog.getByLabel('Password').fill('ObviouslyWrong123');
      await dialog.getByRole('button', { name: 'Sign in' }).click();

      // Visible error somewhere on the dialog.
      await expect(page.getByText(/incorrect|error|failed/i).first()).toBeVisible({ timeout: 5000 });
      // Should NOT be signed in (userName span shouldn't have our username).
      await expect(page.locator('#userName')).not.toContainText(user.username);
    } finally {
      await deleteTestUser(request, user);
    }
  });

  test('unknown username shows an error', async ({ page }) => {
    await page.goto('/');

    const dialog = page.locator('[id^="sign-in"]').filter({ has: page.locator('#signInDlgUsername') });

    await dialog.getByLabel('Username or email').fill('definitely-not-a-user');
    await dialog.getByLabel('Password').fill('TestPass123');
    await dialog.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText(/incorrect|error|failed/i).first()).toBeVisible({ timeout: 5000 });
  });
});
