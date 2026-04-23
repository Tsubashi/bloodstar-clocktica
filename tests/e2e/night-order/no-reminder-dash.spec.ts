import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('character without a first-night reminder shows "-" ordinal', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    await page.locator('#characterName').fill('NoReminder');
    await page.locator('#characterName').press('Tab');
    // Leave #characterFirstNightReminder blank.

    await page.locator('#firstNightTabBtn').click();
    const item = page.locator('#firstNightOrderList > li').first();
    await expect(item).toContainText('-');
    await expect(item).not.toContainText(/\b1st\b/);

    // Add reminder → ordinal becomes "1st".
    await page.locator('#charTabBtn').click();
    await page.locator('#characterFirstNightReminder').fill('Now visible');
    await page.locator('#characterFirstNightReminder').press('Tab');

    await page.locator('#firstNightTabBtn').click();
    await expect(item).toContainText('1st');
  } finally {
    await deleteTestUser(request, user);
  }
});
