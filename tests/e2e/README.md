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
