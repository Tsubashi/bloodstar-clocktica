import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(120_000);

test('spinner dialog auto-closes after publish', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();
    await page.locator('#characterName').fill('Alpha');
    await page.locator('#characterName').press('Tab');
    await page.locator('#characterFirstNightReminder').fill('Alpha first');
    await page.locator('#characterFirstNightReminder').press('Tab');

    await page.keyboard.press('Control+s');
    const saveDialog = page.getByRole('dialog');
    await saveDialog.getByRole('textbox').fill('spinner-test');
    await saveDialog.getByRole('button', { name: 'OK' }).click();
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'spinner-test' },
      });
      return await r.text();
    }, { timeout: 15_000 }).toBe('true');

    const publishBtn = page.locator('#saveAndPublishButton');
    try { await publishBtn.click({ timeout: 2_000 }); }
    catch { await publishBtn.locator('..').locator('..').hover(); await publishBtn.click(); }

    // Publish-complete dialog appearing means the spinner flow completed.
    const completeDlg = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /Publish Complete/i }) });
    await expect(completeDlg).toBeVisible({ timeout: 60_000 });

    // No spinner remaining (publish-complete is not a spinner).
    await expect(page.locator('div.spinner')).toHaveCount(0);
  } finally {
    await deleteTestUser(request, user);
  }
});
