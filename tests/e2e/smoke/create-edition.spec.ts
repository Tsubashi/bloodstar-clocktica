import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, injectSession } from '../fixtures';

test('signed-in user can create a new edition', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');

    // The initial new-or-open dialog has a "Create New" button.
    await page.getByRole('button', { name: 'Create New' }).click();

    // The editor loads. After Create New the app auto-selects "Edit Character"
    // tab, so click the Meta tab button to make #metatab visible.
    await page.locator('#metaTabBtn').click();
    await expect(page.locator('#metatab')).toBeVisible();
  } finally {
    await deleteTestUser(request, user);
  }
});
