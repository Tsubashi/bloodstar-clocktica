import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

// Browser-side API calls hit a hardcoded https://bloodstar.clocktica.com
// origin; the `test` fixture from '../fixtures' intercepts and reroutes
// them to localhost, so specs don't need per-file page.route() calls.

test('user can create an edition and save it with Ctrl+S', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    // After Create New the app auto-selects "Edit Character" tab; click Meta
    // to make #metatab visible before triggering the save.
    await page.locator('#metaTabBtn').click();
    await expect(page.locator('#metatab')).toBeVisible();

    // Trigger save via Ctrl+S. First save shows a name prompt.
    await page.keyboard.press('Control+s');
    const nameInput = page.getByRole('textbox').first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill('my-smoke-edition');
    await page.getByRole('button', { name: 'OK' }).click();

    // Assert via API that the save landed. Avoids flakiness in
    // post-save UI signals. Allow 15s for the server to complete the save.
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'my-smoke-edition' },
      });
      return await r.text();
    }, { timeout: 15000 }).toBe('true');
  } finally {
    await deleteTestUser(request, user);
  }
});
