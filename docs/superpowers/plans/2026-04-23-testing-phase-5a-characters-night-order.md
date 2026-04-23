# Testing — Phase 5a: Playwright Characters + Night-Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Playwright E2E suite with two spec groups — `characters/` and `night-order/` — covering the core edition-editing flows that Phase 4 left untouched.

**Architecture:** Same fixtures as Phase 4 (`tests/e2e/fixtures/` — `test`, `expect`, `createTestUser`, `injectSession`, etc.). Specs create a scratch user + edition, exercise the UI, assert against DOM state. Post-test, `scripts/test-stack.sh leak-check` verifies no residue.

**Tech Stack:** Playwright 1.59, existing Docker test stack, existing CI workflow (integration.yml's `playwright-e2e` job auto-runs new specs).

**Scope (Phase 5a only):** characters (add/remove/rename/team/ability/reorder/id-regen ~7 specs), night-order (first-night reorder, other-night independence, export-dim, reminder-clear ~4 specs). ~11 specs total.

**Explicit non-scope (per recon findings):**
- **Character filter/search** — NOT implemented in the codebase. No spec.
- **200-character ability limit** — NOT enforced. No spec (would be speculative — if added later, a test documenting the limit belongs in the PR that adds it).
- **Minion/Demon info thresholds** — NOT implemented beyond the existing export/reminder dimming. No spec.

Deferred to **Phase 5b** (images + publish + dialogs) and **Phase 5c** (sharing + mobile).

**Spec reference:** [`docs/superpowers/specs/2026-04-20-testing-infrastructure-design.md`](../specs/2026-04-20-testing-infrastructure-design.md)

**User preference:** In auto mode, commit directly with `git commit --no-gpg-sign`.

---

## Key facts from recon

### Selector reference

**Tabs** (click to switch edition view):
- Meta: `#metaTabBtn` → `#metatab`
- Edit Character: `#charTabBtn` → `#charactertab`
- First Night: `#firstNightTabBtn` → `#firstNightOrderTab`
- Other Night: `#otherNightTabBtn` → `#otherNightOrderTab`

**Character pane (left side):**
- Character list (ordered): `#characterList`
- Character list items: `.characterListItem` (each an `<li>`)
- Add character button: `#addCharacterButton`

**Character editor (Edit Character tab):**
- Display name input: `#characterName`
- Generated ID (read-only display): `#characterId`
- Team dropdown (`<select>`): `#characterTeam` with values `townsfolk|outsider|minion|demon|traveller|fabled|jinxes`
- Ability text input: `#characterAbility`
- Special dropdown: `#characterSpecial` with values `none|showGrimoire|point`
- First-night reminder: `#characterFirstNightReminder`
- Other-night reminder: `#characterOtherNightReminder`
- Setup checkbox: `#characterSetup`
- Export checkbox: `#characterExport` (per recon it's bound but the ID may differ — verify during implementation)

**Night-order views:**
- First-night list: `#firstNightOrderList`
- Other-night list: `#otherNightOrderList`
- Each list item is an `<li>` with character thumbnail, ordinal text, character name, reminder text.
- Dimmed-out class on non-exported characters: `.dim`

**Delete button (dynamic):** `CollectionButtonsMgr` appends a Delete button per list item. Selector pattern TBD during implementation — likely a child of `.characterListItem` with text "Delete" or an `×` glyph. Inspect with UI mode if `getByRole('button', { name: /delete/i }).first()` doesn't resolve.

### Known gotchas

- **Drag-and-drop for reorder uses native HTML5 events.** Playwright's `locator.dragTo(target)` usually works but can be flaky in headless Chromium — fall back to `page.mouse.move(x,y) + mouse.down() + mouse.move() + mouse.up()` if needed. The app's drag handler lives in `src/bind/collection-binding.ts` and listens for `dragstart` / `dragover` / `drop` / `dragleave`.
- **Character list items have shrink/grow animations** (~200ms) on add/delete. Use Playwright's auto-waiting (`await expect(locator).toHaveCount(n)`) rather than raw `locator.count()`.
- **ID regenerates on name change.** `#characterId` updates automatically; watch for timing on the read-out.
- **Auto-save.** All character-editor property changes persist immediately via observable property binding. No explicit save action needed; reload-and-reopen round-trips the change through the server.

---

## Task 1: Characters — add a new character

Exercise the "add character" button; verify the list grows and the new character is auto-selected in the editor.

**Files:**
- Create: `tests/e2e/characters/add.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('user can add a new character to the edition', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();

    // A new edition auto-creates one default character. Add a second.
    await expect(page.locator('#characterList li.characterListItem')).toHaveCount(1);
    await page.locator('#addCharacterButton').click();
    await expect(page.locator('#characterList li.characterListItem')).toHaveCount(2);

    // The newest item is auto-selected. The editor's name field shows it.
    // Default name is "New Character" (per Phase 2 unit tests).
    await expect(page.locator('#characterName')).toHaveValue('New Character');

    // Add a third with a distinct name.
    await page.locator('#addCharacterButton').click();
    await expect(page.locator('#characterList li.characterListItem')).toHaveCount(3);
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run**

```bash
npm run test:e2e -- tests/e2e/characters/add.spec.ts
```

If `#characterList` has zero items after Create New (auto-creation is async), increase the wait: `await expect(...).toHaveCount(1, { timeout: 10_000 })`. If the default first-character name differs from "New Character", update to match actual default (Phase 2 confirmed it but in a unit, not E2E context).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/characters/add.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for adding a character"
```

---

## Task 2: Characters — rename updates the list

Changing the name in the editor should visibly update the list item, and the read-only `#characterId` should regenerate.

**Files:**
- Create: `tests/e2e/characters/rename.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('renaming a character updates the list item and regenerates the id', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();

    // Ensure a character is selected. The default one is "New Character".
    await page.locator('#charTabBtn').click();
    const nameInput = page.locator('#characterName');
    await expect(nameInput).toHaveValue('New Character');
    const idDisplay = page.locator('#characterId');
    const originalId = await idDisplay.inputValue().catch(async () => await idDisplay.textContent());

    // Rename and verify list + id update.
    await nameInput.fill('Washerwoman');
    // Commit the edit by blurring / pressing Tab so binding fires.
    await nameInput.press('Tab');

    await expect(page.locator('#characterList li.characterListItem').first()).toContainText('Washerwoman');

    // ID regenerates — should differ from before, and start with the sanitized name.
    const newId = await idDisplay.inputValue().catch(async () => await idDisplay.textContent());
    expect(newId).not.toBe(originalId);
    expect((newId ?? '').toLowerCase()).toContain('washerwoman');
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run**

If `#characterId` is an `<input>`, use `inputValue()`. If it's a `<div>` or `<span>`, use `textContent()`. The spec handles both with `.catch()`. If neither resolves, inspect with UI mode.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/characters/rename.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for character rename + id regeneration"
```

---

## Task 3: Characters — change team applies color

Changing the team dropdown should re-color the character in the list (the team-color CSS class attaches to `.characterListItem`).

**Files:**
- Create: `tests/e2e/characters/change-team.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('changing team updates the character list item styling', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    const listItem = page.locator('#characterList li.characterListItem').first();

    // Default team on a new character is 'townsfolk'.
    await expect(page.locator('#characterTeam')).toHaveValue('townsfolk');

    // Change to 'demon'
    await page.locator('#characterTeam').selectOption('demon');

    // The list item should get a team-related class. Exact class name comes
    // from src/team-color.ts — inspect if the regex below doesn't match.
    await expect(listItem).toHaveClass(/demon|team-demon|bloodteam-demon/);

    // And back to outsider
    await page.locator('#characterTeam').selectOption('outsider');
    await expect(listItem).toHaveClass(/outsider|team-outsider|bloodteam-outsider/);
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + iterate**

If the class-name regex doesn't match, read `src/team-color.ts` for the actual CSS class naming. Update the regex to match. The regex is deliberately permissive to handle different naming conventions.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/characters/change-team.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for changing character team"
```

---

## Task 4: Characters — edit ability text persists via save/reload

Set ability text, save, reload, reopen. The ability should round-trip.

**Files:**
- Create: `tests/e2e/characters/ability-persists.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(90_000);

test('ability text persists through save + reload + reopen', async ({ request, page }) => {
  const user = await createTestUser(request);
  const ability = 'You start knowing a good player.';
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    await page.locator('#characterAbility').fill(ability);
    await page.locator('#characterAbility').press('Tab');

    // Save under a known name.
    await page.keyboard.press('Control+s');
    const saveDialog = page.getByRole('dialog');
    await saveDialog.getByRole('textbox').fill('ability-persist');
    await saveDialog.getByRole('button', { name: 'OK' }).click();

    // Wait for server-side save to complete.
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'ability-persist' },
      });
      return await r.text();
    }, { timeout: 15000 }).toBe('true');

    // Clear in-memory state and reopen.
    await page.evaluate(() => localStorage.removeItem('recentFile'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Open Existing' }).click();
    await page.getByRole('button', { name: 'ability-persist' }).click();

    // Navigate to Edit Character and assert the ability round-tripped.
    await page.locator('#charTabBtn').click();
    await expect(page.locator('#characterAbility')).toHaveValue(ability);
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run**

If the "Open Existing" button doesn't appear (e.g., because `localStorage.removeItem('recentFile')` was called too early or the welcome dialog has different wording), inspect with UI mode. Alternative entry: click the File menu's Open button (`#openFileButton`) after the page has loaded and dismissed any welcome dialog.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/characters/ability-persists.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for character ability round-trip"
```

---

## Task 5: Characters — delete with confirmation

Click a character's delete button, confirm the dialog, verify removal from the list.

**Files:**
- Create: `tests/e2e/characters/delete.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('deleting a character removes it from the list', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Add a second character so we can delete one without emptying the list.
    await page.locator('#addCharacterButton').click();
    await expect(page.locator('#characterList li.characterListItem')).toHaveCount(2);

    // Locate a delete trigger inside the first list item.
    // CollectionButtonsMgr renders these dynamically — try role=button w/
    // "delete" text first; fall back to a common glyph selector.
    const firstItem = page.locator('#characterList li.characterListItem').first();
    const deleteBtn = firstItem.getByRole('button', { name: /delete|remove|×/i }).first();
    await deleteBtn.click();

    // Confirmation dialog (yes-no-dlg pattern).
    const confirmDlg = page.getByRole('dialog').filter({ hasText: /sure|delete/i });
    await confirmDlg.getByRole('button', { name: /^(Yes|Delete|OK|Confirm)$/i }).click();

    // List shrinks by one.
    await expect(page.locator('#characterList li.characterListItem')).toHaveCount(1);
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + iterate**

The delete button selector and confirmation wording are the two most likely mismatch points. Inspect with UI mode and update as needed. If the per-item button isn't a proper `role=button`, fall back to `firstItem.locator('.delete-btn, .remove-btn, [aria-label*="delete" i]')` or inspect for the exact CSS class.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/characters/delete.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for character delete with confirmation"
```

---

## Task 6: Characters — drag-and-drop reorder

Add three characters, drag the third above the first, verify the list order.

**Files:**
- Create: `tests/e2e/characters/reorder.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('user can reorder characters via drag-and-drop', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Rename default + add two more with distinct names for identification.
    await page.locator('#characterName').fill('Alpha');
    await page.locator('#characterName').press('Tab');

    await page.locator('#addCharacterButton').click();
    await expect(page.locator('#characterList li.characterListItem')).toHaveCount(2);
    await page.locator('#characterName').fill('Bravo');
    await page.locator('#characterName').press('Tab');

    await page.locator('#addCharacterButton').click();
    await expect(page.locator('#characterList li.characterListItem')).toHaveCount(3);
    await page.locator('#characterName').fill('Charlie');
    await page.locator('#characterName').press('Tab');

    // Initial order: Alpha, Bravo, Charlie
    const items = page.locator('#characterList li.characterListItem');
    await expect(items.nth(0)).toContainText('Alpha');
    await expect(items.nth(2)).toContainText('Charlie');

    // Drag Charlie (3rd) above Alpha (1st).
    // HTML5 drag-and-drop — Playwright's .dragTo is the first try.
    await items.nth(2).dragTo(items.nth(0));

    // After drop: Charlie should be at index 0.
    await expect(items.nth(0)).toContainText('Charlie');
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run**

If `dragTo()` doesn't fire the app's drag handlers (headless Chromium can be picky about synthetic drag events), fall back to manual mouse control:

```typescript
const source = await items.nth(2).boundingBox();
const target = await items.nth(0).boundingBox();
if (!source || !target) throw new Error('no bounding box');
await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
await page.mouse.down();
// Chromium needs at least 2 mouse-moves to actually trigger dragstart.
await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2 - 20, { steps: 10 });
await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
await page.mouse.up();
```

If reorder still doesn't take, the app may require the drag source to also dispatch a `dragend` event. Flag as DONE_WITH_CONCERNS and document.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/characters/reorder.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for character drag-reorder"
```

---

## Task 7: Night-order — first-night reorder is independent from character-list order

Add three characters, reorder in the first-night view, verify the character-list order stays as-is.

**Files:**
- Create: `tests/e2e/night-order/first-night-reorder.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('first-night drag-reorder is independent from character-list order', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Create three named characters, each with a first-night reminder so they
    // appear in the night-order view (characters without reminders show '-').
    for (const name of ['Alpha', 'Bravo', 'Charlie']) {
      // First iteration: rename the default character. Subsequent: add then rename.
      if (name !== 'Alpha') {
        await page.locator('#addCharacterButton').click();
      }
      await page.locator('#characterName').fill(name);
      await page.locator('#characterName').press('Tab');
      await page.locator('#characterFirstNightReminder').fill(`${name} reminder`);
      await page.locator('#characterFirstNightReminder').press('Tab');
    }
    await expect(page.locator('#characterList li.characterListItem')).toHaveCount(3);

    // Switch to First Night view
    await page.locator('#firstNightTabBtn').click();
    const firstNightItems = page.locator('#firstNightOrderList > li');
    await expect(firstNightItems).toHaveCount(3);

    // Initial order in first-night matches character-list order.
    await expect(firstNightItems.nth(0)).toContainText('Alpha');
    await expect(firstNightItems.nth(2)).toContainText('Charlie');

    // Drag Charlie above Alpha in the first-night view.
    await firstNightItems.nth(2).dragTo(firstNightItems.nth(0));

    // First-night order now shows Charlie first.
    await expect(firstNightItems.nth(0)).toContainText('Charlie');

    // But the CHARACTER LIST order should be unchanged.
    await page.locator('#charTabBtn').click();
    const charItems = page.locator('#characterList li.characterListItem');
    await expect(charItems.nth(0)).toContainText('Alpha');
    await expect(charItems.nth(2)).toContainText('Charlie');
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + iterate**

Same drag-and-drop fallback as Task 6 applies. If items are listed but clicking `#firstNightTabBtn` doesn't show them, the reminder-text gate may be stricter than expected — inspect with UI mode and adjust.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/night-order/first-night-reorder.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for first-night reorder independence"
```

---

## Task 8: Night-order — other-night reorder is independent from first-night

Second independence check: reordering other-night doesn't disturb first-night order.

**Files:**
- Create: `tests/e2e/night-order/other-night-independent.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('other-night reorder is independent from first-night order', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Three characters with BOTH night reminders so both views are populated.
    for (const name of ['Alpha', 'Bravo', 'Charlie']) {
      if (name !== 'Alpha') {
        await page.locator('#addCharacterButton').click();
      }
      await page.locator('#characterName').fill(name);
      await page.locator('#characterName').press('Tab');
      await page.locator('#characterFirstNightReminder').fill(`${name} first`);
      await page.locator('#characterFirstNightReminder').press('Tab');
      await page.locator('#characterOtherNightReminder').fill(`${name} other`);
      await page.locator('#characterOtherNightReminder').press('Tab');
    }

    // Reorder other-night: Charlie → first.
    await page.locator('#otherNightTabBtn').click();
    const otherItems = page.locator('#otherNightOrderList > li');
    await expect(otherItems).toHaveCount(3);
    await otherItems.nth(2).dragTo(otherItems.nth(0));
    await expect(otherItems.nth(0)).toContainText('Charlie');

    // First-night order unchanged.
    await page.locator('#firstNightTabBtn').click();
    const firstItems = page.locator('#firstNightOrderList > li');
    await expect(firstItems.nth(0)).toContainText('Alpha');
    await expect(firstItems.nth(2)).toContainText('Charlie');
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/night-order/other-night-independent.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for other-night reorder independence"
```

---

## Task 9: Night-order — non-exported characters are dimmed

Setting `export=false` on a character dims it in the night-order view (CSS class `.dim` per recon).

**Files:**
- Create: `tests/e2e/night-order/non-exported-dimmed.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('non-exported characters appear dimmed in night-order view', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Default character: rename + add a reminder so it shows in night-order.
    await page.locator('#characterName').fill('Alpha');
    await page.locator('#characterName').press('Tab');
    await page.locator('#characterFirstNightReminder').fill('Alpha first');
    await page.locator('#characterFirstNightReminder').press('Tab');

    // By default export=true → not dimmed.
    await page.locator('#firstNightTabBtn').click();
    const firstItem = page.locator('#firstNightOrderList > li').first();
    await expect(firstItem).not.toHaveClass(/\bdim\b/);

    // Toggle export off.
    await page.locator('#charTabBtn').click();
    // The export checkbox selector: `#characterExport` is the documented
    // name. If the actual DOM uses a different id, find it via the label
    // text "Export" in UI mode and update.
    const exportCheckbox = page.locator('#characterExport');
    if (await exportCheckbox.isChecked().catch(() => false)) {
      await exportCheckbox.uncheck();
    }

    // Dimmed now.
    await page.locator('#firstNightTabBtn').click();
    await expect(firstItem).toHaveClass(/\bdim\b/);
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

If `#characterExport` doesn't resolve, try `page.getByLabel(/export/i).first()` or read `src/character-tab.ts` for the actual ID. If the `.dim` class doesn't appear, read `src/night-order.ts` for the actual class name (recon says `dim` but verify).

```bash
git add tests/e2e/night-order/non-exported-dimmed.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for non-exported character dimming"
```

---

## Task 10: Night-order — characters without reminder show '-' ordinal

Per recon: `updateOrdinals()` sets ordinal to `-` when reminder is empty.

**Files:**
- Create: `tests/e2e/night-order/no-reminder-dash.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('character without a first-night reminder shows "-" ordinal', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    await page.locator('#characterName').fill('NoReminder');
    await page.locator('#characterName').press('Tab');
    // Deliberately leave #characterFirstNightReminder blank.

    await page.locator('#firstNightTabBtn').click();
    const item = page.locator('#firstNightOrderList > li').first();
    // The ordinal text is a child element. Recon says it's rendered as a
    // literal "-". Exact selector for the ordinal span/div is unspecified
    // — use a text-contains assertion on the item.
    await expect(item).toContainText('-');
    await expect(item).not.toContainText(/\b1st\b/);

    // Now add a reminder → ordinal becomes "1st".
    await page.locator('#charTabBtn').click();
    await page.locator('#characterFirstNightReminder').fill('Now visible');
    await page.locator('#characterFirstNightReminder').press('Tab');

    await page.locator('#firstNightTabBtn').click();
    await expect(item).toContainText('1st');
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/night-order/no-reminder-dash.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for empty-reminder ordinal handling"
```

---

## Task 11: Full-suite verification

Behavioral — no new files.

- [ ] **Step 1: Clean slate + full run**

```bash
./scripts/test-stack.sh down 2>/dev/null || true
time npm run test:e2e
```

Expected: 26 specs (15 from Phase 4 + 11 new) all green. Cold-start under 5 min; warm under 90s.

- [ ] **Step 2: Full test-all chain**

```bash
npm run test:all
```

Expected: Vitest (88 tests) → Hurl (20 files / 187 requests) → Playwright (26 specs) — all green, leak check clean on both.

- [ ] **Step 3: Optional tag**

```bash
git tag testing/phase-5a-complete
```

---

## Acceptance criteria for Phase 5a

1. `npm run test:e2e` exits 0 with 26 specs green.
2. `npm run test:all` chains all three test layers, leak check clean on both E2E runs.
3. No production source modified — Phase 5a is purely additive.
4. Each spec uses `getByRole`/`getByLabel` where possible; `#id` selectors only where no accessible handle exists.
5. Every spec is self-contained — creates + deletes its own scratch user via `createTestUser`/`deleteTestUser`.
6. Workers still == 1 (mailhog inbox serial-access constraint unchanged).

## Out of scope

- Images (upload/crop) — **Phase 5b**.
- Publish UI — **Phase 5b** (API layer already covered).
- Dialogs ARIA coverage — **Phase 5b**.
- Sharing UI — **Phase 5c** (API layer already covered).
- Mobile / `m.html` — **Phase 5c**.
- Filter/search characters — NOT implemented; no spec.
- 200-char ability limit — NOT enforced; no spec.
- Minion/Demon info thresholds — NOT implemented; no spec.

## Anticipated gotchas

- **Drag-and-drop flakiness.** `locator.dragTo()` is the first try; manual `page.mouse` fallback is documented in Task 6. If three or more reorder-based specs flake in a row, the app's drag handler likely needs a `dragend` event that Playwright doesn't fire automatically — investigate at that point rather than prophylactically.
- **Press('Tab') to commit edits.** All field edits use observable property binding that fires on blur. Specs call `.press('Tab')` after `.fill()` to trigger the bind cycle. If a spec shows stale values, the Tab step is missing.
- **Default character naming.** A fresh edition from Create-New auto-creates one character named "New Character" (confirmed in Phase 2 unit tests). Specs that add-then-rename start from that.
- **First-night list only shows characters with a first-night reminder.** Empty reminder → ordinal is `-` but the item still appears. Double-check behavior on first run; if items with empty reminders DON'T appear, adjust Task 10.
