# Tests

Three test layers. See
[`docs/superpowers/specs/2026-04-20-testing-infrastructure-design.md`](../docs/superpowers/specs/2026-04-20-testing-infrastructure-design.md)
for the full design and
[`docs/superpowers/plans/`](../docs/superpowers/plans/) for the
phase-by-phase implementation plans.

| Dir       | Framework  | Count | Purpose                                          |
|-----------|------------|-------|--------------------------------------------------|
| unit/     | Vitest     | 88    | Pure TypeScript: model, validation, helpers.     |
| api/      | Hurl       | 20    | HTTP contract against the test Compose stack.    |
| e2e/      | Playwright | 42    | Browser flows against the test Compose stack.    |

## Running

| Command                 | What it does                                                       |
|-------------------------|--------------------------------------------------------------------|
| `npm test`              | Vitest unit suite. No Docker required. ~200 ms.                    |
| `npm run test:api`      | Stack up → Hurl → stack down. Leak-checks the DB and filesystem.   |
| `npm run test:e2e`      | Stack up → Playwright (Chromium only) → stack down.                |
| `npm run test:e2e:ui`   | Interactive Playwright UI mode. Stack up manually first, or this starts it for you. |
| `npm run test:all`      | Unit → API → E2E. Fail-fast.                                       |
| `npm run test:stack:up` | Start the Docker test stack (for ad-hoc debugging).                |
| `npm run test:stack:down` | Tear down the stack + wipe volumes.                              |

### Running specific specs

- One Hurl file: `hurl --test --jobs 1 --variables-file tests/api/env.test tests/api/auth/signup.hurl`
- One Playwright spec: `npx playwright test tests/e2e/smoke/health.spec.ts` (stack must be up).
- Playwright UI mode on a single file: `npx playwright test tests/e2e/smoke/health.spec.ts --ui`.

### Running with non-Chromium browsers

`E2E_PROJECTS` controls which Playwright projects `test:e2e` runs:

- `E2E_PROJECTS=chromium npm run test:e2e` (default)
- `E2E_PROJECTS=firefox npm run test:e2e`
- `E2E_PROJECTS=webkit npm run test:e2e`
- `E2E_PROJECTS=chromium,firefox,webkit npm run test:e2e` (matches the nightly CI matrix)
- `E2E_PROJECTS=all npm run test:e2e` — passes no `--project` filter; Playwright runs every defined project.

Install browsers first: `npx playwright install firefox webkit` (only needed once, or after a Playwright upgrade).

## CI

| Workflow                 | Trigger                   | What runs                                            |
|--------------------------|---------------------------|------------------------------------------------------|
| `unit.yml`               | Every push                | Vitest                                               |
| `integration.yml`        | PR to `dev`/`stable`      | Hurl + Playwright (Chromium only)                    |
| `nightly.yml`            | 03:00 UTC + manual        | Playwright matrix: Chromium + Firefox + WebKit       |

Nightly failures auto-file a GitHub issue titled "Nightly test failure on `<branch>`" with a link to the run + artifacts (report + traces).

## Fixtures

- `tests/fixtures/protected/` — throwaway JWT keys and DB-config JSON. Bind-mounted read-only into the app container.
- `tests/fixtures/published/` — default `almanac.css` / `print.css` seeded into the published volume on `up`.
- `tests/api/fixtures/` — shared Hurl-suite inputs (e.g., `tiny.png`).
- `tests/e2e/fixtures/` — Playwright helpers (`test`, `mailhog`, `test-user`, `drag`) **and** per-feature fixtures like `images/red-64.png`.

These files are *test* fixtures — never reuse them in any deployed system.

## Writing specs

### Playwright (E2E)

1. Import `test`, `expect`, and helpers from `'../fixtures'` (not from `@playwright/test` directly — you'd miss the route-rewrite fixture that sends API calls to the local stack).
2. Create a scratch user via `createTestUser(request)`; delete it in `finally` via `deleteTestUser(request, user)`.
3. Use `injectSession(page, user.session)` **before** `page.goto('/')` so the app starts already signed in (no UI sign-in dance for non-auth specs).
4. Prefer accessibility locators: `getByRole('button', { name: 'Save' })`, `getByLabel('Email')`. Fall back to `#id` only when no accessible handle exists.
5. Scope dialog assertions via `getByRole('dialog').filter({ hasText: ... })` — never hardcode `#dialog-id1` (the app appends a global counter).
6. Commit edit-field changes with `.press('Tab')` after `.fill()` so the observable-property binding fires.
7. For drag-reorder, use `dragListItem(page, listSelector, fromIndex, toIndex)` from `tests/e2e/fixtures/drag.ts`. Native HTML5 drag events are dispatched via `page.evaluate()`; neither `locator.dragTo()` nor `page.mouse` work reliably with this app.

### Hurl (API)

1. Every file is self-contained: signup → fetch code from mailhog → confirm → capture JWT → do the thing → delete the account.
2. Mailhog inbox is shared across the whole run; tests run **serially** (`--jobs 1`). Never rely on parallelism.
3. Use `[Options] variable: name=…` on the first request to declare per-file constants that later requests reference with `{{name}}`.
4. Extract 6-digit codes with `regex "(\\d{6})"` (the capture group is required in Hurl 7).

### Vitest (unit)

1. Pure functions only — no DOM, network, or localStorage.
2. One test file per source file, colocated by name under `tests/unit/...`.
3. Test the *behavior* (input → output), not the implementation.

## Debugging

- **Playwright failure in CI**: download the `playwright-report-<browser>` and `playwright-traces-<browser>` artifacts from the workflow run. Open `playwright-report/index.html` locally.
- **Local Playwright failure**: `npm run test:e2e:ui` to step through in the inspector.
- **Stack won't come up**: `./scripts/test-stack.sh up && ./scripts/test-stack.sh logs app` (or `logs db`) to see container output.
- **Leak check fails**: run `./scripts/test-stack.sh leak-check` after a run to see which table/directory still has rows.
- **Flaky spec**: run `npx playwright test path/to/spec.ts --repeat-each=10` to reproduce. 10/10 passes + `fill()` or `dragListItem()` usage usually means it's not flaky; 0/10 under one browser and green under another means a browser-specific issue.

## Serial execution (workers: 1)

`playwright.config.ts` sets `workers: 1` and `fullyParallel: false` because
every spec captures confirmation codes from the shared mailhog inbox using
the "newest message for this email" idiom (or by filter — see
`fixtures/mailhog.ts:getLatestEmailTo`). Running specs in parallel would
race on the inbox.

Lifting this constraint requires switching all specs to per-email filters
*and* handling the case where mailhog returns multiple matches for a single
email during signup+resend flows. Left for a future follow-up — the current
serial runtime (~1 min per browser) is acceptable.

## Known quirks

- **`src/config.ts` hardcodes `SITE_ROOT = https://bloodstar.clocktica.com`** — browser-side API calls target production. Playwright's `tests/e2e/fixtures/test.ts` intercepts and rewrites to `localhost:8086`. When that hardcoding is fixed, the route-rewrite fixture can be removed.
- **Dialog IDs have a global counter** (see `src/dlg/aria-dlg.ts`'s `unique` variable). Use role + text filters, not `#id`.
- **Mobile build at `/m.html`** is the same code as desktop with curtain-based menus. Mobile detection in `src/main.ts` is UA-based; tests navigate `/m.html` directly.
