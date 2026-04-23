import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('user can delete an edition via the UI', async ({ request, page }) => {
  const user = await createTestUser(request);

  // Pre-create an edition via the API so the delete flow has something to target.
  await request.post('/api/save.php', {
    data: {
      token: user.session.token,
      saveName: 'todelete',
      edition: { meta: { name: 'To Delete' } },
    },
  });

  try {
    await injectSession(page, user.session);
    await page.goto('/');

    // Dismiss welcome dialog if present
    const createNew = page.getByRole('button', { name: 'Create New' });
    if (await createNew.isVisible().catch(() => false)) {
      await createNew.click();
    }

    // Open File menu dropdown. `#deleteFileButton` is inside it; hover
    // the File dropdown label first (same pattern as #saveFileAsButton).
    await page.locator('#deleteFileButton').locator('..').locator('..').hover();
    await page.locator('#deleteFileButton').click();

    // The delete flow shows a file picker. Click our edition by name.
    await page.getByRole('button', { name: 'todelete' }).click();

    // Confirmation dialog — the yes button is disabled until the checkbox is checked.
    // The checkbox label is "Yes, I am certain I want to delete file "todelete"".
    // Scope to the specific dialog that contains the confirm checkbox (avoids
    // strict-mode violations when spinner/other dialogs are also in the DOM).
    const confirmCheckbox = page.locator('#confirmCheckbox');
    await expect(confirmCheckbox).toBeVisible({ timeout: 10000 });
    await confirmCheckbox.check();

    // The yes button label is `Yes, delete "todelete"` — match with regex.
    const confirmBtn = page.getByRole('button', { name: /Yes, delete/ });
    await expect(confirmBtn).toBeEnabled({ timeout: 5000 });
    await confirmBtn.click();

    // Verify server-side deletion
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'todelete' },
      });
      return await r.text();
    }, { timeout: 15000 }).toBe('false');
  } finally {
    await deleteTestUser(request, user);
  }
});
