# Testing — Phase 4: Playwright Smoke + Auth + Editions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the Playwright E2E harness plus the first three spec groups — `smoke/`, `auth/`, and `editions/` — running against the Phase-1 Docker test stack. Extend `integration.yml` to run Playwright (Chromium only) after the Hurl suite.

**Architecture:** Playwright specs under `tests/e2e/` target a live stack (same compose + scripts as Hurl). Each spec is self-contained: it creates its scratch user via the API (signup → mailhog-confirm → signin → localStorage-inject), runs the UI flow, and deletes the account on teardown. Auth-flow specs are the exception — they exercise the UI sign-in/signup/reset paths rather than the API shortcut. All assertions use Playwright's accessibility-oriented locators (`getByRole`, `getByLabel`, `getByText`) so a future DOM restyle doesn't break them.

**Tech Stack:** Playwright (`@playwright/test`), existing Phase-1 Docker stack, Hurl 7 (for the API auth-shortcut helper inside fixtures), GitHub Actions.

**Scope (Phase 4 only):** smoke (5 specs), auth (signup, signin errors, reset-password, delete-account), editions (new/open/save/save-as/recent-files/delete/import-from-file). **Out of scope:** characters, images, night-order, sharing, publish, dialogs, mobile — those land in Phase 5. Undo/redo uses browser history with no visible UI, and export via publish belongs in Phase 5; both deferred.

**Spec reference:** [`docs/superpowers/specs/2026-04-20-testing-infrastructure-design.md`](../specs/2026-04-20-testing-infrastructure-design.md)

**User preference:** In auto mode, Claude commits directly with `git commit --no-gpg-sign`. In manual mode, Claude presents commit commands for the user to run.

---

## Key facts from frontend recon

All selector patterns below come from a read of `src/dlg/*`, `src/sign-in.ts`, `src/menu.ts`, and `dist/index.html`. Referenced liberally throughout the tasks.

### Auth-shortcut: localStorage injection

The app stores its session at `localStorage['accessToken']` as JSON:

```json
{
  "token": "<JWT>",
  "expiration": <unix-seconds>,
  "username": "<username>",
  "email": "<email>"
}
```

To skip the UI sign-in, a Playwright spec can:
1. Create + confirm a user via the API (signup.php → mailhog → confirm.php).
2. Receive a real JWT from confirm.php.
3. `await page.addInitScript(s => localStorage.setItem('accessToken', s), JSON.stringify(session))` before navigating.
4. `await page.goto('/')` — the app will treat the session as already signed in.

### Selector reference (used across specs)

**Sign-in dialog:**
- Username: `page.getByLabel('Username or email')` OR `page.locator('#signInDlgUsername')`
- Password: `page.getByLabel('Password')` OR `page.locator('#signInDlgPassword')`
- Submit: `page.getByRole('button', { name: 'Sign in' })`
- Forgot-password link: `page.getByRole('link', { name: 'Forgot your password?' })`
- Sign-up link: `page.getByText('Sign Up')`

**Sign-up dialog:**
- Username: `page.getByLabel('Username')` (step 1 only)
- Email: `page.getByLabel('Email')`
- Password: `page.locator('#signInDlgPassword')` (NB: this ID is reused; disambiguate with `#signUpDlg`)
- Confirm: `page.locator('#signInDlgPasswordConfirm')`
- Submit: `page.getByRole('button', { name: /^Sign up$/ })` (enabled only after validation passes)

**Confirm-code dialog (post-signup):**
- Code input: `page.locator('#codeFromEmail')`
- Continue: `page.getByRole('button', { name: 'Continue' })`

**Reset-password flow:**
- Request step — username: `page.locator('#requestResetDlgUsername')`
- Request submit: `page.getByRole('button', { name: 'Reset my password' })`
- Reset step — code: `page.locator('#codeFromEmail')`
- Reset step — new password: `page.locator('#passwordInput')`
- Reset step — confirm: `page.locator('#resetPasswordConfirm')`
- Reset submit: `page.getByRole('button', { name: 'Set password' })`

**Top-level menu:**
- Sign-in button: `#signInBtn`
- Sign-up button: `#signUpBtn`
- Sign-out button: `#signOutBtn` (inside `#signedInMenu`, visible once signed in)
- Signed-in label: `#signedInLabel`
- Change password: `#changePasswordBtn`
- Delete account: `#deleteAccountBtn`
- New: `#newFileButton`
- Open: `#openFileButton`
- Save: `#saveFileButton`
- Save As: `#saveFileAsButton`
- Delete (edition): `#deleteFileButton`
- Import JSON from file: `#jsonFromFileButton` (triggers hidden `#jsonFileInput`)
- Save and Publish: `#saveAndPublishButton`

**Main editor (visible after opening/creating an edition):**
- Meta tab: `#metatab` (one of the tab bodies — signals the editor loaded)

### Known gotchas (from recon)

- **Dialog animations.** The `AriaDialog` helper uses appear/disappear CSS transitions. Playwright's auto-waiting usually handles this; if a spec flakes on "element not visible", add an explicit `.waitFor()` or `expect(locator).toBeVisible()` first.
- **Async button disabling.** Signup and reset-password submit buttons are initially `disabled`, enabled only after field-level validation passes. Fill every field before asserting the button is enabled.
- **Hidden file input.** `#jsonFileInput` has `display:none`. Use `page.locator('#jsonFileInput').setInputFiles(...)` directly — don't try to click.
- **Focus-trap in dialogs.** Clicking outside a dialog does NOT close it. Use the provided Cancel button or press Escape.
- **History.pushState on dialog open/close.** Browser back/forward manipulates dialog state. Don't use `page.goBack()` in the middle of a flow — use the dialog's own navigation.
- **Ctrl+S saves.** `src/bloodstar.ts` binds a global `keydown` handler. Playwright can test this with `page.keyboard.press('Control+S')` (or `Meta+S` on macOS — prefer `Control+S` since CI is Linux).
- **`state-history.ts` has a `typeof window` guard** (from Phase 2) — safe at module load under Node but full-featured in browsers. Specs don't need to worry about this.

---

## Task 1: Install Playwright and scaffold the runner

Install `@playwright/test`, create `playwright.config.ts`, scaffold fixtures directory and a mailhog helper, replace the `test:e2e` placeholder, wire up `test:e2e:ui` for interactive debugging.

**Files:**
- Modify: `package.json` — add `@playwright/test` dev dep, replace `test:e2e` and `test:e2e:ui` scripts.
- Create: `playwright.config.ts`
- Create: `scripts/run-e2e-tests.sh`
- Create: `tests/e2e/README.md`
- Create: `tests/e2e/fixtures/mailhog.ts`
- Create: `tests/e2e/smoke/health.spec.ts` (single-assertion smoke file that proves the runner works)

- [ ] **Step 1: Install Playwright**

```bash
npm install --save-dev @playwright/test
npx playwright install --with-deps chromium
```

Expected: `@playwright/test` appears in `devDependencies`. Chromium binary downloaded (~170 MB) under `~/Library/Caches/ms-playwright/` on macOS or `/root/.cache/ms-playwright/` on Linux.

- [ ] **Step 2: Create `playwright.config.ts` at repo root**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.ts/,
  // Run specs serially — like Hurl (Phase 3), every spec captures from a
  // shared mailhog inbox by "newest first", so parallelism would race.
  // Phase 5 may lift this per-spec via email filtering; Phase 4 stays safe.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8086',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

- [ ] **Step 3: Create `scripts/run-e2e-tests.sh`**

```bash
#!/usr/bin/env bash
# Runs the Playwright E2E suite against a fresh test stack.
#
# Mirrors scripts/run-api-tests.sh for consistency. Stack up → flush mailhog
# → run Playwright → always tear down.
set -euo pipefail
cd "$(dirname "$0")/.."

cleanup() {
  ./scripts/test-stack.sh down
}
trap cleanup EXIT

./scripts/test-stack.sh up

curl -fsS -X DELETE http://localhost:8026/api/v1/messages > /dev/null

npx playwright test "$@"
```

Make executable:
```bash
chmod +x scripts/run-e2e-tests.sh
```

- [ ] **Step 4: Replace `test:e2e` placeholders in `package.json`**

Change:
```json
"test:e2e": "echo 'E2E tests arrive in Phase 4 (Playwright).' && exit 0",
"test:e2e:ui": "echo 'E2E UI mode arrives in Phase 4 (Playwright).' && exit 0",
```
to:
```json
"test:e2e": "./scripts/run-e2e-tests.sh",
"test:e2e:ui": "./scripts/test-stack.sh up && npx playwright test --ui; ./scripts/test-stack.sh down",
```

Leave all other scripts untouched. Note the `test:e2e:ui` form uses `;` (not `&&`) between `playwright test --ui` and `down` so the teardown runs even if the user quits the UI with a non-zero exit.

- [ ] **Step 5: Create `tests/e2e/fixtures/mailhog.ts`**

```typescript
// Helpers for interacting with mailhog from Playwright specs.

const MAILHOG_BASE = 'http://localhost:8026';

export interface MailhogMessage {
  To: string[];
  Body: string;
  Subject: string;
  Raw: unknown;
}

/** Fetch the most recent message addressed to `recipient`. Throws if none. */
export async function getLatestEmailTo(recipient: string, timeoutMs = 10_000): Promise<MailhogMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILHOG_BASE}/api/v2/messages`);
    if (res.ok) {
      const data = await res.json() as { items: Array<{
        Content: { Body: string; Headers: Record<string, string[]> };
      }> };
      for (const item of data.items) {
        const to = item.Content.Headers.To ?? [];
        if (to.some(addr => addr.includes(recipient))) {
          return {
            To: to,
            Body: item.Content.Body,
            Subject: (item.Content.Headers.Subject ?? [''])[0],
            Raw: item,
          };
        }
      }
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`No mailhog message for ${recipient} within ${timeoutMs}ms`);
}

/** Extract the 6-digit code from an email body. */
export function extract6DigitCode(body: string): string {
  const match = body.match(/\b(\d{6})\b/);
  if (!match) throw new Error(`No 6-digit code in body: ${body.slice(0, 200)}`);
  return match[1];
}

/** Clear mailhog's inbox. Useful in beforeEach for isolation. */
export async function clearMailhogInbox(): Promise<void> {
  await fetch(`${MAILHOG_BASE}/api/v1/messages`, { method: 'DELETE' });
}
```

- [ ] **Step 6: Create `tests/e2e/smoke/health.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('Playwright can reach the health endpoint', async ({ request }) => {
  const response = await request.get('/api/health.php');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toEqual({ status: 'ok', db: 'ok' });
});
```

This spec uses Playwright's `request` fixture (no browser). Proves the runner wiring works without needing any UI bits.

- [ ] **Step 7: Create `tests/e2e/README.md`**

```markdown
# E2E tests (Playwright)

Browser-level tests covering user-visible behavior. Run against the same
Docker test stack the Hurl API tests use.

## Prerequisites

- Docker (Phase 1 stack).
- Node 24+ and dependencies installed (`npm ci`).
- Chromium installed (`npx playwright install chromium`).

## Running

| Command                  | What it does                                               |
|--------------------------|------------------------------------------------------------|
| `npm run test:e2e`       | Bring up stack, run every spec, tear down. Chromium only.  |
| `npm run test:e2e:ui`    | Bring up stack and open Playwright's interactive UI mode.  |

For a single spec: `./scripts/test-stack.sh up` then `npx playwright test tests/e2e/smoke/health.spec.ts`.

## Layout

- `smoke/` — fast sanity checks (under 30s).
- `auth/` — sign-in, sign-up, password-reset, delete-account (UI flows).
- `editions/` — new/open/save/save-as/recent-files/delete/import.
- `fixtures/` — shared helpers (mailhog, API auth shortcut, test-user factory).

## Selector policy

Prefer `page.getByRole()` and `page.getByLabel()` over CSS selectors. They
survive cosmetic DOM changes and double as accessibility checks. Fall back
to `#id` selectors only when there's no accessible handle.

## Serial execution

`playwright.config.ts` sets `workers: 1` and `fullyParallel: false` because
every spec captures confirmation codes from the shared mailhog inbox using
the "newest message for this email" idiom. Parallel workers would race.
Phase 5 may lift this per-spec; Phase 4 stays safe.
```

- [ ] **Step 8: Run the smoke spec end-to-end**

```bash
npm run test:e2e
```

Expected:
- Docker stack comes up (~30s cold, <10s warm).
- Playwright runs 1 spec / 1 test — passes.
- Stack tears down.
- Total wall-clock: under 60s warm.

Common failure modes:
- `Error: browserType.launch: Executable doesn't exist` → rerun `npx playwright install chromium` (or `install --with-deps` if the system lacks libs).
- Health endpoint 503 → stack didn't come up healthy; check `docker compose logs app`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json playwright.config.ts \
        scripts/run-e2e-tests.sh \
        tests/e2e/README.md tests/e2e/fixtures/mailhog.ts \
        tests/e2e/smoke/health.spec.ts
git commit --no-gpg-sign -m "Install Playwright E2E runner with health smoke test"
```

---

## Task 2: Test-user factory fixture

Most specs need a fresh scratch user. Build a Playwright fixture that:
1. Creates the user via the API (signup + mailhog-confirm).
2. Returns a signed-in `SessionInfo` ready for injection.
3. Cleans up the account on teardown.

**Files:**
- Create: `tests/e2e/fixtures/test-user.ts`
- Create: `tests/e2e/fixtures/index.ts` — re-exports everything from the fixtures dir.

- [ ] **Step 1: Create `tests/e2e/fixtures/test-user.ts`**

```typescript
import { APIRequestContext } from '@playwright/test';
import { getLatestEmailTo, extract6DigitCode } from './mailhog';

const BASE_URL = 'http://localhost:8086';

export interface SessionInfo {
  token: string;
  expiration: number;
  username: string;
  email: string;
}

export interface TestUser {
  username: string;
  email: string;
  password: string;
  session: SessionInfo;
}

/** Generate a per-run unique identifier string. */
export function uniqueId(prefix = 'test'): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

/**
 * Create a confirmed test user via the API. Returns credentials + a live
 * session token ready to inject into localStorage.
 *
 * Does NOT exercise the UI — use this in specs that don't test auth.
 */
export async function createTestUser(
  request: APIRequestContext,
  opts: { password?: string } = {},
): Promise<TestUser> {
  const username = uniqueId('u');
  const email = `${uniqueId('e')}@test.local`;
  const password = opts.password ?? 'TestPass123';

  // 1. Signup
  const signupRes = await request.post(`${BASE_URL}/api/signup.php`, {
    data: { username, password, email },
  });
  if (signupRes.status() !== 200 || (await signupRes.text()).trim() !== 'true') {
    throw new Error(`signup failed: ${await signupRes.text()}`);
  }

  // 2. Pull confirmation code from mailhog
  const mail = await getLatestEmailTo(email);
  const code = extract6DigitCode(mail.Body);

  // 3. Confirm → receive session
  const confirmRes = await request.post(`${BASE_URL}/api/confirm.php`, {
    data: { email, code },
  });
  if (confirmRes.status() !== 200) {
    throw new Error(`confirm failed: ${await confirmRes.text()}`);
  }
  const session = await confirmRes.json() as SessionInfo;
  if (!session.token) {
    throw new Error(`confirm returned no token: ${JSON.stringify(session)}`);
  }

  return { username, email, password, session };
}

/** Delete the scratch account via the API. Safe to call in teardown. */
export async function deleteTestUser(
  request: APIRequestContext,
  user: TestUser,
): Promise<void> {
  await request.post(`${BASE_URL}/api/deleteaccount.php`, {
    data: { token: user.session.token, password: user.password },
  });
}

/**
 * Inject a SessionInfo into localStorage so the app starts already
 * signed in. MUST be called before page.goto('/').
 */
export async function injectSession(
  page: import('@playwright/test').Page,
  session: SessionInfo,
): Promise<void> {
  await page.addInitScript(
    (s: string) => localStorage.setItem('accessToken', s),
    JSON.stringify(session),
  );
}
```

- [ ] **Step 2: Create `tests/e2e/fixtures/index.ts`**

```typescript
export * from './mailhog';
export * from './test-user';
```

- [ ] **Step 3: Smoke-test the fixture**

Add a second smoke spec at `tests/e2e/smoke/auth-shortcut.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, injectSession } from '../fixtures';

test('API auth shortcut creates a user, injects token, lands signed-in', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await expect(page.locator('#signedInLabel')).toBeVisible();
    await expect(page.locator('#signedInLabel')).toContainText(user.username);
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 4: Run**

```bash
npm run test:e2e
```

Expected: 2 specs pass. If the `#signedInLabel` selector mismatches what the app renders, adjust: inspect with `npm run test:e2e:ui` and update the assertion to match what's actually visible. The label should show the username once signed in.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/fixtures/test-user.ts tests/e2e/fixtures/index.ts \
        tests/e2e/smoke/auth-shortcut.spec.ts
git commit --no-gpg-sign -m "Add test-user factory fixture with API auth shortcut"
```

---

## Task 3: Smoke suite (remaining 3 specs)

Three more fast specs that exercise the critical happy path using the auth shortcut. Health + auth-shortcut from Task 1/2 give us 2; add 3 more to reach the planned 5.

**Files:**
- Create: `tests/e2e/smoke/create-edition.spec.ts`
- Create: `tests/e2e/smoke/save-edition.spec.ts`
- Create: `tests/e2e/smoke/sign-out.spec.ts`

- [ ] **Step 1: `tests/e2e/smoke/create-edition.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, injectSession } from '../fixtures';

test('signed-in user can create a new edition', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');

    // Wait for the initial new-or-open dialog
    await page.getByRole('button', { name: 'Create New' }).click();

    // Verify the editor loaded
    await expect(page.locator('#metatab')).toBeVisible();
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: `tests/e2e/smoke/save-edition.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, injectSession } from '../fixtures';

test('user can create an edition and save it with Ctrl+S', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await expect(page.locator('#metatab')).toBeVisible();

    // Trigger save via Ctrl+S. First save shows the save-as name prompt.
    await page.keyboard.press('Control+s');
    const nameInput = page.getByRole('textbox').first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill('my-smoke-edition');
    await page.getByRole('button', { name: 'OK' }).click();

    // Assert the save succeeded — the window title or save label should update.
    // Observe behavior with `npm run test:e2e:ui` to nail the post-save signal.
    // Use exists.php as a stable, observable post-condition:
    const exists = await request.post('/api/exists.php', {
      data: { token: user.session.token, saveName: 'my-smoke-edition' },
    });
    expect(await exists.text()).toBe('true');
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 3: `tests/e2e/smoke/sign-out.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, injectSession } from '../fixtures';

test('signed-in user can sign out via the menu', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');

    await expect(page.locator('#signedInLabel')).toBeVisible();

    // Open the signed-in menu and click Sign out. `#signOutBtn` lives
    // inside `#signedInMenu`; some layouts hide it until the parent is
    // hovered/tapped. Click by selector; if that fails try hover first.
    await page.locator('#signOutBtn').click();

    // After sign-out, the #signInBtn should be visible again.
    await expect(page.locator('#signInBtn')).toBeVisible();
    await expect(page.locator('#signedInLabel')).toBeHidden();
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 4: Run the full smoke suite**

```bash
npm run test:e2e -- tests/e2e/smoke/
```

Expected: 5 specs pass (health, auth-shortcut, create-edition, save-edition, sign-out). If any spec fails on a selector mismatch, use `npm run test:e2e:ui` to inspect the DOM and adjust. Source of truth is the app, not the test.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/smoke/create-edition.spec.ts \
        tests/e2e/smoke/save-edition.spec.ts \
        tests/e2e/smoke/sign-out.spec.ts
git commit --no-gpg-sign -m "Add smoke specs for create/save/sign-out"
```

---

## Task 4: Auth — signup via UI

The first UI-exercising auth spec. Go through the sign-up dialog, fetch confirmation code from mailhog, confirm, and end up signed in.

**Files:**
- Create: `tests/e2e/auth/signup.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from '@playwright/test';
import { getLatestEmailTo, extract6DigitCode } from '../fixtures';

test('user can sign up through the UI', async ({ request, page }) => {
  const username = `e2e-${Date.now().toString(36)}`;
  const email = `${username}@test.local`;
  const password = 'TestPass123';

  try {
    await page.goto('/');

    // Open sign-up from the initial new-or-open dialog or the menu. The
    // `#signUpBtn` in the top menu is the stable entry point.
    await page.locator('#signUpBtn').click();

    // Fill step 1 — account creation
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Email').fill(email);
    // Password fields in the sign-up dialog share an ID with sign-in
    // (#signInDlgPassword, #signInDlgPasswordConfirm). Scope by the dialog.
    const dlg = page.locator('#sign-up-dlg');
    await dlg.locator('#signInDlgPassword').fill(password);
    await dlg.locator('#signInDlgPasswordConfirm').fill(password);

    // The submit button is disabled until validation passes — wait, then click.
    const submit = page.getByRole('button', { name: /^Sign up$/ });
    await expect(submit).toBeEnabled();
    await submit.click();

    // Step 2 — fetch code from mailhog and enter it
    const mail = await getLatestEmailTo(email);
    const code = extract6DigitCode(mail.Body);

    await page.locator('#codeFromEmail').fill(code);
    await page.getByRole('button', { name: 'Continue' }).click();

    // Now signed in — the menu shows our username
    await expect(page.locator('#signedInLabel')).toContainText(username);
  } finally {
    // Teardown: delete via API using a fresh signin token to be safe.
    const signin = await request.post('/api/signin.php', {
      data: { usernameOrEmail: username, password },
    });
    const session = await signin.json() as { token?: string };
    if (session.token) {
      await request.post('/api/deleteaccount.php', {
        data: { token: session.token, password },
      });
    }
  }
});
```

- [ ] **Step 2: Run**

```bash
npm run test:e2e -- tests/e2e/auth/signup.spec.ts
```

If the signup button stays disabled despite correct inputs, the validation library may be demanding additional fields or formats — inspect with UI mode. If the password-field ID disambiguation fails, fall back to the first-of-type selector: `dlg.locator('input[type=password]').first()`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/auth/signup.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for sign-up UI flow"
```

---

## Task 5: Auth — signin errors

Verify that wrong passwords and unknown users surface a visible error on the sign-in dialog (not just a silent failure).

**Files:**
- Create: `tests/e2e/auth/signin-errors.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser } from '../fixtures';

test.describe('signin errors', () => {
  test('wrong password shows an error', async ({ request, page }) => {
    const user = await createTestUser(request);
    try {
      await page.goto('/');
      await page.locator('#signInBtn').click();

      await page.getByLabel('Username or email').fill(user.username);
      await page.getByLabel('Password').fill('ObviouslyWrong123');
      await page.getByRole('button', { name: 'Sign in' }).click();

      // Visible error somewhere on the dialog. The backend returns
      // {"title":"Sign-In Error","message":"..."} which the UI renders.
      await expect(page.getByText(/incorrect|error|failed/i)).toBeVisible();
      // Should NOT be signed in.
      await expect(page.locator('#signedInLabel')).toBeHidden();
    } finally {
      await deleteTestUser(request, user);
    }
  });

  test('unknown username shows an error', async ({ page }) => {
    await page.goto('/');
    await page.locator('#signInBtn').click();

    await page.getByLabel('Username or email').fill('definitely-not-a-user');
    await page.getByLabel('Password').fill('TestPass123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText(/incorrect|error|failed/i)).toBeVisible();
    await expect(page.locator('#signedInLabel')).toBeHidden();
  });
});
```

- [ ] **Step 2: Run**

```bash
npm run test:e2e -- tests/e2e/auth/signin-errors.spec.ts
```

If the error text doesn't match `/incorrect|error|failed/i`, inspect the actual rendered error (e.g., via UI mode) and update the regex to match the app's wording. The regex is deliberately loose — it's matching the category of error, not exact copy.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/auth/signin-errors.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for sign-in error paths"
```

---

## Task 6: Auth — password reset via UI

Full UI flow: click "Forgot password", enter username, fetch reset code from mailhog, enter code + new password, sign in with new.

**Files:**
- Create: `tests/e2e/auth/reset-password.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, getLatestEmailTo, extract6DigitCode, clearMailhogInbox } from '../fixtures';

test('user can reset password via the UI', async ({ request, page }) => {
  // Clear mailhog BEFORE creating the user so we can reliably find the
  // RESET email (rather than the signup-confirmation email).
  const user = await createTestUser(request);
  try {
    await clearMailhogInbox();

    await page.goto('/');
    await page.locator('#signInBtn').click();

    // Click "Forgot your password?"
    await page.getByRole('link', { name: 'Forgot your password?' }).click();

    // Request step — fill username and submit
    await page.locator('#requestResetDlgUsername').fill(user.username);
    await page.getByRole('button', { name: 'Reset my password' }).click();

    // Fetch reset code from mailhog
    const mail = await getLatestEmailTo(user.email);
    const code = extract6DigitCode(mail.Body);

    // Reset step — code + new password
    const newPassword = 'NewPass456';
    await page.locator('#codeFromEmail').fill(code);
    await page.locator('#passwordInput').fill(newPassword);
    await page.locator('#resetPasswordConfirm').fill(newPassword);

    const submit = page.getByRole('button', { name: 'Set password' });
    await expect(submit).toBeEnabled();
    await submit.click();

    // After reset, the user should be signed in
    await expect(page.locator('#signedInLabel')).toContainText(user.username);

    // Verify the old password no longer works (via API to avoid another UI round trip).
    const oldSignin = await request.post('/api/signin.php', {
      data: { usernameOrEmail: user.username, password: user.password },
    });
    const oldBody = await oldSignin.json();
    expect(oldBody.title).toBe('Sign-In Error');

    // And the new password does work.
    const newSignin = await request.post('/api/signin.php', {
      data: { usernameOrEmail: user.username, password: newPassword },
    });
    const newBody = await newSignin.json();
    expect(newBody.username).toBe(user.username);

    // Update the user object so teardown uses the new password.
    user.password = newPassword;
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + verify**

```bash
npm run test:e2e -- tests/e2e/auth/reset-password.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/auth/reset-password.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for password reset UI flow"
```

---

## Task 7: Auth — delete account via UI

Walk through the full delete flow: re-signin → password confirm → checkbox confirm → deleted.

**Files:**
- Create: `tests/e2e/auth/delete-account.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from '@playwright/test';
import { createTestUser, injectSession } from '../fixtures';

test('user can delete their account via the UI', async ({ request, page }) => {
  const user = await createTestUser(request);

  await injectSession(page, user.session);
  await page.goto('/');
  await expect(page.locator('#signedInLabel')).toBeVisible();

  // Open the delete-account flow. The button lives in the signed-in menu.
  await page.locator('#deleteAccountBtn').click();

  // Step 1: the flow first prompts for sign-in again. Fill the credentials.
  await page.getByLabel('Username or email').fill(user.username);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Step 2: password-confirmation dialog. The password input has no stable
  // ID; scope by dialog role and fill.
  const pwdDlg = page.locator('#pwd-for-del-accnt');
  await expect(pwdDlg).toBeVisible();
  await pwdDlg.locator('input[type=password]').fill(user.password);
  await page.getByRole('button', { name: 'OK' }).click();

  // Step 3: final confirmation with checkbox.
  await page.getByRole('checkbox', { name: /certain/i }).check();
  await page.getByRole('button', { name: 'Delete my account' }).click();

  // After deletion, the sign-in button should be visible again.
  await expect(page.locator('#signInBtn')).toBeVisible();

  // Verify via API that the account is gone (signin should fail).
  const res = await request.post('/api/signin.php', {
    data: { usernameOrEmail: user.username, password: user.password },
  });
  const body = await res.json();
  expect(body.title).toBe('Sign-In Error');
});
```

- [ ] **Step 2: Run**

```bash
npm run test:e2e -- tests/e2e/auth/delete-account.spec.ts
```

If the dialog IDs don't match (the recon showed `#pwd-for-del-accnt` but actual render may differ), use UI mode to inspect and adjust. Same for the `checkbox` role/name regex.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/auth/delete-account.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for delete-account UI flow"
```

---

## Task 8: Editions — new, open, save round-trip

Three combined flows in one spec: create a new edition, save it, open it again fresh. Confirms the round-trip through the UI.

**Files:**
- Create: `tests/e2e/editions/new-open-save.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, injectSession } from '../fixtures';

test('create, save, and reopen an edition via UI', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');

    // Create new
    await page.getByRole('button', { name: 'Create New' }).click();
    await expect(page.locator('#metatab')).toBeVisible();

    // Save via keyboard. First save prompts for a name.
    await page.keyboard.press('Control+s');
    const nameInput = page.getByRole('textbox').first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill('round-trip');
    await page.getByRole('button', { name: 'OK' }).click();

    // Verify stored server-side
    const exists = await request.post('/api/exists.php', {
      data: { token: user.session.token, saveName: 'round-trip' },
    });
    expect(await exists.text()).toBe('true');

    // Reload the page to clear in-memory edition state
    await page.goto('/');

    // Open the saved edition. The open flow lists user's files as buttons.
    await page.locator('#openFileButton').click();
    await page.getByRole('button', { name: 'round-trip' }).click();

    // Editor should be loaded again
    await expect(page.locator('#metatab')).toBeVisible();
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run + verify**

```bash
npm run test:e2e -- tests/e2e/editions/new-open-save.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/editions/new-open-save.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for edition new/open/save round-trip"
```

---

## Task 9: Editions — save-as

Save-As creates a second named copy of an existing edition.

**Files:**
- Create: `tests/e2e/editions/save-as.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, injectSession } from '../fixtures';

test('save-as creates a named copy', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await expect(page.locator('#metatab')).toBeVisible();

    // Initial save
    await page.keyboard.press('Control+s');
    await page.getByRole('textbox').first().fill('original');
    await page.getByRole('button', { name: 'OK' }).click();

    // Save As → different name
    await page.locator('#saveFileAsButton').click();
    const nameInput = page.getByRole('textbox').first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill('copy');
    await page.getByRole('button', { name: 'OK' }).click();

    // Both names should now exist on the server
    const list = await request.post('/api/list.php', {
      data: { token: user.session.token },
    });
    const listBody = await list.json();
    expect(listBody.files).toContain('original');
    expect(listBody.files).toContain('copy');
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run**

```bash
npm run test:e2e -- tests/e2e/editions/save-as.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/editions/save-as.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for save-as"
```

---

## Task 10: Editions — recent files

After saving, `localStorage['recentFile']` should be set, and reloading the page should auto-offer to open it.

**Files:**
- Create: `tests/e2e/editions/recent-files.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, injectSession } from '../fixtures';

test('after saving, localStorage remembers the recent file', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New' }).click();
    await expect(page.locator('#metatab')).toBeVisible();

    await page.keyboard.press('Control+s');
    await page.getByRole('textbox').first().fill('my-recent');
    await page.getByRole('button', { name: 'OK' }).click();

    // Wait a moment for the save to complete and localStorage to update.
    await expect.poll(async () => {
      return await page.evaluate(() => localStorage.getItem('recentFile'));
    }).toBe('my-recent');

    const recentUser = await page.evaluate(() => localStorage.getItem('recentFileUser'));
    expect(recentUser).toBe(user.email);
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run**

```bash
npm run test:e2e -- tests/e2e/editions/recent-files.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/editions/recent-files.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for recent-file localStorage tracking"
```

---

## Task 11: Editions — delete

Delete an edition via the menu, verify it no longer exists.

**Files:**
- Create: `tests/e2e/editions/delete.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, injectSession } from '../fixtures';

test('user can delete an edition via the UI', async ({ request, page }) => {
  const user = await createTestUser(request);

  // Pre-create an edition via the API so the UI flow starts with something to delete.
  await request.post('/api/save.php', {
    data: {
      token: user.session.token,
      saveName: 'todelete',
      edition: { meta: { name: 'To Delete' } },
    },
  });

  try {
    await injectSession(page, user.session);
    await page.goto('/');

    // Click Delete in the File menu
    await page.locator('#deleteFileButton').click();

    // The delete flow shows a file picker — pick our edition
    await page.getByRole('button', { name: 'todelete' }).click();

    // There's usually a confirmation dialog. Accept.
    // Pattern: yes-no-dlg renders "Yes" and "No" buttons.
    await page.getByRole('button', { name: /^(Yes|Delete|OK|Confirm)$/ }).click();

    // Verify server-side deletion
    await expect.poll(async () => {
      const r = await request.post('/api/exists.php', {
        data: { token: user.session.token, saveName: 'todelete' },
      });
      return await r.text();
    }).toBe('false');
  } finally {
    await deleteTestUser(request, user);
  }
});
```

- [ ] **Step 2: Run**

```bash
npm run test:e2e -- tests/e2e/editions/delete.spec.ts
```

If the confirmation-dialog button name regex doesn't match, inspect with UI mode — the yes-no-dlg may render different text. Don't guess; observe.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/editions/delete.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for edition delete flow"
```

---

## Task 12: Editions — import from JSON file

Use `setInputFiles` to inject a JSON edition file through the hidden `#jsonFileInput`.

**Files:**
- Create: `tests/e2e/fixtures/sample-edition.json`
- Create: `tests/e2e/editions/import-json.spec.ts`

- [ ] **Step 1: Create the fixture JSON**

Write `tests/e2e/fixtures/sample-edition.json`:

```json
{
  "meta": { "name": "Imported Edition" },
  "almanac": { "synopsis": "Imported via Playwright" },
  "characterList": [
    {
      "id": "importedchar",
      "name": "Imported Character",
      "team": "townsfolk",
      "ability": "You start knowing something important."
    }
  ],
  "firstNightOrder": ["importedchar"],
  "otherNightOrder": ["importedchar"]
}
```

- [ ] **Step 2: Write the spec**

```typescript
import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { createTestUser, deleteTestUser, injectSession } from '../fixtures';

const SAMPLE_PATH = path.join(__dirname, '..', 'fixtures', 'sample-edition.json');

test('user can import an edition from a JSON file', async ({ request, page }) => {
  const user = await createTestUser(request);
  try {
    await injectSession(page, user.session);
    await page.goto('/');

    // The hidden file input triggers when the menu button is clicked, but
    // it's also directly targetable via setInputFiles.
    await page.locator('#jsonFileInput').setInputFiles(SAMPLE_PATH);

    // Wait for the editor to display the imported edition's name.
    await expect(page.locator('#metatab')).toBeVisible();
    // The window title or metatab should reflect the imported name.
    // Exact selector for the edition-name field is TBD during implementation
    // — observe with UI mode and assert on a visible-text element that
    // reflects "Imported Edition".
    await expect(page.getByText('Imported Edition').first()).toBeVisible();
  } finally {
    await deleteTestUser(request, user);
  }
});
```

> **Implementer note:** the "TBD during implementation" above is NOT a placeholder — it's a directive to use UI mode to observe the rendered DOM and pick the right text-containing element to assert on. The final assertion MUST be concrete. If the imported name appears as a window title, use `page.title()`. If it's in an input field, use `inputValue()`. If it's in a label, use `getByText()`. Don't ship a vague assertion.

- [ ] **Step 3: Run**

```bash
npm run test:e2e -- tests/e2e/editions/import-json.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/fixtures/sample-edition.json tests/e2e/editions/import-json.spec.ts
git commit --no-gpg-sign -m "Add Playwright spec for JSON edition import"
```

---

## Task 13: CI — extend `integration.yml`

Add a `playwright-e2e` job that runs after (or in parallel with) `hurl-api`.

**Files:**
- Modify: `.github/workflows/integration.yml`

- [ ] **Step 1: Update the workflow**

Replace the existing file with:

```yaml
name: Integration tests

on:
  pull_request:
    branches: [dev, stable]
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  hurl-api:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - name: Install Hurl
        run: |
          curl -fsSL -o /tmp/hurl.deb \
            https://github.com/Orange-OpenSource/hurl/releases/download/7.1.0/hurl_7.1.0_amd64.deb
          sudo dpkg -i /tmp/hurl.deb
          hurl --version

      - name: Run API test suite
        run: ./scripts/run-api-tests.sh

      - name: Upload Hurl report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: hurl-report
          path: tests/api/.hurl-report
          if-no-files-found: ignore

  playwright-e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install Node dependencies
        run: npm ci

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
          restore-keys: playwright-${{ runner.os }}-

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E test suite
        run: ./scripts/run-e2e-tests.sh

      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report
          if-no-files-found: ignore

      - name: Upload traces on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces
          path: test-results
          if-no-files-found: ignore
```

- [ ] **Step 2: Validate YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/integration.yml'))" 2>/dev/null || \
  yq '.' .github/workflows/integration.yml > /dev/null
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/integration.yml
git commit --no-gpg-sign -m "Extend integration.yml with Playwright E2E job"
```

---

## Task 14: End-to-end verification

Prove the whole Phase 4 suite runs clean from a cold start.

**Files:** none (behavioral).

- [ ] **Step 1: Clean slate**

```bash
./scripts/test-stack.sh down 2>/dev/null || true
docker volume ls | grep bloodstar-test || echo "clean"
```

- [ ] **Step 2: Cold-start full suite**

```bash
time npm run test:e2e
```

Expected: stack up → 13 specs pass (5 smoke + 4 auth + 4 editions) → stack down → exit 0. Total under 5 min on a warm-cache machine.

Record the timing. Note any flaky specs. Inspect any failure with `npm run test:e2e:ui` before declaring Phase 4 done.

- [ ] **Step 3: Full test chain**

```bash
npm run test:all
```

Expected: Vitest (88 tests) → Hurl (20 files) → Playwright (13 specs) — all green, exit 0.

- [ ] **Step 4: Optional tag**

```bash
git tag testing/phase-4-complete
```

---

## Acceptance criteria for Phase 4

1. `npm run test:e2e` brings up the stack, runs all 13 specs (5 smoke + 4 auth + 4 editions), tears down, exits 0.
2. Every spec uses `getByRole`/`getByLabel`/`getByText` where possible; `#id` selectors appear only where no accessible handle exists.
3. Every spec is self-contained — creates + deletes its own scratch user.
4. No spec leaves DB rows or filesystem artifacts after teardown.
5. `.github/workflows/integration.yml` has a `playwright-e2e` job that passes on the pushed branch (Chromium only).
6. `npm run test:all` chains Vitest + Hurl + Playwright, all green.
7. No production source file modified — Phase 4 is purely additive.
8. `playwright.config.ts` sets `workers: 1` until Phase 5 lifts that via per-spec email filtering.

## Out of scope for Phase 4

- Characters, images, night-order, sharing, publish, dialogs, mobile spec groups — **Phase 5**.
- Firefox/WebKit in CI — **Phase 6** (nightly matrix).
- Pixel-level visual regression.
- Load/perf testing.
- Refactoring RED trio (`state-history.ts`, `team-color.ts`, `recent-file.ts`) beyond the Phase 2 `typeof window` guards — they're covered here via UI behavior.

## Anticipated gotchas

- **Some specs (save, delete, reset) involve dialog sequences the UI may render slightly differently from what the recon showed.** Specs use `getByRole` where possible; where `#id` selectors are used and the ID isn't present, Playwright fails fast with a clear error — adjust the selector, don't guess.
- **The `Ctrl+S` / `Control+S` keyboard shortcut works cross-platform in Playwright** — Linux uses Control, macOS can use Meta, but Chromium in Playwright interprets `Control+s` correctly on both. Don't switch to Meta.
- **Mailhog inbox accumulates across specs.** Phase 4 uses per-email filtering (`getLatestEmailTo(email)`) so parallelism isn't technically required to be 1 — but we keep `workers: 1` for safety. Phase 5 can relax.
- **Confirmation emails take ~1 second** to land in mailhog after signup. `getLatestEmailTo` polls for up to 10s. If a spec is slow for this reason, that's expected.
- **The first save of a new edition prompts for a name** (save-as behavior). The spec does this explicitly; don't remove.
- **Some menu items (`#signOutBtn`) live inside a submenu** that requires hover/click on the parent first. If a direct `.click()` fails, add `await page.locator('#signedInMenu').hover()` before the click.
