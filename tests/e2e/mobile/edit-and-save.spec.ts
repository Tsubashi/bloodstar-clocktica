import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(90_000);

test('mobile: user can create, edit, and save an edition end-to-end', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/m.html');

    // The app shows a Welcome dialog (open/create) on first load.
    // Dismiss it directly by clicking "Create New".
    await page.getByRole('button', { name: 'Create New' }).click();

    // Edit character name
    await page.locator('#charTabBtn').click();
    await page.locator('#characterName').fill('MobileAlpha');
    await page.locator('#characterName').press('Tab');

    // Save via mobile menu → File → Save
    await page.locator('#mobileHamburger').click();
    await page.locator('#mobileFileButton').click();
    await page.locator('#saveFileButton').click();

    // Save name prompt
    const saveDlg = page.getByRole('dialog');
    await saveDlg.getByRole('textbox').fill('mobile-edit');
    await saveDlg.getByRole('button', { name: 'OK' }).click();

    // Verify server-side
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'mobile-edit' },
      });
      return await r.text();
    }, { timeout: 15_000 }).toBe('true');
  } finally {
    await deleteTestUser(request, user);
  }
});
