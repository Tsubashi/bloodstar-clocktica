import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('changing team updates the character list item styling', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    const listItem = page.locator('#characterList .characterListItem').first();
    await expect(page.locator('#characterTeam')).toHaveValue('townsfolk');

    await page.locator('#characterTeam').selectOption('demon');
    // Team CSS classes are teamColorDemon, teamColorOutsider, etc.
    await expect(listItem).toHaveClass(/teamColorDemon/);

    await page.locator('#characterTeam').selectOption('outsider');
    await expect(listItem).toHaveClass(/teamColorOutsider/);
  } finally {
    await deleteTestUser(request, user);
  }
});
