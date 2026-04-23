import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('signing out with unsaved changes prompts save-discard-cancel', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Dirty the edition
    await page.locator('#characterName').fill('DirtyName');
    await page.locator('#characterName').press('Tab');

    // Open signed-in menu and click Sign out
    const signedInDropdown = page.locator('#signedInLabel').locator('..');
    await signedInDropdown.hover();
    await page.locator('#signOutBtn').click();

    const dlg = page.getByRole('dialog').filter({ hasText: /Unsaved Changes/i });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Discard' })).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Cancel' })).toBeVisible();

    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(dlg).toBeHidden();

    // Still signed in
    await expect(page.locator('#userName')).toContainText(user.username);
  } finally {
    await deleteTestUser(request, user);
  }
});
