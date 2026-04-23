import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(90_000);

test('ability text persists through save + reload + reopen', async ({ request, page }) => {
  const user = await createTestUser(request);
  const ability = 'You start knowing a good player.';
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    await page.locator('#characterAbility').fill(ability);
    await page.locator('#characterAbility').press('Tab');

    await page.keyboard.press('Control+s');
    const saveDialog = page.getByRole('dialog');
    await saveDialog.getByRole('textbox').fill('ability-persist');
    await saveDialog.getByRole('button', { name: 'OK' }).click();

    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'ability-persist' },
      });
      return await r.text();
    }, { timeout: 15000 }).toBe('true');

    await page.evaluate(() => localStorage.removeItem('recentFile'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Open Existing' }).click();
    await page.getByRole('button', { name: 'ability-persist' }).click();

    await page.locator('#charTabBtn').click();
    await expect(page.locator('#characterAbility')).toHaveValue(ability);
  } finally {
    await deleteTestUser(request, user);
  }
});
