import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('pressing ESC on a yes-no confirmation cancels the action', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    await page.locator('#addCharacterButton').click();
    await expect(page.locator('#characterList .characterListItem')).toHaveCount(2);

    const firstItem = page.locator('#characterList .characterListItem').first();
    await firstItem.getByRole('button', { name: 'Delete' }).first().click();

    const confirmDlg = page.getByRole('dialog').filter({ hasText: /Confirm Delete/i });
    await expect(confirmDlg).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(confirmDlg).toBeHidden();
    await expect(page.locator('#characterList .characterListItem')).toHaveCount(2);
  } finally {
    await deleteTestUser(request, user);
  }
});
