import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test('save-as creates a named copy', async ({ request, page }) => {
  test.setTimeout(60000);
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#metaTabBtn').click();
    await expect(page.locator('#metatab')).toBeVisible();

    // Initial save — dialog appears; scope to dialog to avoid meta-tab textboxes
    await page.keyboard.press('Control+s');
    const saveDialog = page.getByRole('dialog');
    await expect(saveDialog).toBeVisible();
    await saveDialog.getByRole('textbox').fill('original');
    await saveDialog.getByRole('button', { name: 'OK' }).click();

    // Wait for the initial save to register server-side before triggering save-as,
    // otherwise save-as may race the list.php check.
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'original' },
      });
      return await r.text();
    }, { timeout: 15000 }).toBe('true');

    // Save As → different name
    // #saveFileAsButton is in a File-menu dropdown; hover parent to reveal it first
    await page.locator('#saveFileAsButton').locator('..').locator('..').hover();
    await page.locator('#saveFileAsButton').click();
    // Scope to the dialog so we don't pick up the meta-tab textboxes in the background
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const nameInput = dialog.getByRole('textbox');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('copy');
    // Wait for OK to be enabled (dialog validates the name before enabling)
    const okBtn = dialog.getByRole('button', { name: 'OK' });
    await expect(okBtn).toBeEnabled({ timeout: 5000 });
    await okBtn.click();

    // Both names should exist server-side
    await expect.poll(async () => {
      const list = await request.post('/api/list.php', {
        data: { token: user.session.token },
      });
      const body = await list.json() as { files: string[] };
      return body.files.sort().join(',');
    }, { timeout: 15000 }).toBe('copy,original');
  } finally {
    await deleteTestUser(request, user);
  }
});
