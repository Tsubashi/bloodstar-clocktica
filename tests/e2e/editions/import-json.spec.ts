import * as path from 'node:path';
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

const SAMPLE_PATH = path.join(__dirname, '..', 'fixtures', 'sample-edition.json');

test('user can import an edition from a JSON file', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');

    // Dismiss welcome dialog if present
    const createNew = page.getByRole('button', { name: 'Create New' });
    if (await createNew.isVisible().catch(() => false)) {
      await createNew.click();
    }

    // Navigate the Import > From JSON > From File menu hierarchy.
    // The button triggers an intermediate "Choose file" dialog with a
    // "Choose File" button that THEN opens the OS file picker.
    await page.locator('#app #menu .dropdown').filter({ hasText: 'Import' }).hover();
    await page.locator('#app #menu').getByText('From JSON').hover();
    await page.locator('#jsonFromFileButton').click();

    // An intermediate dialog appears: click its "Choose File" button to
    // trigger the real OS file-chooser event that Playwright can intercept.
    const fcPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose File' }).click();
    const fc = await fcPromise;
    await fc.setFiles(SAMPLE_PATH);

    // The app shows a "Choose characters to import" dialog.
    // Click "Select All" to check every character, then import.
    await page.getByRole('button', { name: 'Select All', exact: true }).click();
    // The import button text changes to "Import N Characters".
    await page.getByRole('button', { name: /Import \d+ Characters/ }).click();

    // Activate Meta tab so the imported name becomes visible.
    await page.locator('#metaTabBtn').click();
    await expect(page.locator('#metatab')).toBeVisible();

    // The edition name "Imported Edition" is stored in the #metaName text input.
    await expect(page.locator('#metaName')).toHaveValue('Imported Edition', { timeout: 10_000 });
  } finally {
    await deleteTestUser(request, user);
  }
});
