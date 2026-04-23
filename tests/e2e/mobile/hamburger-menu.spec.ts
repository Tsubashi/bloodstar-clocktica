import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('mobile hamburger opens the main menu and Escape closes it', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/m.html');

    // The app shows a Welcome dialog (open/create) on first load which traps
    // focus. Dismiss it by clicking "Create New" before accessing the menu.
    await page.getByRole('button', { name: 'Create New' }).click();

    const mainMenu = page.locator('#mobileMainMenu');
    await expect(mainMenu).not.toHaveAttribute('open', 'true');

    await page.locator('#mobileHamburger').click();
    await expect(mainMenu).toHaveAttribute('open', 'true');

    await page.keyboard.press('Escape');
    await expect(mainMenu).not.toHaveAttribute('open', 'true');
  } finally {
    await deleteTestUser(request, user);
  }
});
