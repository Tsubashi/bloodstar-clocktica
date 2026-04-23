import { test, expect, createTestUser, deleteTestUser, injectSession, dragListItem } from '../fixtures';

test.setTimeout(60_000);

test('user can reorder characters via drag-and-drop', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Rename default + add two more
    await page.locator('#characterName').fill('Alpha');
    await page.locator('#characterName').press('Tab');

    await page.locator('#addCharacterButton').click();
    await expect(page.locator('#characterList .characterListItem')).toHaveCount(2);
    await page.locator('#characterName').fill('Bravo');
    await page.locator('#characterName').press('Tab');

    await page.locator('#addCharacterButton').click();
    await expect(page.locator('#characterList .characterListItem')).toHaveCount(3);
    await page.locator('#characterName').fill('Charlie');
    await page.locator('#characterName').press('Tab');

    // Initial order: Alpha, Bravo, Charlie
    const items = page.locator('#characterList .characterListItem');
    await expect(items.nth(0)).toContainText('Alpha');
    await expect(items.nth(1)).toContainText('Bravo');
    await expect(items.nth(2)).toContainText('Charlie');

    // Drag Charlie (index 2) above Alpha (index 0). See tests/e2e/fixtures/drag.ts
    // for why this uses page.evaluate + native DragEvents rather than dragTo().
    await dragListItem(page, '#characterList', 2, 0);

    // Verify reorder: Charlie should now be at index 0
    await expect(items.nth(0)).toContainText('Charlie', { timeout: 5_000 });
    await expect(items.nth(1)).toContainText('Alpha');
    await expect(items.nth(2)).toContainText('Bravo');
  } finally {
    await deleteTestUser(request, user);
  }
});
