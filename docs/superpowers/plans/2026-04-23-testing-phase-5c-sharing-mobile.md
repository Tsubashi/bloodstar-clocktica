# Testing — Phase 5c: Playwright Sharing + Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Playwright E2E suite with two final Phase-5 spec groups — `sharing/` (UI layer over the already-Hurl-tested share/unshare/block/unblock API) and `mobile/` (basic m.html curtain-menu behavior).

**Architecture:** Same fixtures as Phase 4/5a/5b. Sharing specs use two scratch users (owner + sharee) via `createTestUser`. Mobile specs navigate directly to `/m.html` — the app uses UA-based mobile detection, not viewport-based, so Playwright navigates the path rather than emulating a device.

**Tech Stack:** Playwright 1.59, existing Docker test stack.

**Scope (Phase 5c only):** ~7 specs (4 sharing + 3 mobile).

**Explicit non-scope:**
- **Re-running edition CRUD under mobile viewport** — the desktop and mobile builds share 95% of the code and all dialogs. Phase 4's coverage translates directly; re-running 15 specs "but on mobile" would be duplicative.
- **Full block-dialog copy verification** — recon noted the block/unblock title has a latent bug ("Block" for both). Tests capture current behavior, don't chase the bug.

After Phase 5c: Phase 5 is complete. Phase 6 (nightly Firefox + WebKit matrix) is the remaining spec item.

**Spec reference:** [`docs/superpowers/specs/2026-04-20-testing-infrastructure-design.md`](../specs/2026-04-20-testing-infrastructure-design.md)

**User preference:** Auto mode — `git commit --no-gpg-sign`.

---

## Key facts from recon

### Sharing UI selectors

- Sharing menu button: `#sharingButton` (inside the Sharing dropdown; requires a saved edition first).
- Blocked-users button: `#blockedUsersButton` (same dropdown; no saved-edition requirement).
- Sharing dialog ID: `#sharing-dlg<N>` (global counter) — use `getByRole('dialog').filter({ hasText: /Share/i })`.
- Inside sharing dialog: a list container (`div.shareDlgList`) with one row per shared user (format: `<span>username</span> <button>Remove</button>`), plus an "Add User" button.
- Add-user subdialog ID: `#share-with-user<N>`. Contains `#shareWithUserDlgUsername` input and `#shareWithUserButton` submit.
- Blocked-users dialog ID: `#manage-blocked-dlg<N>`. Same `div.shareDlgList` structure with `<span>` + `<button>Unblock</button>` rows.
- Block-user subdialog: `#block-prompt<N>` with `#blockPromptUsername` and `#blockUserButton`.

### Mobile selectors

- Mobile entry URL: `/m.html`. Navigate directly — don't rely on viewport emulation (mobile detection is UA-based in `src/main.ts`).
- Hamburger: `#mobileHamburger` opens `#mobileMainMenu` (a `curtainMenu` div).
- Mobile file menu: `#mobileFileButton` (inside main menu) opens `#mobileFileMenu`.
- Mobile import menu: `#mobileImportButton` → `#mobileImportMenu`.
- Mobile publish menu: `#mobilePublishButton` → `#mobilePublishMenu`.
- Mobile sharing menu: `#mobileSharingButton` → `#mobileSharingMenu`.
- Close curtain: `.closeCurtainBtn` inside each curtain menu, or Escape key.
- Inside each mobile curtain are the same desktop buttons (e.g., `#sharingButton`, `#blockedUsersButton`, `#newFileButton`).
- Curtain state: `open="true"` attribute on the `<div class="curtainMenu">` element.

### Known gotchas

- **Sharing dialog Remove buttons are created dynamically** after each add/remove — re-query by row index after each mutation rather than caching the locator.
- **Mobile curtain auto-closes on action** — after clicking a button inside a curtain, the curtain closes. If the spec needs the curtain to stay open, click the item with `.click({ noWaitAfter: true })` or assert on the dialog that opens, not on the curtain remaining.
- **Two-user setups** — sharing specs need owner + sharee. Each created via `createTestUser`; each deleted in `finally`.
- **Mobile uses the same `localStorage['accessToken']`** as desktop — `injectSession` works identically against `/m.html`.

---

## Task 1: Sharing — open the dialog on a saved edition

**Files:**
- Create: `tests/e2e/sharing/open-dialog.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('user can open the sharing dialog on a saved edition', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Save first — sharing requires a saved edition.
    await page.keyboard.press('Control+s');
    const saveDlg = page.getByRole('dialog');
    await saveDlg.getByRole('textbox').fill('share-open');
    await saveDlg.getByRole('button', { name: 'OK' }).click();
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'share-open' },
      });
      return await r.text();
    }, { timeout: 15_000 }).toBe('true');

    // Open the Sharing dropdown and click Manage Share List.
    const sharingBtn = page.locator('#sharingButton');
    try {
      await sharingBtn.click({ timeout: 2_000 });
    } catch {
      await sharingBtn.locator('..').locator('..').hover();
      await sharingBtn.click();
    }

    // Sharing dialog appears. Initial share list is empty — dialog shows the
    // Add User button but no user rows.
    const dlg = page.getByRole('dialog').filter({ hasText: /Share/i });
    await expect(dlg).toBeVisible({ timeout: 5_000 });
    await expect(dlg.getByRole('button', { name: 'Add User' })).toBeVisible();
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

```bash
npm run test:e2e -- tests/e2e/sharing/open-dialog.spec.ts
git add tests/e2e/sharing/open-dialog.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for opening the sharing dialog"
```

---

## Task 2: Sharing — add a user to the share list

**Files:**
- Create: `tests/e2e/sharing/add-user.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(90_000);

test('owner can add a user to the share list', async ({ request, page }) => {
  const owner = await createTestUser(request);
  const sharee = await createTestUser(request);
  try {
    await injectSession(page, owner.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    await page.keyboard.press('Control+s');
    const saveDlg = page.getByRole('dialog');
    await saveDlg.getByRole('textbox').fill('add-user');
    await saveDlg.getByRole('button', { name: 'OK' }).click();
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: owner.session.token, saveName: 'add-user' },
      });
      return await r.text();
    }, { timeout: 15_000 }).toBe('true');

    // Open sharing dialog
    const sharingBtn = page.locator('#sharingButton');
    try { await sharingBtn.click({ timeout: 2_000 }); }
    catch { await sharingBtn.locator('..').locator('..').hover(); await sharingBtn.click(); }

    const shareDlg = page.getByRole('dialog').filter({ hasText: /Share/i });
    await expect(shareDlg).toBeVisible();
    await shareDlg.getByRole('button', { name: 'Add User' }).click();

    // Subdialog: enter sharee's username and submit
    await page.locator('#shareWithUserDlgUsername').fill(sharee.username);
    await page.locator('#shareWithUserButton').click();

    // Back in the sharing dialog — the list should show sharee's username.
    await expect(shareDlg.getByText(sharee.username)).toBeVisible({ timeout: 5_000 });

    // Cross-check via API that the share landed server-side.
    const getShared = await request.post('/api/get-shared.php', {
      data: { token: owner.session.token, saveName: 'add-user' },
    });
    const body = await getShared.json() as { users: string[] };
    expect(body.users).toContain(sharee.username);
  } finally {
    await deleteTestUser(request, owner);
    await deleteTestUser(request, sharee);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/sharing/add-user.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for adding a user via sharing dialog"
```

---

## Task 3: Sharing — remove a user from the share list

**Files:**
- Create: `tests/e2e/sharing/remove-user.spec.ts`

- [ ] **Step 1: Write the spec**

Set up the share via API (faster than clicking through Add twice); then remove via UI.

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(90_000);

test('owner can remove a user from the share list via the dialog', async ({ request, page }) => {
  const owner = await createTestUser(request);
  const sharee = await createTestUser(request);
  try {
    // Set up: owner saves and pre-shares via API
    await request.post('/api/save.php', {
      data: {
        token: owner.session.token,
        saveName: 'remove-test',
        edition: { meta: { name: 'Remove' } },
      },
    });
    await request.post('/api/share.php', {
      data: {
        token: owner.session.token,
        saveName: 'remove-test',
        user: sharee.username,
      },
    });

    await injectSession(page, owner.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Open Existing' }).click();
    await page.getByRole('button', { name: 'remove-test' }).click();

    const sharingBtn = page.locator('#sharingButton');
    try { await sharingBtn.click({ timeout: 2_000 }); }
    catch { await sharingBtn.locator('..').locator('..').hover(); await sharingBtn.click(); }

    const shareDlg = page.getByRole('dialog').filter({ hasText: /Share/i });
    await expect(shareDlg.getByText(sharee.username)).toBeVisible();

    // Click the Remove button in the sharee's row. The dialog contains one
    // row per shared user with a Remove button; there's exactly one now.
    await shareDlg.getByRole('button', { name: 'Remove' }).click();

    // Confirmation dialog (yes-no-dlg).
    const confirmDlg = page.getByRole('dialog').filter({ hasText: /sure|remove|unshare/i });
    if (await confirmDlg.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await confirmDlg.getByRole('button', { name: /^(Yes|Remove|OK|Confirm)$/i }).click();
    }

    // Sharee's row should be gone from the dialog.
    await expect(shareDlg.getByText(sharee.username)).toBeHidden({ timeout: 5_000 });

    // And the API should reflect the change.
    const getShared = await request.post('/api/get-shared.php', {
      data: { token: owner.session.token, saveName: 'remove-test' },
    });
    const body = await getShared.json() as { users: string[] };
    expect(body.users).not.toContain(sharee.username);
  } finally {
    await deleteTestUser(request, owner);
    await deleteTestUser(request, sharee);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/sharing/remove-user.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for removing a user from share list"
```

---

## Task 4: Sharing — block + unblock a user via the blocked-users dialog

**Files:**
- Create: `tests/e2e/sharing/block-unblock.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(90_000);

test('user can block and unblock another user via the menu dialog', async ({ request, page }) => {
  const user1 = await createTestUser(request);
  const user2 = await createTestUser(request);
  try {
    await injectSession(page, user1.session);
    await page.goto('/');
    // Dismiss welcome dialog
    const createNew = page.getByRole('button', { name: 'Create New' });
    if (await createNew.isVisible().catch(() => false)) await createNew.click();

    // Open blocked-users dialog — no saved edition required.
    const blockBtn = page.locator('#blockedUsersButton');
    try { await blockBtn.click({ timeout: 2_000 }); }
    catch { await blockBtn.locator('..').locator('..').hover(); await blockBtn.click(); }

    const dlg = page.getByRole('dialog').filter({ hasText: /Block/i });
    await expect(dlg).toBeVisible();

    // Click Block a User → enter user2 → submit
    await dlg.getByRole('button', { name: 'Block a User' }).click();
    await page.locator('#blockPromptUsername').fill(user2.username);
    await page.locator('#blockUserButton').click();

    // Row for user2 appears in the dialog.
    await expect(dlg.getByText(user2.username)).toBeVisible({ timeout: 5_000 });

    // Click Unblock for user2.
    await dlg.getByRole('button', { name: 'Unblock' }).click();
    const confirmDlg = page.getByRole('dialog').filter({ hasText: /sure|unblock/i });
    if (await confirmDlg.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await confirmDlg.getByRole('button', { name: /^(Yes|Unblock|OK|Confirm)$/i }).click();
    }

    await expect(dlg.getByText(user2.username)).toBeHidden({ timeout: 5_000 });

    // API-confirm: user1's block list is empty.
    const getBlocked = await request.post('/api/get-blocked.php', {
      data: { token: user1.session.token },
    });
    const body = await getBlocked.json() as { users: string[] };
    expect(body.users).not.toContain(user2.username);
  } finally {
    await deleteTestUser(request, user1);
    await deleteTestUser(request, user2);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/sharing/block-unblock.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for block + unblock users"
```

---

## Task 5: Mobile — hamburger menu opens and closes

**Files:**
- Create: `tests/e2e/mobile/hamburger-menu.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('mobile hamburger opens the main menu and Escape closes it', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/m.html');

    // The main menu curtain starts closed.
    const mainMenu = page.locator('#mobileMainMenu');
    await expect(mainMenu).not.toHaveAttribute('open', 'true');

    // Tap hamburger — main menu curtain opens.
    await page.locator('#mobileHamburger').click();
    await expect(mainMenu).toHaveAttribute('open', 'true');

    // Escape closes.
    await page.keyboard.press('Escape');
    await expect(mainMenu).not.toHaveAttribute('open', 'true');
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/mobile/hamburger-menu.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for mobile hamburger menu open/close"
```

---

## Task 6: Mobile — action from a curtain menu auto-closes the curtain

**Files:**
- Create: `tests/e2e/mobile/action-closes-curtain.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('tapping a menu item inside a mobile curtain closes the curtain', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/m.html');

    // Open hamburger, then File submenu.
    await page.locator('#mobileHamburger').click();
    const fileMenu = page.locator('#mobileFileMenu');
    await page.locator('#mobileFileButton').click();
    await expect(fileMenu).toHaveAttribute('open', 'true');

    // Tap New — triggers the new-edition welcome dialog AND closes the curtain.
    await page.locator('#newFileButton').click();

    // File menu curtain has closed (auto-close-on-action).
    await expect(fileMenu).not.toHaveAttribute('open', 'true', { timeout: 5_000 });

    // Main menu curtain also closes.
    await expect(page.locator('#mobileMainMenu')).not.toHaveAttribute('open', 'true');

    // The Create-New/Open-Existing dialog appears (triggered by New).
    await expect(page.getByRole('button', { name: 'Create New' })).toBeVisible({ timeout: 5_000 });
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/mobile/action-closes-curtain.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for mobile curtain auto-close-on-action"
```

---

## Task 7: Mobile — edit & save an edition end-to-end

A smoke test that the core editing flow works on m.html identical to desktop.

**Files:**
- Create: `tests/e2e/mobile/edit-and-save.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(90_000);

test('mobile: user can create, edit, and save an edition end-to-end', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/m.html');

    // Navigate through the hamburger → File → New.
    await page.locator('#mobileHamburger').click();
    await page.locator('#mobileFileButton').click();
    await page.locator('#newFileButton').click();
    await page.getByRole('button', { name: 'Create New' }).click();

    // Edit the character name on the same editor (dialogs are shared with desktop).
    await page.locator('#charTabBtn').click();
    await page.locator('#characterName').fill('MobileAlpha');
    await page.locator('#characterName').press('Tab');

    // Save via the mobile File menu → Save. The Save button is `#saveFileButton`.
    await page.locator('#mobileHamburger').click();
    await page.locator('#mobileFileButton').click();
    await page.locator('#saveFileButton').click();

    // Name prompt dialog → fill + OK.
    const saveDlg = page.getByRole('dialog');
    await saveDlg.getByRole('textbox').fill('mobile-edit');
    await saveDlg.getByRole('button', { name: 'OK' }).click();

    // Verify server-side
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'mobile-edit' },
      });
      return await r.text();
    }, { timeout: 15_000 }).toBe('true');
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/mobile/edit-and-save.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for mobile edit + save flow"
```

---

## Task 8: Full-suite verification

Behavioral — no new files.

- [ ] **Step 1: Cold-start + full run**

```bash
./scripts/test-stack.sh down 2>/dev/null || true
time npm run test:e2e
```

Expected: 42 specs green (35 from Phase 4/5a/5b + 7 Phase 5c).

- [ ] **Step 2: Full chain**

```bash
npm run test:all
```

Expected: Vitest 88 + Hurl 20 files / 187 requests + Playwright 42 — all green, leak check clean.

- [ ] **Step 3: Optional tag**

```bash
git tag testing/phase-5c-complete
# or
git tag testing/phase-5-complete
```

---

## Acceptance criteria

1. `npm run test:e2e` exits 0 with 42 specs green.
2. Leak check clean after each E2E run.
3. All dialogs matched via role + text filter (no `#id<N>` counter hardcoding).
4. Two-user sharing specs delete both scratch users on teardown.
5. Mobile specs navigate `/m.html` directly (no viewport emulation).

## Out of scope

- Re-running Phase 4 edition/auth flows under `/m.html` — the shared dialog/editor code is already covered.
- Block-dialog title copy bug (noted in recon) — tests match current behavior.
- Phase 6 nightly matrix (Firefox + WebKit) — separate phase.

## Anticipated gotchas

- **Sharing-dialog dynamic buttons.** Remove / Unblock buttons don't have stable IDs and are re-rendered on each mutation. Query by role + position, not by reference.
- **Mobile curtain auto-close** can race with dialog-open animations. If a spec's follow-up assertion flakes, add `await expect(dlg).toBeVisible()` before the curtain-closed assertion.
- **`#sharingButton` in the dropdown** requires hover-then-click on desktop; same on mobile. The test templates include the try/catch pattern.
- **`Create New` welcome button appears inconsistently** across specs that navigate to `/m.html` after `injectSession` — `mobile.ts` routes through a `new-or-open` flow. Specs dismiss via `Create New` when present and fall through otherwise.
