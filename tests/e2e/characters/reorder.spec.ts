import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('user can reorder characters via drag-and-drop', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Rename default + add two more
    await page.locator('#characterName').fill('Alpha');
    await page.locator('#characterName').press('Tab');

    await page.locator('#addCharacterButton').click();
    await expect(page.locator('#characterList .characterListItem')).toHaveCount(2);
    await page.locator('#characterName').fill('Bravo');
    await page.locator('#characterName').press('Tab');

    await page.locator('#addCharacterButton').click();
    await expect(page.locator('#characterList .characterListItem')).toHaveCount(3);
    await page.locator('#characterName').fill('Charlie');
    await page.locator('#characterName').press('Tab');

    // Initial order: Alpha, Bravo, Charlie
    const items = page.locator('#characterList .characterListItem');
    await expect(items.nth(0)).toContainText('Alpha');
    await expect(items.nth(1)).toContainText('Bravo');
    await expect(items.nth(2)).toContainText('Charlie');

    // The actual draggable elements are <li> parents of .characterListItem divs.
    // Drag Charlie (index 2) above Alpha (index 0) using page.evaluate to fire
    // native drag events, which is the most reliable approach for headless Chromium.
    await page.evaluate(() => {
      const list = document.querySelector('#characterList');
      if (!list) throw new Error('characterList not found');

      const liItems = Array.from(list.querySelectorAll('li'));
      if (liItems.length < 3) throw new Error(`expected 3 li items, got ${liItems.length}`);

      const source = liItems[2]; // Charlie
      const target = liItems[0]; // Alpha

      const sourceRect = source.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const sourceX = sourceRect.x + sourceRect.width / 2;
      const sourceY = sourceRect.y + sourceRect.height / 2;
      const targetX = targetRect.x + targetRect.width / 2;
      const targetY = targetRect.y + targetRect.height / 4; // upper quarter = insert before

      // Fire dragstart on source to set this.dragged
      const dt = new DataTransfer();
      source.dispatchEvent(new DragEvent('drag',      { bubbles: true, cancelable: true, clientX: sourceX, clientY: sourceY, dataTransfer: dt }));
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, clientX: sourceX, clientY: sourceY, dataTransfer: dt }));

      // Fire dragover on target to mark it as drop zone
      target.dispatchEvent(new DragEvent('dragover',  { bubbles: true, cancelable: true, clientX: targetX, clientY: targetY, dataTransfer: dt }));

      // Fire drop on target
      target.dispatchEvent(new DragEvent('drop',      { bubbles: true, cancelable: true, clientX: targetX, clientY: targetY, dataTransfer: dt }));

      // Fire dragend on source
      source.dispatchEvent(new DragEvent('dragend',   { bubbles: true, cancelable: true, clientX: targetX, clientY: targetY, dataTransfer: dt }));
    });

    // Verify reorder: Charlie should now be at index 0
    await expect(items.nth(0)).toContainText('Charlie', { timeout: 5_000 });
    await expect(items.nth(1)).toContainText('Alpha');
    await expect(items.nth(2)).toContainText('Bravo');
  } finally {
    await deleteTestUser(request, user);
  }
});
