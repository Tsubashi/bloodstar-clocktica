import * as path from 'node:path';
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

const RED_PNG = path.join(__dirname, '..', 'fixtures', 'images', 'red-64.png');

test('user can remove a character image via the remove button', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    const preview = page.locator('#characterStyledImageDisplay');
    await page.locator('#characterUnstyledImageInput').setInputFiles(RED_PNG);
    await expect(page.locator('#characterImagePreviewSpinner')).toBeHidden({ timeout: 20_000 });
    await expect(preview).toHaveAttribute('src', /^data:image\//, { timeout: 10_000 });

    await page.locator('#characterImageRemoveBtn').click();
    await expect(preview).not.toHaveAttribute('src', /^data:image\//, { timeout: 10_000 });
  } finally {
    await deleteTestUser(request, user);
  }
});
