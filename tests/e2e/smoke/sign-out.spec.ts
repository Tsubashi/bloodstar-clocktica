import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test('signed-in user can sign out via the menu', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');

    await expect(page.locator('#signedInLabel')).toBeVisible();

    // The app shows a Welcome dialog (open/create) on first load which traps
    // focus. Dismiss it by clicking "Create New" before accessing the menu.
    await page.getByRole('button', { name: 'Create New' }).click();

    // Sign-out lives inside #signedInMenu which is a CSS-only dropdown.
    // The dropdown content is display:none until the parent .dropdown is
    // hovered/focused, so we must hover the parent before clicking the button.
    const signedInDropdown = page.locator('#signedInLabel').locator('..');
    await signedInDropdown.hover();
    await page.locator('#signOutBtn').click();

    // After sign-out, the sign-in button should be visible again.
    await expect(page.locator('#signInBtn')).toBeVisible();
    await expect(page.locator('#signedInLabel')).toBeHidden();
  } finally {
    // User may already be signed out in the browser, but the API token is
    // still valid. Use it to delete the account.
    await deleteTestUser(request, user);
  }
});
