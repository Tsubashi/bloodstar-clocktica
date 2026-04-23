import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('reset image settings restores defaults', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Expand the Style settings details so the controls are interactable.
    await page.locator('summary', { hasText: 'Style settings' }).click();

    const colorize = page.locator('#shouldColorize');
    const border = page.locator('#useBorder');
    await expect(colorize).toBeChecked();
    await colorize.uncheck();
    await expect(border).toBeChecked();
    await border.uncheck();

    await page.locator('#resetImageSettings').click();

    // If reset pops a confirmation dialog, accept it. Otherwise this is a no-op.
    const confirm = page.getByRole('dialog').filter({ hasText: /sure|reset/i });
    if (await confirm.isVisible({ timeout: 500 }).catch(() => false)) {
      await confirm.getByRole('button', { name: /^(Yes|OK|Reset|Confirm)$/i }).click();
    }

    await expect(colorize).toBeChecked({ timeout: 5_000 });
    await expect(border).toBeChecked();
  } finally {
    await deleteTestUser(request, user);
  }
});
