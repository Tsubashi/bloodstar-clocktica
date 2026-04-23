import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(90_000);

test('owner can add a user to the share list', async ({ request, page }) => {
  const owner = await createTestUser(request);
  const sharee = await createTestUser(request);
  try {
    await injectSession(page, owner.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    await page.keyboard.press('Control+s');
    const saveDlg = page.getByRole('dialog');
    await saveDlg.getByRole('textbox').fill('add-user');
    await saveDlg.getByRole('button', { name: 'OK' }).click();
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: owner.session.token, saveName: 'add-user' },
      });
      return await r.text();
    }, { timeout: 15_000 }).toBe('true');

    const sharingBtn = page.locator('#sharingButton');
    try { await sharingBtn.click({ timeout: 2_000 }); }
    catch { await sharingBtn.locator('..').locator('..').hover(); await sharingBtn.click(); }

    const shareDlg = page.getByRole('dialog').filter({ hasText: /Share/i });
    await expect(shareDlg).toBeVisible();
    await shareDlg.getByRole('button', { name: 'Add User' }).click();

    await page.locator('#shareWithUserDlgUsername').fill(sharee.username);
    await page.locator('#shareWithUserButton').click();

    await expect(shareDlg.getByText(sharee.username)).toBeVisible({ timeout: 5_000 });

    const getShared = await request.post('/api/get-shared.php', {
      data: { token: owner.session.token, saveName: 'add-user' },
    });
    const body = await getShared.json() as { users: string[] };
    expect(body.users).toContain(sharee.username);
  } finally {
    await deleteTestUser(request, owner);
    await deleteTestUser(request, sharee);
  }
});
