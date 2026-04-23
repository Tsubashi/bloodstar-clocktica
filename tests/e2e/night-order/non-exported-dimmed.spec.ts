import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('non-exported characters appear dimmed in night-order view', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    await page.locator('#characterName').fill('Alpha');
    await page.locator('#characterName').press('Tab');
    await page.locator('#characterFirstNightReminder').fill('Alpha first');
    await page.locator('#characterFirstNightReminder').press('Tab');

    // Default export=true → ordinal span should NOT have 'dim'.
    await page.locator('#firstNightTabBtn').click();
    // The dim class is applied to the .ordinal <span> inside the list item row.
    const ordinalSpan = page.locator('#firstNightOrderList > li').first().locator('.ordinal');
    await expect(ordinalSpan).not.toHaveClass(/\bdim\b/);

    // Toggle export off.
    await page.locator('#charTabBtn').click();
    const exportCheckbox = page.locator('#characterExport');
    if (await exportCheckbox.isChecked().catch(() => false)) {
      await exportCheckbox.uncheck();
    }

    await page.locator('#firstNightTabBtn').click();
    await expect(ordinalSpan).toHaveClass(/\bdim\b/);
  } finally {
    await deleteTestUser(request, user);
  }
});
