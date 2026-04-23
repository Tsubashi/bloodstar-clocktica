import * as path from 'node:path';
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

const RED_PNG = path.join(__dirname, '..', 'fixtures', 'images', 'red-64.png');

test('user can upload a character image', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    await page.locator('#characterUnstyledImageInput').setInputFiles(RED_PNG);

    // Wait for the spinner to disappear (signals processing completed).
    await expect(page.locator('#characterImagePreviewSpinner')).toBeHidden({ timeout: 20_000 });

    // The styled image src should be a non-trivial data URI after upload.
    const preview = page.locator('#characterStyledImageDisplay');
    await expect(preview).toHaveAttribute('src', /^data:image\//, { timeout: 10_000 });
    const src = await preview.getAttribute('src');
    expect((src ?? '').length).toBeGreaterThan(100);
  } finally {
    await deleteTestUser(request, user);
  }
});
