import { test, expect, createTestUser, deleteTestUser, getLatestEmailTo, extract6DigitCode, clearMailhogInbox } from '../fixtures';

test('user can reset password via the UI', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    // Clear mailhog AFTER signup/confirm so getLatestEmailTo finds the
    // reset email (not the earlier signup-confirmation email).
    await clearMailhogInbox();

    await page.goto('/');

    // The startup Sign In dialog is already visible. Click "Forgot your password?"
    await page.getByRole('link', { name: 'Forgot your password?' }).click();

    // Request step — fill username and submit
    await page.locator('#requestResetDlgUsername').fill(user.username);
    await page.getByRole('button', { name: 'Reset my password' }).click();

    // Fetch the reset code from mailhog
    const mail = await getLatestEmailTo(user.email);
    const code = extract6DigitCode(mail.Body);

    // Reset step — code + new password
    const newPassword = 'NewPass456';
    await page.locator('#codeFromEmail').fill(code);
    await page.locator('#passwordInput').fill(newPassword);
    await page.locator('#resetPasswordConfirm').fill(newPassword);

    const submit = page.getByRole('button', { name: 'Set password' });
    await expect(submit).toBeEnabled();
    await submit.click();

    // After reset, user should be signed in
    await expect(page.locator('#userName')).toContainText(user.username, { timeout: 10000 });

    // Verify via API that the old password no longer works
    const oldSignin = await request.post('/api/signin.php', {
      data: { usernameOrEmail: user.username, password: user.password },
    });
    const oldBody = await oldSignin.json();
    expect(oldBody.title).toBe('Sign-In Error');

    // And the new password works
    const newSignin = await request.post('/api/signin.php', {
      data: { usernameOrEmail: user.username, password: newPassword },
    });
    const newBody = await newSignin.json();
    expect(newBody.username).toBe(user.username);

    // Update the user object so teardown uses the new password
    user.password = newPassword;
  } finally {
    await deleteTestUser(request, user);
  }
});
