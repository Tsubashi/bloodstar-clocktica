import { test, expect, createTestUser, injectSession } from '../fixtures';

test('user can delete their account via the UI', async ({ request, page }) => {
  const user = await createTestUser(request);

  await injectSession(page, user.session);
  await page.goto('/');
  await expect(page.locator('#userName')).toContainText(user.username, { timeout: 10000 });

  // Dismiss the Welcome dialog if present. `Create New` seeds the editor
  // state and frees up menu interactions.
  const createNew = page.getByRole('button', { name: 'Create New' });
  if (await createNew.isVisible().catch(() => false)) {
    await createNew.click();
  }

  // Open the signed-in dropdown so the delete-account button is reachable.
  const signedInDropdown = page.locator('#signedInLabel').locator('..');
  await signedInDropdown.hover();
  await page.locator('#deleteAccountBtn').click();

  // The app reuses the existing session (no re-signin dialog when already
  // signed in with a valid token), so the password dialog appears directly.
  // Step 1: password-confirmation dialog. The AriaDialog base class appends a
  // counter to the debugName, so id becomes e.g. "pwd-for-del-accnt1". Use a
  // prefix selector or match by role+heading text instead.
  const pwdDlg = page.getByRole('dialog').filter({ hasText: /Enter Password/i });
  await expect(pwdDlg).toBeVisible({ timeout: 10000 });
  await pwdDlg.locator('input[type=password]').fill(user.password);
  await pwdDlg.getByRole('button', { name: 'OK' }).click();

  // Step 2: final confirmation
  await page.getByRole('checkbox', { name: /certain/i }).check();
  await page.getByRole('button', { name: 'Delete my account' }).click();

  // The app shows a "Done / Account deleted" message dialog before signing out.
  // Dismiss it so the sign-in dialog can appear.
  const doneDlg = page.getByRole('dialog').filter({ hasText: /account deleted/i });
  await expect(doneDlg).toBeVisible({ timeout: 10000 });
  await doneDlg.getByRole('button', { name: 'OK' }).click();

  // After deletion + OK, the startup Sign In dialog should appear (no session).
  await expect(page.locator('#signInDlgUsername')).toBeVisible({ timeout: 10000 });

  // Verify via API that the account is gone
  const res = await request.post('/api/signin.php', {
    data: { usernameOrEmail: user.username, password: user.password },
  });
  const body = await res.json();
  expect(body.title).toBe('Sign-In Error');
});
