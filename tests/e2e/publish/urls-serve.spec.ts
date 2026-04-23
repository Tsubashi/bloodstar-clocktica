import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(120_000);

test('published URLs serve valid script.json and almanac.html', async ({ request, page }) => {
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
    await saveDialog.getByRole('textbox').fill('url-test');
    await saveDialog.getByRole('button', { name: 'OK' }).click();
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'url-test' },
      });
      return await r.text();
    }, { timeout: 15_000 }).toBe('true');

    const publishBtn = page.locator('#saveAndPublishButton');
    try { await publishBtn.click({ timeout: 2_000 }); }
    catch { await publishBtn.locator('..').locator('..').hover(); await publishBtn.click(); }

    const dlg = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /Publish Complete/i }) });
    await expect(dlg).toBeVisible({ timeout: 60_000 });

    // The dialog contains script, almanac, and donate links.
    // Select by href pattern to avoid depending on DOM order.
    const scriptHref = await dlg.locator('a[href*="script.json"]').getAttribute('href');
    const almanacHref = await dlg.locator('a[href*="almanac.html"]').getAttribute('href');
    expect(scriptHref).toBeTruthy();
    expect(almanacHref).toBeTruthy();

    // Strip origin. URLs are built against SITE_ROOT but the test stack
    // serves them from localhost:8086.
    const scriptPath = scriptHref!.replace(/^https?:\/\/[^/]+/, '');
    const almanacPath = almanacHref!.replace(/^https?:\/\/[^/]+/, '');

    const scriptRes = await request.get(scriptPath);
    expect(scriptRes.status()).toBe(200);
    expect(await scriptRes.text()).toContain('"id"');

    const almanacRes = await request.get(almanacPath);
    expect(almanacRes.status()).toBe(200);
    expect(await almanacRes.text()).toContain('<html');
  } finally {
    await deleteTestUser(request, user);
  }
});
