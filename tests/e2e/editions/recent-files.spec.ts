import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('after saving, localStorage remembers the recent file', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#metaTabBtn').click();
    await expect(page.locator('#metatab')).toBeVisible();

    // Save — scope the textbox to the save dialog.
    await page.keyboard.press('Control+s');
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    await dlg.getByRole('textbox').fill('my-recent');
    await dlg.getByRole('button', { name: 'OK' }).click();

    // Wait for server-side save to complete (prevents race).
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'my-recent' },
      });
      return await r.text();
    }, { timeout: 15000 }).toBe('true');

    // Now poll localStorage for the recent-file key.
    await expect.poll(async () => {
      return await page.evaluate(() => localStorage.getItem('recentFile'));
    }, { timeout: 10000 }).toBe('my-recent');

    const recentUser = await page.evaluate(() => localStorage.getItem('recentFileUser'));
    expect(recentUser).toBe(user.email);
  } finally {
    await deleteTestUser(request, user);
  }
});
