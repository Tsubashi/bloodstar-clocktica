import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('user can add a new character to the edition', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();

    // A new edition auto-creates one default character.
    // Items are <div class="characterListItem"> (not <li>) inside the <ol#characterList>.
    await expect(page.locator('#characterList .characterListItem')).toHaveCount(1, { timeout: 10_000 });

    await page.locator('#addCharacterButton').click();
    await expect(page.locator('#characterList .characterListItem')).toHaveCount(2);

    // Newest is auto-selected. Default name is "New Character" (confirmed in Phase 2 unit tests).
    await expect(page.locator('#characterName')).toHaveValue('New Character');

    await page.locator('#addCharacterButton').click();
    await expect(page.locator('#characterList .characterListItem')).toHaveCount(3);
  } finally {
    await deleteTestUser(request, user);
  }
});
