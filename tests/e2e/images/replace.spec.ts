import * as path from 'node:path';
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

const RED_PNG = path.join(__dirname, '..', 'fixtures', 'images', 'red-64.png');
const BLUE_PNG = path.join(__dirname, '..', 'fixtures', 'images', 'blue-64.png');

test('uploading again replaces the previous character image', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Disable restyling so the styled-image src reflects the raw upload.
    // With restyle on, the team-colorize step overrides the original image
    // colors and red/blue uploads produce indistinguishable outputs.
    await page.locator('summary', { hasText: 'Style settings' }).click();
    await page.locator('#shouldRestyle').uncheck();

    const preview = page.locator('#characterStyledImageDisplay');
    const spinner = page.locator('#characterImagePreviewSpinner');
    const input = page.locator('#characterUnstyledImageInput');

    await input.setInputFiles(RED_PNG);
    await expect(spinner).toBeHidden({ timeout: 20_000 });
    await expect(preview).toHaveAttribute('src', /^data:image\//, { timeout: 10_000 });
    const srcAfterRed = await preview.getAttribute('src');
    expect((srcAfterRed ?? '').length).toBeGreaterThan(100);

    await input.setInputFiles(BLUE_PNG);
    await expect(spinner).toBeHidden({ timeout: 20_000 });
    await expect(preview).toHaveAttribute('src', /^data:image\//, { timeout: 10_000 });
    // Poll until the data-URI changes — the styled image is recomputed async.
    await expect.poll(async () => (await preview.getAttribute('src')) ?? '', { timeout: 10_000 })
      .not.toBe(srcAfterRed ?? '');
  } finally {
    await deleteTestUser(request, user);
  }
});
