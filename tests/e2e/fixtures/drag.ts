// Helper for simulating native HTML5 drag-and-drop reorder in a Playwright
// page. The app's CollectionBinding listens for `drag` (before `dragstart`
// to set the internal dragged state), `dragstart`, `dragover`, `drop`, and
// `dragend`. Playwright's high-level `locator.dragTo()` and `page.mouse`
// APIs don't reliably fire this sequence in headless Chromium, so we
// dispatch the events directly via `page.evaluate()`.

import { Page } from '@playwright/test';

/**
 * Reorder a draggable list item by dispatching native HTML5 drag events.
 *
 * @param page           the Playwright Page
 * @param listSelector   CSS selector for the list container (ol/ul or similar)
 * @param fromIndex      0-based index of the item to move
 * @param toIndex        0-based index where it should land
 * @param itemSelector   CSS selector relative to the list. Defaults to 'li'
 *                       since CollectionBinding attaches listeners to the
 *                       `<li>` parent, not to inner content divs.
 */
export async function dragListItem(
  page: Page,
  listSelector: string,
  fromIndex: number,
  toIndex: number,
  itemSelector = 'li',
): Promise<void> {
  await page.evaluate(
    (args) => {
      const { listSelector, fromIndex, toIndex, itemSelector } = args;
      const list = document.querySelector(listSelector);
      if (!list) throw new Error(`list not found: ${listSelector}`);

      const items = Array.from(list.querySelectorAll(itemSelector)) as HTMLElement[];
      if (fromIndex < 0 || fromIndex >= items.length) {
        throw new Error(`fromIndex ${fromIndex} out of range (list has ${items.length} items)`);
      }
      if (toIndex < 0 || toIndex >= items.length) {
        throw new Error(`toIndex ${toIndex} out of range (list has ${items.length} items)`);
      }

      const source = items[fromIndex];
      const target = items[toIndex];
      const sourceRect = source.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const sourceX = sourceRect.x + sourceRect.width / 2;
      const sourceY = sourceRect.y + sourceRect.height / 2;
      const targetX = targetRect.x + targetRect.width / 2;
      // Upper quarter of the target → "insert before" per collection-binding.
      // Lower three-quarters → "insert after". Pick based on direction.
      const insertBefore = fromIndex > toIndex;
      const targetY = insertBefore
        ? targetRect.y + targetRect.height / 4
        : targetRect.y + (targetRect.height * 3) / 4;

      const dt = new DataTransfer();
      const common = { bubbles: true, cancelable: true, dataTransfer: dt };

      // `drag` first: CollectionBinding uses this to set `this.dragged = li`.
      source.dispatchEvent(new DragEvent('drag', { ...common, clientX: sourceX, clientY: sourceY }));
      source.dispatchEvent(new DragEvent('dragstart', { ...common, clientX: sourceX, clientY: sourceY }));
      target.dispatchEvent(new DragEvent('dragover', { ...common, clientX: targetX, clientY: targetY }));
      target.dispatchEvent(new DragEvent('drop', { ...common, clientX: targetX, clientY: targetY }));
      source.dispatchEvent(new DragEvent('dragend', { ...common, clientX: targetX, clientY: targetY }));
    },
    { listSelector, fromIndex, toIndex, itemSelector },
  );
}
