import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(90_000);

test('user can block and unblock another user via the menu dialog', async ({ request, page }) => {
  const user1 = await createTestUser(request);
  const user2 = await createTestUser(request);
  try {
    await injectSession(page, user1.session);
    await page.goto('/');
    const createNew = page.getByRole('button', { name: 'Create New' });
    if (await createNew.isVisible().catch(() => false)) await createNew.click();

    const blockBtn = page.locator('#blockedUsersButton');
    try { await blockBtn.click({ timeout: 2_000 }); }
    catch { await blockBtn.locator('..').locator('..').hover(); await blockBtn.click(); }

    const manageDlg = page.getByRole('dialog').filter({ hasText: /Manage Blocked Users/i });
    await expect(manageDlg).toBeVisible();

    await manageDlg.getByRole('button', { name: 'Block a User' }).click();

    // Block prompt subdialog
    const blockPromptDlg = page.getByRole('dialog').filter({ hasText: /Block User/i });
    await expect(blockPromptDlg).toBeVisible();
    await page.locator('#blockPromptUsername').fill(user2.username);
    await page.locator('#blockUserButton').click();

    // Block confirmation dialog — always appears
    const blockConfirmDlg = page.getByRole('dialog').filter({ hasText: new RegExp(`Block ${user2.username}`, 'i') });
    await expect(blockConfirmDlg).toBeVisible({ timeout: 3_000 });
    await blockConfirmDlg.getByRole('button', { name: 'Yes' }).click();

    // Now the manage dialog should show the blocked user as a <span>
    const blockedRow = manageDlg.locator('span').filter({ hasText: user2.username });
    await expect(blockedRow).toBeVisible({ timeout: 5_000 });

    // Unblock
    await manageDlg.getByRole('button', { name: 'Unblock' }).click();

    // Unblock confirmation — same dialog title format as block ("Block {username}")
    const unblockConfirmDlg = page.getByRole('dialog').filter({ hasText: new RegExp(`Block ${user2.username}`, 'i') });
    await expect(unblockConfirmDlg).toBeVisible({ timeout: 3_000 });
    await unblockConfirmDlg.getByRole('button', { name: 'Yes' }).click();

    await expect(blockedRow).toBeHidden({ timeout: 5_000 });

    const getBlocked = await request.post('/api/get-blocked.php', {
      data: { token: user1.session.token },
    });
    const body = await getBlocked.json() as { users: string[] };
    expect(body.users).not.toContain(user2.username);
  } finally {
    await deleteTestUser(request, user1);
    await deleteTestUser(request, user2);
  }
});
