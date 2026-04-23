# Testing Infrastructure Design

**Date:** 2026-04-20
**Status:** Approved design, pending implementation plan
**Author:** Brainstormed with Claude

## Motivation

Bloodstar Clocktica currently has no automated tests. The maintainer is
planning major refactors — most notably replacing the PHP backend — and
needs a test suite that:

1. Catches regressions during those refactors.
2. Exercises **user-visible behavior**, not internals, so the tests survive
   a backend rewrite and frontend restructuring.
3. Runs reliably in CI and easily on a developer machine.

The suite's HTTP-level tests double as the executable specification that
any replacement backend must satisfy.

## Goals

- Comprehensive coverage of user-facing features (all flows, not just
  critical paths).
- Three complementary layers: unit (pure TS), API (HTTP contract), E2E
  (browser).
- Fully reproducible test environment in Docker.
- Green-on-every-PR integration suite; nightly full browser matrix.
- Refactor-durable assertions: by role, label, text, and HTTP contract —
  not by CSS class names or internal DOM structure.

## Non-goals

- Performance, load, or security testing.
- Visual-regression (pixel-diff) testing.
- A coverage-percentage gate.
- Testing PHP internals. We test the HTTP contract only.

## Architecture

Three test layers in one repository:

```
tests/
├── unit/      Vitest — pure TS: model/, validate.ts, team-color.ts, etc.
├── api/       Hurl — HTTP contract against a running Compose stack
└── e2e/       Playwright — browser-level flows against a running Compose stack
```

Tests run against a dedicated `docker-compose.test.yaml` stack isolated
from any dev stack by named volumes and alternate host ports.

### Tooling choices

| Layer | Framework | Why |
|-------|-----------|-----|
| Unit  | Vitest    | Fast, ESM/TS-native, Jest-compatible API, integrates cleanly with the existing webpack/TS setup. |
| API   | Hurl      | Plain-text declarative tests, first-class captures (JWT reuse across requests) and JSONPath asserts, single binary for CI, git-friendly diffs. Doubles as living API documentation. |
| E2E   | Playwright | Multi-browser (Chromium/Firefox/WebKit), auto-waiting, network interception, trace viewer for debugging CI failures, TypeScript-native. |

### Orchestration

A new `docker-compose.test.yaml` brings up:

- **app** — built from the local `Dockerfile` (not a published image, so
  uncommitted code is exercised). Exposed on host port **8086**.
- **db** — `mariadb:latest` using a **named volume** (not a bind mount) so
  `docker compose down -v` fully wipes it. `schema.sql` auto-loaded via
  `/docker-entrypoint-initdb.d/`.
- **mailhog** — `mailhog/mailhog:latest`. SMTP on 1025, HTTP API on 8025.
  Used by both Hurl and Playwright to read emails sent by signup/reset
  flows.

Persistent state is mounted as follows:

- `/var/www/protected/` — bind-mounted from `tests/fixtures/protected/`
  (read-only). Contains the throwaway JWT keys and the DB-config JSON.
  Committed to the repo for determinism; no production system uses these
  secrets.
- `/var/www/html/usersave/` and `/var/www/html/p/` — backed by named
  volumes that are wiped on `docker compose down -v` between runs.

All test ports are offset by +1 from the defaults so a dev can run the
test stack alongside a live dev stack.

## Unit layer (Vitest)

**Scope:** pure functions and data models only — no DOM, no network, no
`localStorage`. Runs under Node.

**Target modules:**

- `src/model/edition.ts`, `character.ts`, `character-almanac.ts`,
  `edition-almanac.ts`, `edition-meta.ts`, `blood-team.ts`,
  `character-image-settings.ts`, `special.ts`
- `src/validate.ts`, `src/team-color.ts`, `src/state-history.ts`,
  `src/util.ts`, `src/recent-file.ts`

**Setup:** `vitest.config.ts` in the repo root, matches
`tests/unit/**/*.test.ts`, uses the existing `tsconfig.json`.

**Test shape:** one `.test.ts` per covered source file, colocated by name
(`tests/unit/model/character.test.ts`). Assertions target behavior:
JSON round-trip, validation edge cases (including the 200-char ability
bump from commit `584e11e`), `state-history` undo/redo invariants,
team-color boundary transitions.

**Coverage goal:** every exported function in the listed modules has at
least one golden-path test and one edge-case test. No
coverage-percentage gate.

**Excluded:** anything that touches `document`, `fetch`, or
`localStorage` — that belongs in Playwright.

## API layer (Hurl)

**Scope:** every endpoint in `dist/api/` exercised against the running
Compose stack. These files are the executable spec the replacement
backend must satisfy.

**Layout** (organized by feature area so endpoint splits/merges during
refactor don't force a restructure):

```
tests/api/
├── env.test                   variables file (base URL, mailhog URL, etc.)
├── fixtures/
│   ├── seed.sql               extra rows beyond schema.sql (if needed)
│   ├── edition.json           sample edition payload
│   └── character.png          tiny test image
├── auth/
│   ├── signup.hurl            signup → mailhog fetch → confirm → signin
│   ├── signin.hurl            valid, wrong-password, unknown-user, email-vs-username
│   ├── reset-password.hurl    request → mailhog → reset → signin with new
│   └── delete-account.hurl    full account teardown
├── editions/
│   ├── save-open.hurl         save → list → open → assert round-trip
│   ├── publish.hurl           publish → GET /p/<edition> → assert almanac JSON
│   ├── delete.hurl
│   └── images.hurl            save-img + retrieval
├── sharing/
│   ├── share.hurl             owner shares → sharee lists → opens
│   ├── unshare.hurl
│   ├── leave.hurl             sharee leaves
│   └── permission.hurl        permission checks for non-owners
├── social/
│   ├── block.hurl
│   ├── unblock.hurl
│   └── get-blocked.hurl
└── misc/
    ├── exists.hurl            username availability
    ├── validate.hurl          JWT validation
    ├── cull.hurl
    ├── allpublished.hurl
    └── health.hurl            new health endpoint
```

**Isolation:** per-test setup/teardown. Each `.hurl` file opens with a
signup or scratch-account creation using a unique email
(`test-${uuid}@test.local`) and closes with a delete-account call. No
cross-file shared state.

**Captures:** JWT from signin is captured in `[Captures]` and reused in
subsequent `Authorization:` headers within the file. Hurl's
`[Captures]` + `[Asserts]` blocks double as the contract documentation.

**Mailhog integration:** email-driven flows fetch from the mailhog HTTP
API (`http://mailhog:8025/api/v2/messages`) to extract confirmation and
reset links. No SMTP probing.

**Runner:** `npm run test:api` runs
`scripts/test-stack.sh up && hurl --test --variables-file
tests/api/env.test tests/api/**/*.hurl && scripts/test-stack.sh down`.

## E2E layer (Playwright)

**Scope:** comprehensive user-visible coverage across all feature areas.
Assertions target rendered text, visible elements, and post-action
state — **not** internal class names, DOM structure, or private APIs.

**Layout:**

```
tests/e2e/
├── playwright.config.ts       baseURL from env, Chromium on PR, full matrix nightly
├── fixtures/
│   ├── auth.ts                API-based login helper (skips UI for non-auth specs)
│   ├── edition.ts             API-based edition creation helper
│   ├── images/                tiny PNGs for upload specs
│   └── mailhog.ts             helper to fetch/parse confirmation emails
├── smoke/                     ~5 specs: sign in, create edition, add character, save, publish
├── auth/                      signup, confirm, signin (wrong pw, unknown user, session persistence), reset-password, delete-account, sign-out
├── editions/                  new, open, save, save-as, recent-files, delete, undo/redo, import, export
├── characters/                add, remove, rename, reorder, filter/search, team change, ability text, 200-char limit
├── images/                    upload, crop, replace, remove, settings (colorize, gradient)
├── night-order/               drag-and-drop reorder first-night/other-night, minion/demon info thresholds
├── sharing/                   share dialog, shared list, unshare, leave, permissions for non-owner
├── publish/                   publish flow, published URL contents, almanac CSS load
├── dialogs/                   yes-no, save-discard-cancel, sharing-dlg, spinner, string-dlg, message-dlg
└── mobile/                    m.html flows, viewport-sized specs
```

**Auth shortcut:** every non-auth spec uses an API-based login helper
(signup + signin via `request`) that stashes the JWT cookie, so specs
don't pay a UI signup cost. Auth specs themselves exercise the UI.

**Per-test isolation:** each spec creates a fresh scratch account
(`test-${workerId}-${nanoid}@test.local`) in `beforeEach` and deletes it
in `afterEach`. The `workerId` prefix lets Playwright parallelize safely.

**Selectors:** prefer `getByRole`, `getByLabel`, `getByText` over CSS
selectors. This is the primary refactor-durability lever —
`page.locator('.btn-save-primary')` breaks on restyle;
`page.getByRole('button', { name: 'Save' })` does not.

**Image upload specs:** real file uploads via `setInputFiles` with
tiny fixture PNGs. Crop/resize assertions check image presence and
resulting dimensions, not pixel content.

**On failure:** Playwright's trace, screenshot, and video are uploaded
as GitHub Actions artifacts. `npx playwright test --ui` for local
debugging.

**Coverage goal:** every user action path in the app has at least one
spec. Rough size estimate: 40–60 specs. Full enumeration happens during
plan writing.

## Health endpoint (new code)

A new `dist/api/health.php` endpoint is required for stack-readiness
checks. (The existing `test.php` is unsuitable for this purpose.)

**Contract:**

- `GET /api/health.php` (no auth).
- On success: `200` + `{"status":"ok","db":"ok"}`.
- On DB failure: `503` + `{"status":"degraded","db":"error"}`.
- Side-effect-free (the DB check is a trivial `SELECT 1`).
- Response body contains no sensitive information (no version numbers,
  no connection strings, no reflected query params).

The replacement backend must satisfy this same contract. It is covered
by `tests/api/misc/health.hurl`.

## Docker test stack

**File:** `docker-compose.test.yaml` at the repo root.

**Services:**

- `app` — built from the local `Dockerfile`. Published on host port
  `8086`. Environment points at mailhog for SMTP. Healthcheck hits
  `/api/health.php` every 5 s with a 60 s start period.
- `db` — `mariadb:latest`. Named volume `test_db_data`. Mounts
  `schema.sql` into `/docker-entrypoint-initdb.d/` so the DB
  auto-initializes on first up.
- `mailhog` — `mailhog/mailhog:latest`. SMTP on 1025, HTTP on 8025
  (host-exposed on 8026).

**Volumes:** all named, so `docker compose down -v` fully wipes state.

**JWT keys:** test keys live at `tests/fixtures/protected/jwt_key.pem`
and `tests/fixtures/protected/jwt_key.pub`, generated once and committed.
They are throwaway; no production system uses them. Mounted into the
container at `/var/www/protected/` alongside the DB-config JSON.

**Startup script:** `scripts/test-stack.sh` wraps
`docker compose -f docker-compose.test.yaml -p bloodstar-test …` with
health-wait logic. Used by both `npm run test:api` and
`npm run test:e2e`, and by CI.

## Local developer experience

`package.json` gains these scripts:

- `test` — Vitest unit suite (no Docker needed).
- `test:api` — Hurl, spins up and tears down the test stack.
- `test:e2e` — Playwright, spins up and tears down the test stack.
- `test:e2e:ui` — Playwright UI mode for interactive debugging.
- `test:all` — runs `test`, then `test:api`, then `test:e2e`. Fail-fast.

A dev reproduces a CI failure with the identical command the CI runs.
No CI-only magic.

## CI (GitHub Actions)

Three workflows:

### `.github/workflows/unit.yml`
- Trigger: every push to any branch.
- Steps: Node setup → `npm ci` → `npm run test`.
- Expected runtime: <1 min.

### `.github/workflows/integration.yml`
- Trigger: every PR to `dev` or `stable`.
- Steps: build Docker image from PR code → bring up
  `docker-compose.test.yaml` → wait for health → run Hurl suite → run
  Playwright (Chromium only) → tear down.
- Artifacts on failure: `hurl-report.html`, `playwright-report/`, traces,
  videos.
- Concurrency: `cancel-in-progress: true` on PR ref so superseded pushes
  don't pile up.
- Expected runtime: 5–10 min.

### `.github/workflows/nightly.yml`
- Trigger: scheduled (03:00 UTC) + `workflow_dispatch`.
- Same as `integration.yml` but Playwright matrix across Chromium,
  Firefox, and WebKit.
- Failure handler: opens/updates a GitHub issue titled "Nightly test
  failure on dev" with artifact links.

**Caching:** `node_modules` via `actions/setup-node`; Playwright browsers
via `actions/cache` keyed on Playwright version.

## Phasing

Six independently mergeable phases. Each leaves the repo in a green,
useful state.

### Phase 1 — Foundations
- `docker-compose.test.yaml` with app + db + mailhog, named volumes
- `dist/api/health.php` endpoint + test key fixtures
- `scripts/test-stack.sh` (up, down, wait-for-health)
- `package.json` scripts: `test`, `test:api`, `test:e2e`, `test:all`,
  `test:e2e:ui`
- Directory skeleton: `tests/{unit,api,e2e}/`
- `.github/workflows/unit.yml` wired up (empty suite OK)

### Phase 2 — Unit layer (Vitest)
- `vitest.config.ts`, `tests/unit/` scaffolding
- Cover `validate.ts`, `util.ts`, `team-color.ts`, `state-history.ts`,
  `recent-file.ts`
- Cover `model/*.ts` round-trip + edge cases
- Green `unit.yml` CI

### Phase 3 — API layer (Hurl)
- `tests/api/auth/` — signup, confirm-via-mailhog, signin, reset,
  delete-account
- `tests/api/editions/` — save/open/list/publish/delete/images
- `tests/api/sharing/` — share/unshare/leave/permission
- `tests/api/social/` — block/unblock/get-blocked
- `tests/api/misc/` — exists/validate/cull/allpublished/health
- `integration.yml` runs Hurl

### Phase 4 — Playwright: smoke + auth + editions
- `playwright.config.ts`, API-based auth helper, mailhog helper
- `smoke/`, `auth/`, `editions/` spec groups
- `integration.yml` now also runs Playwright (Chromium)

### Phase 5 — Playwright: feature breadth
- `characters/`, `images/`, `night-order/`, `sharing/`, `publish/`,
  `dialogs/`, `mobile/`
- Full spec enumeration at plan-writing time

### Phase 6 — Nightly matrix + polish
- `nightly.yml` with Firefox + WebKit added
- Flake triage: any spec that fails intermittently gets fixed,
  quarantined, or deleted. No long-term `.skip` markers.
- Brief `tests/README.md` covering: how to run, how to debug a failing
  spec, how to add a new spec for each layer.

## Decisions log

Summary of choices made during brainstorming:

- **Hybrid strategy** (unit + API + E2E) over unit-only or e2e-only.
- **Declarative API tests** (not TypeScript/Node, not PHPUnit) — Hurl
  specifically, so the tests survive a backend rewrite and double as
  living API documentation.
- **Playwright** over Cypress/Selenium — multi-browser, trace viewer,
  cleaner auth-cookie handling.
- **Vitest** included for pure-TS modules; defers to E2E for anything
  DOM-touching.
- **Dedicated `docker-compose.test.yaml`** with mailhog and named volumes,
  not a shared dev stack.
- **Comprehensive scope** (40–60 Playwright specs) because the suite's
  purpose is refactor safety.
- **GitHub Actions** CI with locally-reproducible commands; Chromium on
  PR, full matrix nightly.
- **Per-test setup/teardown** for maximum isolation; scratch accounts
  scoped by worker ID for safe parallelism.
- **Refactor-agnostic assertions** — assert on user-visible behavior only.
- **New `/api/health.php` endpoint** added (not reusing `test.php`).

## Out of scope for this spec

- Load/performance testing.
- Pixel-level visual regression.
- Security testing (separate concern).
- Coverage-percentage gates.
- Enumerating every Playwright spec by name — happens at plan-writing
  time.
