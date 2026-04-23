import { test, expect, createTestUser, deleteTestUser, injectSession, dragListItem } from '../fixtures';

test.setTimeout(60_000);

test('other-night reorder is independent from first-night order', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    for (const name of ['Alpha', 'Bravo', 'Charlie']) {
      if (name !== 'Alpha') {
        await page.locator('#addCharacterButton').click();
      }
      await page.locator('#characterName').fill(name);
      await page.locator('#characterName').press('Tab');
      await page.locator('#characterFirstNightReminder').fill(`${name} first`);
      await page.locator('#characterFirstNightReminder').press('Tab');
      await page.locator('#characterOtherNightReminder').fill(`${name} other`);
      await page.locator('#characterOtherNightReminder').press('Tab');
    }

    await page.locator('#otherNightTabBtn').click();
    const otherItems = page.locator('#otherNightOrderList > li');
    await expect(otherItems).toHaveCount(3);
    await dragListItem(page, '#otherNightOrderList', 2, 0);
    await expect(otherItems.nth(0)).toContainText('Charlie');

    await page.locator('#firstNightTabBtn').click();
    const firstItems = page.locator('#firstNightOrderList > li');
    await expect(firstItems.nth(0)).toContainText('Alpha');
    await expect(firstItems.nth(2)).toContainText('Charlie');
  } finally {
    await deleteTestUser(request, user);
  }
});
