import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(90_000);

test('owner can remove a user from the share list via the dialog', async ({ request, page }) => {
  const owner = await createTestUser(request);
  const sharee = await createTestUser(request);
  try {
    // Save the edition through the UI so it has all required fields
    await injectSession(page, owner.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    await page.keyboard.press('Control+s');
    const saveDlg = page.getByRole('dialog');
    await saveDlg.getByRole('textbox').fill('remove-test');
    await saveDlg.getByRole('button', { name: 'OK' }).click();
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: owner.session.token, saveName: 'remove-test' },
      });
      return await r.text();
    }, { timeout: 15_000 }).toBe('true');

    // Pre-share via API (fast path)
    await request.post('/api/share.php', {
      data: {
        token: owner.session.token,
        saveName: 'remove-test',
        user: sharee.username,
      },
    });

    // Open the sharing dialog (edition is already open)
    const sharingBtn = page.locator('#sharingButton');
    try { await sharingBtn.click({ timeout: 2_000 }); }
    catch { await sharingBtn.locator('..').locator('..').hover(); await sharingBtn.click(); }

    const shareDlg = page.getByRole('dialog').filter({ hasText: /Share/i });
    // The share row is a <span> with the exact username
    const shareeRow = shareDlg.locator('span').filter({ hasText: sharee.username });
    await expect(shareeRow).toBeVisible({ timeout: 10_000 });

    await shareDlg.getByRole('button', { name: 'Remove' }).click();

    // Confirmation dialog always appears — click Yes
    const confirmDlg = page.getByRole('dialog').filter({ hasText: /Unshare with user/i });
    await expect(confirmDlg).toBeVisible({ timeout: 3_000 });
    await confirmDlg.getByRole('button', { name: 'Yes' }).click();

    await expect(shareeRow).toBeHidden({ timeout: 5_000 });

    const getShared = await request.post('/api/get-shared.php', {
      data: { token: owner.session.token, saveName: 'remove-test' },
    });
    const body = await getShared.json() as { users: string[] };
    expect(body.users).not.toContain(sharee.username);
  } finally {
    await deleteTestUser(request, owner);
    await deleteTestUser(request, sharee);
  }
});
