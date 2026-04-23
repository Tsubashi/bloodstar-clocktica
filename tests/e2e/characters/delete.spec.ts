import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('deleting a character removes it from the list', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    await page.locator('#addCharacterButton').click();
    await expect(page.locator('#characterList .characterListItem')).toHaveCount(2);

    const firstItem = page.locator('#characterList .characterListItem').first();
    // Delete button text is 'Delete' (from collection-buttons-mgr.ts line 115)
    const deleteBtn = firstItem.getByRole('button', { name: 'Delete' });
    await deleteBtn.click();

    // Confirmation dialog title is 'Confirm Delete', message includes character name.
    // Yes button label defaults to 'Yes'.
    const confirmDlg = page.getByRole('dialog').filter({ hasText: /Confirm Delete/i });
    await confirmDlg.getByRole('button', { name: 'Yes' }).click();

    await expect(page.locator('#characterList .characterListItem')).toHaveCount(1);
  } finally {
    await deleteTestUser(request, user);
  }
});
