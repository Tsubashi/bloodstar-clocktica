# Testing — Phase 5b: Playwright Images + Publish + Dialogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Playwright E2E suite with three spec groups — `images/`, `publish/`, `dialogs/` — covering asset handling, the publish UI contract, and core ARIA dialog behaviors.

**Architecture:** Same fixtures as Phase 4/5a (`tests/e2e/fixtures/` — `test`, `expect`, `createTestUser`, `injectSession`, `dragListItem`). Leak check runs automatically.

**Tech Stack:** Playwright 1.59, existing Docker test stack.

**Scope:** ~10 specs across 3 groups (5 images + 2 publish + 3 dialogs).

**Explicit non-scope (per recon findings):**
- **Image crop UI** — NOT interactive; crop is algorithmic (alpha-channel bounding box). Skip.
- **Pixel-level assertions** — explicitly ruled out by the design doc. Specs assert on preview `src` being non-empty and settings-persistence via save/reload.
- **Clipboard read-back** — requires special permission; testing the copy button navigates to "can click without crash" rather than "clipboard contents match."

Deferred to **Phase 5c**: sharing UI + mobile.

**Spec reference:** [`docs/superpowers/specs/2026-04-20-testing-infrastructure-design.md`](../specs/2026-04-20-testing-infrastructure-design.md)

**User preference:** Auto mode — `git commit --no-gpg-sign`.

---

## Key facts from recon

### Image selectors

- Upload button: the DOM has a visible "Choose Image" button that fires `document.getElementById('characterUnstyledImageInput').click()`. Playwright specs skip the intermediate click and use `setInputFiles` directly on the hidden input: `page.locator('#characterUnstyledImageInput').setInputFiles(path)`.
- Hidden file input: `#characterUnstyledImageInput` (`type=file, accept=image/*`).
- Remove button: `#characterImageRemoveBtn` — immediate (no confirmation dialog).
- Styled preview: `#characterStyledImageDisplay` — an `<img>` whose `src` becomes non-empty once an image is loaded.
- Loading spinner: `#characterImagePreviewSpinner` — visible while `character.isLoading === true`.
- Image-settings checkboxes: `#shouldRestyle`, `#shouldCrop`, `#shouldColorize`, `#useOutsiderAndMinionColors`, `#useTexture`, `#useBorder`, `#dropShadow`.
- Image-settings sliders (range inputs): `#horizontalPlacement`, `#verticalPlacement`, `#sizeFactor`, `#borderIntensity`, `#dropShadowSize`, `#dropShadowOffsetX`, `#dropShadowOffsetY`, `#dropShadowOpacity`.
- Reset button: `#resetImageSettings`.

### Publish selectors

- Menu entry: `#saveAndPublishButton` (inside Publish dropdown). May need to hover the dropdown parent first (confirmed pattern from Phase 4).
- Publish-complete dialog: role `dialog` containing `<h1>` with text "Publish Complete".
- URLs inside: two `<a>` links, one for script (.json) and one for almanac (.html). Each has a sibling "copy" button.
- OK button: closes the dialog.

### Dialog selectors

- All dialogs use global counter: `#yes-no1`, `#spinner1`, etc. Counter persists across actions; don't hardcode a number — use `getByRole('dialog').filter({ hasText: ... })`.
- `AriaDialog` listens for ESC on cancellable dialogs. Spinner dialogs are NOT cancellable.
- Focus trap: clicking outside doesn't close the dialog.

### Known gotchas

- **Client-side image resize is async** (canvas resize to 540×540). After `setInputFiles`, wait for `#characterImagePreviewSpinner` to become hidden before asserting on `#characterStyledImageDisplay` src.
- **Publish takes several seconds** (server-side almanac generation + image copying). Spinner spans that time.
- **Dialog IDs have a global counter** — always select via role + text, not `#id`.

---

## Task 1: Images — upload image

**Files:**
- Create: `tests/e2e/images/upload.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import * as path from 'node:path';
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

const SAMPLE_PNG = path.join(__dirname, '..', '..', 'api', 'fixtures', 'tiny.png');

test('user can upload a character image', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Before upload, the preview image src should be empty or a data-URI placeholder.
    const preview = page.locator('#characterStyledImageDisplay');
    const srcBefore = (await preview.getAttribute('src')) ?? '';

    // Inject the PNG directly into the hidden file input.
    await page.locator('#characterUnstyledImageInput').setInputFiles(SAMPLE_PNG);

    // Wait for async processing to finish (spinner visible → hidden).
    await expect(page.locator('#characterImagePreviewSpinner')).toBeHidden({ timeout: 15_000 });

    // Preview src should now be a data URI.
    await expect(preview).toHaveAttribute('src', /^data:image\/png;base64,/, { timeout: 10_000 });

    const srcAfter = await preview.getAttribute('src');
    expect(srcAfter).not.toBe(srcBefore);
    expect((srcAfter ?? '').length).toBeGreaterThan(100);
  } finally {
    await deleteTestUser(request, user);
  }
});
```

The spec reuses `tests/api/fixtures/tiny.png` that Phase 3 created (1×1 red PNG, ~70 bytes). If the path is wrong (depends on where the test spec file sits relative to it), adjust during implementation.

- [ ] **Step 2: Run + Step 3: Commit**

```bash
npm run test:e2e -- tests/e2e/images/upload.spec.ts
git add tests/e2e/images/upload.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for character image upload"
```

---

## Task 2: Images — remove image

**Files:**
- Create: `tests/e2e/images/remove.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import * as path from 'node:path';
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

const SAMPLE_PNG = path.join(__dirname, '..', '..', 'api', 'fixtures', 'tiny.png');

test('user can remove a character image via the remove button', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Upload first so there's something to remove
    await page.locator('#characterUnstyledImageInput').setInputFiles(SAMPLE_PNG);
    await expect(page.locator('#characterImagePreviewSpinner')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('#characterStyledImageDisplay')).toHaveAttribute('src', /^data:image\/png;base64,/, { timeout: 10_000 });

    // Now remove
    await page.locator('#characterImageRemoveBtn').click();

    // Preview should clear. The app may set src to '' or a default placeholder.
    await expect(page.locator('#characterStyledImageDisplay')).not.toHaveAttribute('src', /^data:image\/png;base64,/, { timeout: 10_000 });
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/images/remove.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for character image remove"
```

---

## Task 3: Images — replace image (upload twice)

**Files:**
- Create: `tests/e2e/fixtures/images/blue.png` — a second distinct image so we can verify the replacement took effect.
- Create: `tests/e2e/images/replace.spec.ts`

- [ ] **Step 1: Create a second fixture PNG**

Generate a 1×1 BLUE PNG (distinct byte content from the existing red PNG):

```bash
mkdir -p tests/e2e/fixtures/images
python3 -c "import base64; open('tests/e2e/fixtures/images/blue.png','wb').write(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='))"
ls -la tests/e2e/fixtures/images/blue.png
```

Expected: ~70-byte file. If Python isn't available, any tiny distinct PNG works.

- [ ] **Step 2: Write the spec**

```typescript
import * as path from 'node:path';
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

const RED_PNG = path.join(__dirname, '..', '..', 'api', 'fixtures', 'tiny.png');
const BLUE_PNG = path.join(__dirname, '..', 'fixtures', 'images', 'blue.png');

test('uploading again replaces the previous character image', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    const preview = page.locator('#characterStyledImageDisplay');
    const spinner = page.locator('#characterImagePreviewSpinner');

    // Upload red
    await page.locator('#characterUnstyledImageInput').setInputFiles(RED_PNG);
    await expect(spinner).toBeHidden({ timeout: 15_000 });
    const srcAfterRed = await preview.getAttribute('src');
    expect(srcAfterRed).toMatch(/^data:image\/png;base64,/);

    // Upload blue (replace)
    await page.locator('#characterUnstyledImageInput').setInputFiles(BLUE_PNG);
    await expect(spinner).toBeHidden({ timeout: 15_000 });
    const srcAfterBlue = await preview.getAttribute('src');
    expect(srcAfterBlue).toMatch(/^data:image\/png;base64,/);
    expect(srcAfterBlue).not.toBe(srcAfterRed);
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 3: Run + commit**

```bash
git add tests/e2e/fixtures/images/blue.png tests/e2e/images/replace.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for character image replace"
```

---

## Task 4: Images — toggling a setting persists through save/reload

**Files:**
- Create: `tests/e2e/images/setting-persists.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(90_000);

test('toggling an image setting persists through save + reload + reopen', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Flip shouldColorize off (defaults to true — see Phase 2 unit tests).
    const colorize = page.locator('#shouldColorize');
    await expect(colorize).toBeChecked();
    await colorize.uncheck();
    await expect(colorize).not.toBeChecked();

    // Save
    await page.keyboard.press('Control+s');
    const saveDialog = page.getByRole('dialog');
    await saveDialog.getByRole('textbox').fill('img-settings');
    await saveDialog.getByRole('button', { name: 'OK' }).click();

    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'img-settings' },
      });
      return await r.text();
    }, { timeout: 15_000 }).toBe('true');

    // Reload + reopen
    await page.evaluate(() => localStorage.removeItem('recentFile'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Open Existing' }).click();
    await page.getByRole('button', { name: 'img-settings' }).click();
    await page.locator('#charTabBtn').click();

    // Setting should still be unchecked
    await expect(page.locator('#shouldColorize')).not.toBeChecked();
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/images/setting-persists.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for image-setting persistence"
```

---

## Task 5: Images — reset settings restores defaults

**Files:**
- Create: `tests/e2e/images/reset.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('reset image settings restores defaults', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Twiddle two settings away from defaults.
    const colorize = page.locator('#shouldColorize');
    const border = page.locator('#useBorder');
    await expect(colorize).toBeChecked();
    await colorize.uncheck();
    await expect(border).toBeChecked();
    await border.uncheck();

    // Reset
    await page.locator('#resetImageSettings').click();

    // Both should return to default (true).
    await expect(colorize).toBeChecked({ timeout: 5_000 });
    await expect(border).toBeChecked();
  } finally {
    await deleteTestUser(request, user);
  }
});
```

If `#resetImageSettings` triggers a confirmation dialog (it might ask "Are you sure?" — check at runtime), accept it first. If it doesn't, skip the confirm step.

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/images/reset.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for image-settings reset"
```

---

## Task 6: Publish — publish-complete dialog shows both URLs

**Files:**
- Create: `tests/e2e/publish/publish-flow.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(120_000);

test('publish flow shows script + almanac URLs in the completion dialog', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Give the character a reminder so night-order etc. have content.
    await page.locator('#characterName').fill('Alpha');
    await page.locator('#characterName').press('Tab');
    await page.locator('#characterFirstNightReminder').fill('Alpha first');
    await page.locator('#characterFirstNightReminder').press('Tab');

    // Save before publish (publish needs a saved edition).
    await page.keyboard.press('Control+s');
    const saveDialog = page.getByRole('dialog');
    await saveDialog.getByRole('textbox').fill('publish-test');
    await saveDialog.getByRole('button', { name: 'OK' }).click();
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'publish-test' },
      });
      return await r.text();
    }, { timeout: 15_000 }).toBe('true');

    // Click Save and Publish. The button may be in a dropdown — hover if needed.
    const publishBtn = page.locator('#saveAndPublishButton');
    try {
      await publishBtn.click({ timeout: 2_000 });
    } catch {
      await publishBtn.locator('..').locator('..').hover();
      await publishBtn.click();
    }

    // Publish Complete dialog appears. Use role+text, not id (counter varies).
    const dlg = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /Publish Complete/i }) });
    await expect(dlg).toBeVisible({ timeout: 60_000 });

    // Two links inside, one ending in .json (script) and one in .html (almanac).
    const links = dlg.locator('a');
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute('href', /script\.json/);
    await expect(links.nth(1)).toHaveAttribute('href', /almanac\.html/);

    // Close the dialog
    await dlg.getByRole('button', { name: 'OK' }).click();
    await expect(dlg).toBeHidden();
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/publish/publish-flow.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for publish-complete dialog URLs"
```

---

## Task 7: Publish — published URLs actually serve content

Cross-check that the URLs shown in the dialog are navigable and return valid content.

**Files:**
- Create: `tests/e2e/publish/urls-serve.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(120_000);

test('published URLs serve valid script.json and almanac.html', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();
    await page.locator('#characterName').fill('Alpha');
    await page.locator('#characterName').press('Tab');
    await page.locator('#characterFirstNightReminder').fill('Alpha first');
    await page.locator('#characterFirstNightReminder').press('Tab');

    await page.keyboard.press('Control+s');
    const saveDialog = page.getByRole('dialog');
    await saveDialog.getByRole('textbox').fill('url-test');
    await saveDialog.getByRole('button', { name: 'OK' }).click();
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'url-test' },
      });
      return await r.text();
    }, { timeout: 15_000 }).toBe('true');

    const publishBtn = page.locator('#saveAndPublishButton');
    try { await publishBtn.click({ timeout: 2_000 }); }
    catch { await publishBtn.locator('..').locator('..').hover(); await publishBtn.click(); }

    const dlg = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /Publish Complete/i }) });
    await expect(dlg).toBeVisible({ timeout: 60_000 });

    // Extract the hrefs. The dialog builds them against SITE_ROOT = bloodstar.clocktica.com,
    // but the test fixture rewrites requests to localhost; we still need to normalize
    // for direct `request.get` calls.
    const scriptHref = await dlg.locator('a').nth(0).getAttribute('href');
    const almanacHref = await dlg.locator('a').nth(1).getAttribute('href');
    expect(scriptHref).toBeTruthy();
    expect(almanacHref).toBeTruthy();

    // Strip the SITE_ROOT origin so we fetch from the test stack.
    const scriptPath = scriptHref!.replace(/^https?:\/\/[^/]+/, '');
    const almanacPath = almanacHref!.replace(/^https?:\/\/[^/]+/, '');

    const scriptRes = await request.get(scriptPath);
    expect(scriptRes.status()).toBe(200);
    expect(await scriptRes.text()).toContain('"id"');

    const almanacRes = await request.get(almanacPath);
    expect(almanacRes.status()).toBe(200);
    expect(await almanacRes.text()).toContain('<html');
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/publish/urls-serve.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for published URLs serving content"
```

---

## Task 8: Dialogs — ESC closes a yes-no dialog

**Files:**
- Create: `tests/e2e/dialogs/esc-closes-yes-no.spec.ts`

- [ ] **Step 1: Write the spec**

Use the character-delete flow (from Phase 5a) as the trigger for a yes-no dialog — but here we press ESC instead of clicking Yes, and verify the character WAS NOT deleted.

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('pressing ESC on a yes-no confirmation cancels the action', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Add a second character so we can try to delete one
    await page.locator('#addCharacterButton').click();
    await expect(page.locator('#characterList .characterListItem')).toHaveCount(2);

    // Trigger delete on the first
    const firstItem = page.locator('#characterList .characterListItem').first();
    await firstItem.getByRole('button', { name: 'Delete' }).first().click();

    // A yes-no confirmation dialog appears
    const confirmDlg = page.getByRole('dialog').filter({ hasText: /Confirm Delete/i });
    await expect(confirmDlg).toBeVisible();

    // Press ESC — dialog should close, character should remain.
    await page.keyboard.press('Escape');
    await expect(confirmDlg).toBeHidden();

    // Both characters still present
    await expect(page.locator('#characterList .characterListItem')).toHaveCount(2);
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/dialogs/esc-closes-yes-no.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for ESC dismissing yes-no dialog"
```

---

## Task 9: Dialogs — save-discard-cancel on dirty sign-out

Sign out with a dirty edition should surface the save-discard-cancel dialog.

**Files:**
- Create: `tests/e2e/dialogs/save-discard-cancel.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(60_000);

test('signing out with unsaved changes prompts save-discard-cancel', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();

    // Make a change to dirty the edition
    await page.locator('#characterName').fill('DirtyName');
    await page.locator('#characterName').press('Tab');

    // Open signed-in menu and click Sign out.
    const signedInDropdown = page.locator('#signedInLabel').locator('..');
    await signedInDropdown.hover();
    await page.locator('#signOutBtn').click();

    // save-discard-cancel dialog appears
    const dlg = page.getByRole('dialog').filter({ hasText: /Unsaved Changes/i });
    await expect(dlg).toBeVisible();

    // It should have three buttons.
    await expect(dlg.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Discard' })).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // Click Cancel — we stay signed in with the dirty state.
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(dlg).toBeHidden();

    // Still signed in + still on the editor.
    await expect(page.locator('#userName')).toContainText(user.username);
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/dialogs/save-discard-cancel.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for save-discard-cancel on dirty sign-out"
```

---

## Task 10: Dialogs — spinner appears and auto-closes during publish

**Files:**
- Create: `tests/e2e/dialogs/spinner-during-publish.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect, createTestUser, deleteTestUser, injectSession } from '../fixtures';

test.setTimeout(120_000);

test('spinner dialog appears during publish and auto-closes', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await page.locator('#charTabBtn').click();
    await page.locator('#characterName').fill('Alpha');
    await page.locator('#characterName').press('Tab');
    await page.locator('#characterFirstNightReminder').fill('Alpha first');
    await page.locator('#characterFirstNightReminder').press('Tab');

    await page.keyboard.press('Control+s');
    const saveDialog = page.getByRole('dialog');
    await saveDialog.getByRole('textbox').fill('spinner-test');
    await saveDialog.getByRole('button', { name: 'OK' }).click();
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'spinner-test' },
      });
      return await r.text();
    }, { timeout: 15_000 }).toBe('true');

    // Trigger publish
    const publishBtn = page.locator('#saveAndPublishButton');
    try { await publishBtn.click({ timeout: 2_000 }); }
    catch { await publishBtn.locator('..').locator('..').hover(); await publishBtn.click(); }

    // A spinner appears. `#spinner{N}` or role=dialog with the spinner CSS.
    // Use a broad locator — any dialog with no text content but a spinning indicator.
    // The spinner dialog contains a <ul class="spinnerMessages">.
    const spinnerDlg = page.locator('div.spinner').locator('..').or(page.locator('.spinnerMessages').locator('..'));
    // The spinner is rapid — not always catchable. We don't assert it appears; we
    // assert it eventually disappears (i.e., publish completes). Use the completion
    // dialog as the post-condition instead.

    // Wait for publish-complete dialog as the actual post-condition.
    const completeDlg = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /Publish Complete/i }) });
    await expect(completeDlg).toBeVisible({ timeout: 60_000 });

    // All spinner dialogs are gone (the publish-complete dialog is not a spinner).
    await expect(page.locator('div.spinner')).toHaveCount(0);
  } finally {
    await deleteTestUser(request, user);
  }
});
```

This spec is mostly a smoke test for "publish doesn't leave a hung spinner." It doesn't try to catch the spinner mid-operation (too timing-sensitive). If the test implementer finds a reliable way to catch the spinner appearing, add an assertion.

- [ ] **Step 2: Run + Step 3: Commit**

```bash
git add tests/e2e/dialogs/spinner-during-publish.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for spinner auto-close after publish"
```

---

## Task 11: Full-suite verification

Behavioral — no new files.

- [ ] **Step 1: Clean slate + full run**

```bash
./scripts/test-stack.sh down 2>/dev/null || true
time npm run test:e2e
```

Expected: 35 specs (15 Phase 4 + 10 Phase 5a + 10 Phase 5b) all green. Warm Playwright run under 90s.

- [ ] **Step 2: Full chain**

```bash
npm run test:all
```

Expected: Vitest 88 + Hurl 20 files / 187 requests + Playwright 35 — all green, leak check clean.

- [ ] **Step 3: Optional tag**

```bash
git tag testing/phase-5b-complete
```

---

## Acceptance criteria

1. `npm run test:e2e` exits 0 with 35 specs green.
2. Leak check clean.
3. No production source modified.
4. Dialog specs use role + text filters (not `#id` with the global counter).
5. Image specs tolerate client-side resize delay via the spinner-hidden wait.

## Out of scope

- **Image crop UI** — not implemented; crop is algorithmic.
- **Pixel-level diff assertions** — ruled out by spec.
- **Clipboard read-back** — tests navigate the copy button's existence only.
- **Sharing UI + mobile** — Phase 5c.

## Anticipated gotchas

- **Publish takes up to 60s** on a cold cache. Specs set generous timeouts on the publish-complete dialog.
- **`tests/api/fixtures/tiny.png`** is the reused fixture from Phase 3 (red 1×1 PNG). Relative path from `tests/e2e/images/*.spec.ts` is `../../api/fixtures/tiny.png`.
- **The spinner dialog is fast** — don't assert it appears, assert it's gone after publish completes.
- **Dialog counters** — never hardcode `#spinner1` or `#publishComplete1`. Always use `getByRole('dialog').filter({ hasText: ... })`.
- **Image setting defaults** — from Phase 2 unit tests: `shouldRestyle`, `shouldCrop`, `shouldColorize`, `useOutsiderAndMinionColors`, `useTexture`, `useBorder`, `useDropshadow` all default to `true`. `dropShadowSize=16`, etc.
