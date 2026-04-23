import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, injectSession } from '../fixtures';

const PROD_API = 'https://bloodstar.clocktica.com/api/';
const LOCAL_API = 'http://localhost:8086/api/';

test('user can create an edition and save it with Ctrl+S', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    // The app has a hardcoded production API URL. Intercept browser-side API
    // calls and proxy them to the local test server so saves actually land.
    await page.route(`${PROD_API}**`, async (route) => {
      const url = route.request().url().replace(PROD_API, LOCAL_API);
      const response = await route.fetch({ url });
      await route.fulfill({ response });
    });

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

    // Assert via API that the save landed. This avoids flakiness in
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
