import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(120_000);

test('publish flow shows script + almanac URLs in the completion dialog', async ({ request, page }) => {
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

    // Save first.
    await page.keyboard.press('Control+s');
    const saveDialog = page.getByRole('dialog');
    await saveDialog.getByRole('textbox').fill('publish-test');
    await saveDialog.getByRole('button', { name: 'OK' }).click();
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'publish-test' },
      });
      return await r.text();
    }, { timeout: 15_000 }).toBe('true');

    // Publish. The button may be in a dropdown — hover if direct click fails.
    const publishBtn = page.locator('#saveAndPublishButton');
    try {
      await publishBtn.click({ timeout: 2_000 });
    } catch {
      await publishBtn.locator('..').locator('..').hover();
      await publishBtn.click();
    }

    // Publish-complete dialog (use role+text, not id).
    const dlg = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /Publish Complete/i }) });
    await expect(dlg).toBeVisible({ timeout: 60_000 });

    // The dialog has a script link, almanac link, and a donate link (3 total).
    // Filter to only the content links by href pattern.
    const scriptLink = dlg.locator('a[href*="script.json"]');
    const almanacLink = dlg.locator('a[href*="almanac.html"]');
    await expect(scriptLink).toBeVisible();
    await expect(almanacLink).toBeVisible();

    await dlg.getByRole('button', { name: 'OK' }).click();
    await expect(dlg).toBeHidden();
  } finally {
    await deleteTestUser(request, user);
  }
});
