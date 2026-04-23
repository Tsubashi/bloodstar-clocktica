import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('user can open the sharing dialog on a saved edition', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    await page.keyboard.press('Control+s');
    const saveDlg = page.getByRole('dialog');
    await saveDlg.getByRole('textbox').fill('share-open');
    await saveDlg.getByRole('button', { name: 'OK' }).click();
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'share-open' },
      });
      return await r.text();
    }, { timeout: 15_000 }).toBe('true');

    const sharingBtn = page.locator('#sharingButton');
    try { await sharingBtn.click({ timeout: 2_000 }); }
    catch { await sharingBtn.locator('..').locator('..').hover(); await sharingBtn.click(); }

    const dlg = page.getByRole('dialog').filter({ hasText: /Share/i });
    await expect(dlg).toBeVisible({ timeout: 5_000 });
    await expect(dlg.getByRole('button', { name: 'Add User' })).toBeVisible();
  } finally {
    await deleteTestUser(request, user);
  }
});
