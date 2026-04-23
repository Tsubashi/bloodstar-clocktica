import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(90_000);

test('toggling an image setting persists through save + reload + reopen', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Image settings live inside a collapsed <details> — expand first.
    const styleSettingsSummary = page.locator('summary', { hasText: 'Style settings' });
    await styleSettingsSummary.click();

    const colorize = page.locator('#shouldColorize');
    await expect(colorize).toBeChecked();
    await colorize.uncheck();
    await expect(colorize).not.toBeChecked();

    await page.keyboard.press('Control+s');
    const saveDialog = page.getByRole('dialog');
    await saveDialog.getByRole('textbox').fill('img-settings');
    await saveDialog.getByRole('button', { name: 'OK' }).click();
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'img-settings' },
      });
      return await r.text();
    }, { timeout: 15_000 }).toBe('true');

    await page.evaluate(() => localStorage.removeItem('recentFile'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Open Existing' }).click();
    await page.getByRole('button', { name: 'img-settings' }).click();
    await page.locator('#charTabBtn').click();

    // Re-expand Style settings after reopen.
    await page.locator('summary', { hasText: 'Style settings' }).click();

    await expect(page.locator('#shouldColorize')).not.toBeChecked();
  } finally {
    await deleteTestUser(request, user);
  }
});
