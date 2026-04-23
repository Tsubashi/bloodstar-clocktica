import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test('create, save, and reopen an edition via UI', async ({ request, page }) => {
  test.setTimeout(60000);
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');

    // Create new → Welcome dialog → Create New button
    await page.getByRole('button', { name: 'Create New' }).click();

    // Activate meta tab so we know the editor is loaded.
    await page.locator('#metaTabBtn').click();
    await expect(page.locator('#metatab')).toBeVisible();

    // Save via keyboard. First save prompts for a name.
    await page.keyboard.press('Control+s');
    const nameInput = page.getByRole('textbox').first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill('round-trip');
    await page.getByRole('button', { name: 'OK' }).click();

    // Verify server-side
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'round-trip' },
      });
      return await r.text();
    }, { timeout: 15000 }).toBe('true');

    // Clear the recent-file hint so the welcome dialog shows on reload
    // (prevents the app from auto-opening the last edition, which would
    // skip the open-file-picker step we want to exercise).
    await page.evaluate(() => localStorage.removeItem('recentFile'));

    // Reload the page to clear in-memory edition state
    await page.goto('/');

    // The welcome dialog should appear with "Open Existing" button.
    // If for some reason it doesn't, fall back to the File > Open menu.
    const openExistingBtn = page.getByRole('button', { name: 'Open Existing' });
    const isWelcomeShowing = await openExistingBtn.isVisible();
    if (isWelcomeShowing) {
      await openExistingBtn.click();
    } else {
      // File menu dropdown: hover to reveal, then click Open
      await page.locator('#openFileButton').locator('..').locator('..').hover();
      await page.locator('#openFileButton').click();
    }

    // The open dialog lists save names as buttons. Click ours.
    await page.getByRole('button', { name: 'round-trip' }).click();

    // Editor loaded again
    await page.locator('#metaTabBtn').click();
    await expect(page.locator('#metatab')).toBeVisible();
  } finally {
    await deleteTestUser(request, user);
  }
});
