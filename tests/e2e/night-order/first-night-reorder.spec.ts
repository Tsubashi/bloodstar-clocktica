import { test, expect, createTestUser, deleteTestUser, injectSession, dragListItem } from '../fixtures';

test.setTimeout(60_000);

test('first-night drag-reorder is independent from character-list order', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Three characters with first-night reminders so they appear in night-order.
    for (const name of ['Alpha', 'Bravo', 'Charlie']) {
      if (name !== 'Alpha') {
        await page.locator('#addCharacterButton').click();
      }
      await page.locator('#characterName').fill(name);
      await page.locator('#characterName').press('Tab');
      await page.locator('#characterFirstNightReminder').fill(`${name} reminder`);
      await page.locator('#characterFirstNightReminder').press('Tab');
    }
    await expect(page.locator('#characterList .characterListItem')).toHaveCount(3);

    await page.locator('#firstNightTabBtn').click();
    const firstNightItems = page.locator('#firstNightOrderList > li');
    await expect(firstNightItems).toHaveCount(3);
    await expect(firstNightItems.nth(0)).toContainText('Alpha');
    await expect(firstNightItems.nth(2)).toContainText('Charlie');

    await dragListItem(page, '#firstNightOrderList', 2, 0);

    await expect(firstNightItems.nth(0)).toContainText('Charlie');

    // Character-list order unchanged
    await page.locator('#charTabBtn').click();
    const charItems = page.locator('#characterList .characterListItem');
    await expect(charItems.nth(0)).toContainText('Alpha');
    await expect(charItems.nth(2)).toContainText('Charlie');
  } finally {
    await deleteTestUser(request, user);
  }
});
