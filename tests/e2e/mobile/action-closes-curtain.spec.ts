import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('tapping a menu item inside a mobile curtain closes the curtain', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/m.html');

    // The app shows a Welcome dialog (open/create) on first load which traps
    // focus. Dismiss it by clicking "Create New" before accessing the menu.
    await page.getByRole('button', { name: 'Create New' }).click();

    await page.locator('#mobileHamburger').click();
    const fileMenu = page.locator('#mobileFileMenu');
    await page.locator('#mobileFileButton').click();
    await expect(fileMenu).toHaveAttribute('open', 'true');

    // Tap New — the curtain closes and newEdition resets the current edition.
    await page.locator('#newFileButton').click();

    // File menu curtain auto-closes.
    await expect(fileMenu).not.toHaveAttribute('open', 'true', { timeout: 5_000 });
    await expect(page.locator('#mobileMainMenu')).not.toHaveAttribute('open', 'true');

    // The file menu is gone and we're back to the editor with no open curtain.
    await expect(page.locator('#mobileHamburger')).toBeVisible({ timeout: 5_000 });
  } finally {
    await deleteTestUser(request, user);
  }
});
