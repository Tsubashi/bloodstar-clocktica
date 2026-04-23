import { test, expect, getLatestEmailTo, extract6DigitCode, uniqueId } from '../fixtures';

test('user can sign up through the UI', async ({ request, page }) => {
  const username = uniqueId('u');
  const email = `${uniqueId('e')}@test.local`;
  const password = 'TestPass123';

  // Increase the test timeout to give mailhog enough time to receive email.
  test.setTimeout(60_000);

  try {
    await page.goto('/');

    // The app immediately shows a Sign In dialog on load
    // (from signIn({cancelLabel:'Continue as Guest'}) in bloodstar.ts _init).
    // The dialog contains a "Sign Up" link that opens the sign-up flow.
    // Wait for the dialog to appear before clicking.
    const signUpLink = page.getByRole('link', { name: 'Sign Up' });
    await expect(signUpLink).toBeVisible({ timeout: 10000 });
    await signUpLink.click();

    // Sign-up dialog is now on top. Fill in the form.
    // Field ids: signUpDlgUsername, signUpDlgEmail are unique.
    // Password fields share id="signInDlgPassword" with the sign-in dialog
    // that is still open beneath; disambiguate by autocomplete attribute.
    await expect(page.locator('#signUpDlgUsername')).toBeVisible({ timeout: 5000 });
    await page.locator('#signUpDlgUsername').fill(username);
    await page.locator('#signUpDlgEmail').fill(email);
    // sign-up password uses autocomplete="new-password"; sign-in uses "current-password"
    await page.locator('[autocomplete="new-password"]').first().fill(password);
    await page.locator('[autocomplete="new-password"]').nth(1).fill(password);

    // Trigger validation events so the submit button becomes enabled.
    await page.locator('#signUpDlgUsername').dispatchEvent('input');
    await page.locator('#signUpDlgEmail').dispatchEvent('input');
    await page.locator('[autocomplete="new-password"]').first().dispatchEvent('input');
    await page.locator('[autocomplete="new-password"]').nth(1).dispatchEvent('input');

    // The submit button (id=signupBtn, label='Sign up') is disabled until all fields pass.
    const submit = page.locator('#signupBtn');
    await expect(submit).toBeEnabled({ timeout: 5000 });
    await submit.click();

    // Step 2 — enter the 6-digit confirmation code from the email.
    const mail = await getLatestEmailTo(email, 15_000);
    const code = extract6DigitCode(mail.Body);

    await expect(page.locator('#codeFromEmail')).toBeVisible({ timeout: 5000 });
    await page.locator('#codeFromEmail').fill(code);
    // The Continue button (id=continueBtn) becomes enabled when a 6-digit code is entered.
    await page.locator('#continueBtn').click();

    // Sign-up flow resolves with a session → the startup sign-in dialog closes.
    // The app then calls initCustomEdition which shows the Welcome dialog
    // (Create New / Open Existing). Dismiss it by clicking Create New.
    const createNew = page.getByRole('button', { name: 'Create New' });
    await expect(createNew).toBeVisible({ timeout: 10000 });
    await createNew.click();

    // Now signed in — the header should show our username.
    await expect(page.locator('#userName')).toContainText(username, { timeout: 10000 });
  } finally {
    // Teardown: delete via API using a fresh signin token.
    const signin = await request.post('/api/signin.php', {
      data: { usernameOrEmail: username, password },
    });
    const session = await signin.json() as { token?: string };
    if (session.token) {
      await request.post('/api/deleteaccount.php', {
        data: { token: session.token, password },
      });
    }
  }
});
