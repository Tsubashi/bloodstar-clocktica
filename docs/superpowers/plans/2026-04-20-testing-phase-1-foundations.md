# Testing — Phase 1: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the harness that every other test phase depends on: a dedicated `docker-compose.test.yaml` stack (app + MariaDB + mailhog), a new `/api/health.php` endpoint, a startup script, test directory skeleton, `npm` test scripts, and a passing Vitest-ready CI workflow.

**Architecture:** A new `docker-compose.test.yaml` at repo root brings up the production-equivalent app image, a disposable MariaDB (named volume, schema auto-loaded from `schema.sql`), and mailhog (for later email-driven tests). The `app` healthcheck hits a new auth-free `/api/health.php` endpoint that `SELECT 1`s the DB. A `scripts/test-stack.sh` wraps `docker compose` with health-wait logic so the same command runs locally and in CI. Throwaway JWT keys + DB config JSON live under `tests/fixtures/protected/` and are bind-mounted into the app container at `/var/www/protected/`.

**Tech Stack:** Docker Compose, MariaDB, mailhog, PHP (nginx+php-fpm via `trafex/php-nginx`), Bash, GitHub Actions. No Node/TS/Playwright yet — those arrive in later phases.

**Spec reference:** [`docs/superpowers/specs/2026-04-20-testing-infrastructure-design.md`](../specs/2026-04-20-testing-infrastructure-design.md)

**User preference:** The user runs all `git commit` / `git push` commands themselves (gpg-signing blocks non-interactive shells). This plan presents the commands as instructions, not as runnable steps.

---

## Task 1: Test fixtures (JWT keys, DB config, published CSS, gitignore carve-out)

Creates the persistent state fixtures the app container needs. These are throwaway — no production system uses them.

**Files:**
- Create: `tests/fixtures/protected/README.md`
- Create: `tests/fixtures/protected/db` (JSON file; no extension — matches prod convention)
- Create: `tests/fixtures/protected/jwt_key.pem` (generated)
- Create: `tests/fixtures/protected/jwt_key.pub` (generated)
- Create: `tests/fixtures/published/almanac.css` (copy of `persistent/published/almanac.css`)
- Create: `tests/fixtures/published/print.css` (copy of `persistent/published/print.css`)
- Modify: `.gitignore` — add carve-out so `tests/fixtures/` is not ignored despite any `persistent/`-style rules.

- [ ] **Step 1: Create directory skeleton**

Run:
```bash
mkdir -p tests/fixtures/protected tests/fixtures/published
```
Expected: directories created without error.

- [ ] **Step 2: Generate throwaway JWT keypair**

Run:
```bash
openssl genrsa -out tests/fixtures/protected/jwt_key.pem 2048
openssl rsa -in tests/fixtures/protected/jwt_key.pem -pubout -out tests/fixtures/protected/jwt_key.pub
```
Expected: both files created, each ~1.7 KB / ~450 B. Add a permissions step so the keys are readable by the container user:
```bash
chmod 644 tests/fixtures/protected/jwt_key.pem tests/fixtures/protected/jwt_key.pub
```

- [ ] **Step 3: Write DB config JSON**

Create `tests/fixtures/protected/db` with this content (no `.json` extension — production reads a file literally named `db`):

```json
{
  "host": "db",
  "username": "bloodstar_user",
  "password": "bloodstar_test_password",
  "db": "bloodstar_db"
}
```

- [ ] **Step 4: Write README explaining these are throwaway**

Create `tests/fixtures/protected/README.md`:

```markdown
# Test fixtures — protected secrets

These files are **throwaway test credentials**. They are committed to the repo
on purpose so the test stack is reproducible in CI without external secret
management.

- `db` — DB connection config for the MariaDB service in
  `docker-compose.test.yaml`. Matches the env vars set on that service.
- `jwt_key.pem` / `jwt_key.pub` — RSA keypair used by `dist/api/jwt.php` for
  signing/verifying session tokens. Regenerated whenever you like; no
  production system uses them.

**Never** reuse these credentials or keys for any deployed instance.
```

- [ ] **Step 5: Copy default published CSS**

Run:
```bash
cp persistent/published/almanac.css tests/fixtures/published/almanac.css
cp persistent/published/print.css   tests/fixtures/published/print.css
```
Expected: two `.css` files in `tests/fixtures/published/`.

- [ ] **Step 6: Verify `.gitignore` does not exclude fixtures**

Run:
```bash
git check-ignore -v tests/fixtures/protected/jwt_key.pem
```
Expected: exit code 1 and no output (file is NOT ignored). The existing `.gitignore` ignores `persistent/`, not `tests/`, so no changes needed.

If the command returns an ignore rule, add this line to `.gitignore`:
```
!tests/fixtures/**
```

- [ ] **Step 7: Commit (user runs)**

User command:
```bash
git add tests/fixtures/
git commit -m "Add throwaway test fixtures for Docker test stack"
```

---

## Task 2: Health endpoint (`dist/api/health.php`)

A new auth-free endpoint used by Docker healthcheck and by the API test suite. Returns `200 {"status":"ok","db":"ok"}` on success, `503 {"status":"degraded","db":"error"}` on DB failure. Side-effect-free: only runs `SELECT 1`.

**Files:**
- Create: `dist/api/health.php`

- [ ] **Step 1: Write the failing end-to-end check**

We're introducing new behavior in PHP without a unit-test harness. The behavioral test is an `curl` against a running container, captured as an expected command. Write a scratch script `/tmp/health-check.sh`:

```bash
#!/usr/bin/env bash
set -eu
URL=${1:-http://localhost:8086/api/health.php}
HTTP_CODE=$(curl -s -o /tmp/health-body.json -w "%{http_code}" "$URL")
echo "HTTP $HTTP_CODE"
cat /tmp/health-body.json
echo
test "$HTTP_CODE" = "200"
grep -q '"status":"ok"' /tmp/health-body.json
grep -q '"db":"ok"'     /tmp/health-body.json
```
Run:
```bash
chmod +x /tmp/health-check.sh
/tmp/health-check.sh
```
Expected at this step: connection refused / 404 / 500 — the endpoint doesn't exist yet and the container isn't running. This is the failing-test baseline.

- [ ] **Step 2: Create `dist/api/health.php`**

Write this file verbatim:

```php
<?php
    header('Content-Type: application/json');

    try {
        require_once('shared.php');
        $mysqli = @makeMysqli();
        if ($mysqli->connect_errno) {
            http_response_code(503);
            echo json_encode(['status' => 'degraded', 'db' => 'error']);
            exit();
        }
        $result = @$mysqli->query('SELECT 1');
        if ($result === false) {
            http_response_code(503);
            echo json_encode(['status' => 'degraded', 'db' => 'error']);
            exit();
        }
        $result->free();
        $mysqli->close();
        http_response_code(200);
        echo json_encode(['status' => 'ok', 'db' => 'ok']);
    } catch (Throwable $e) {
        http_response_code(503);
        echo json_encode(['status' => 'degraded', 'db' => 'error']);
    }
?>
```

Notes on this code:
- Uses the existing `shared.php` + `makeMysqli()` pattern so the replacement backend just has to provide an equivalent.
- `@` on `makeMysqli()` and `query()` suppresses PHP warnings going to the response body.
- `Throwable` catches both `Exception` and `Error` so fatal missing-file or malformed-JSON conditions still yield a JSON 503.
- No version numbers, no reflected query params — matches the spec's no-sensitive-info requirement.

- [ ] **Step 3: Verification deferred**

This endpoint is verified end-to-end in Task 9 once the Compose stack exists. No Task-2-local run.

- [ ] **Step 4: Commit (user runs)**

User command:
```bash
git add dist/api/health.php
git commit -m "Add /api/health.php endpoint for Docker healthcheck"
```

---

## Task 3: `docker-compose.test.yaml`

The test stack: app (built from local Dockerfile), MariaDB with auto-loaded schema, mailhog. All state in named volumes wiped by `docker compose down -v`.

**Files:**
- Create: `docker-compose.test.yaml`

- [ ] **Step 1: Write `docker-compose.test.yaml`**

Create the file at repo root with this content:

```yaml
# Test stack — brought up and torn down by scripts/test-stack.sh.
# Ports offset by +1 from the dev stack so both can run side by side.
# All state lives in named volumes; `docker compose down -v` wipes fully.

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: "no"
    ports:
      - "8086:80"
    environment:
      EMAIL_HOST: mailhog
      EMAIL_PORT: "1025"
      EMAIL_USER: ""
      EMAIL_PASS: ""
      EMAIL_FROM: "noreply@test.local"
      BLOODSTAR_ROOT_URL: "http://localhost:8086"
    volumes:
      - type: bind
        source: ./tests/fixtures/protected
        target: /var/www/protected
        read_only: true
      - type: volume
        source: test_usersave
        target: /var/www/html/usersave
      - type: volume
        source: test_published
        target: /var/www/html/p
    depends_on:
      db:
        condition: service_healthy
      published-seed:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost/api/health.php"]
      interval: 5s
      timeout: 3s
      retries: 12
      start_period: 10s

  db:
    image: mariadb:latest
    restart: "no"
    environment:
      MYSQL_ROOT_PASSWORD: bloodstar_test_root_password
      MYSQL_DATABASE: bloodstar_db
      MYSQL_USER: bloodstar_user
      MYSQL_PASSWORD: bloodstar_test_password
    volumes:
      - type: volume
        source: test_db_data
        target: /var/lib/mysql
      - type: bind
        source: ./schema.sql
        target: /docker-entrypoint-initdb.d/01-schema.sql
        read_only: true
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 5s
      timeout: 3s
      retries: 20
      start_period: 20s

  mailhog:
    image: mailhog/mailhog:latest
    restart: "no"
    ports:
      - "8026:8025"   # HTTP UI / API

  published-seed:
    # Runs once on up, copies the default almanac/print CSS into the
    # test_published named volume, then exits. Ensures publish-related
    # tests have the expected default stylesheets available.
    image: alpine:3
    command:
      - sh
      - -c
      - "cp -n /seed/*.css /target/ && ls -la /target/"
    volumes:
      - type: bind
        source: ./tests/fixtures/published
        target: /seed
        read_only: true
      - type: volume
        source: test_published
        target: /target
    restart: "no"

volumes:
  test_db_data:
  test_usersave:
  test_published:
```

Notes:
- `build: .` means tests run against the PR's code, not a published image.
- Default MariaDB image's `healthcheck.sh` helper is present in recent `mariadb` images.
- `published-seed` runs once, copies seed CSS into the named volume, exits successfully → app `depends_on` it via `service_completed_successfully`.
- `restart: "no"` everywhere: we never want tests to "recover" from a crash silently.

- [ ] **Step 2: Validate compose syntax**

Run:
```bash
docker compose -f docker-compose.test.yaml -p bloodstar-test config > /dev/null
```
Expected: exits 0, no output. Errors here indicate YAML or schema problems — fix before moving on.

- [ ] **Step 3: Bring the stack up and confirm services become healthy**

Run:
```bash
docker compose -f docker-compose.test.yaml -p bloodstar-test up -d --build
```
Expected: builds the app image, starts db, runs published-seed, starts mailhog, starts app. First run may take 1–2 minutes.

Then:
```bash
docker compose -f docker-compose.test.yaml -p bloodstar-test ps
```
Expected: `db` is `healthy`, `app` is `healthy` (may need ~30s), `mailhog` is `running`, `published-seed` is `exited (0)`.

- [ ] **Step 4: Run the Task-2 health check against the live stack**

Run:
```bash
/tmp/health-check.sh http://localhost:8086/api/health.php
```
Expected:
```
HTTP 200
{"status":"ok","db":"ok"}
```
and exit 0.

If HTTP is 503 with `"db":"error"`: the DB-config or bind-mount is wrong. Check `docker compose -f docker-compose.test.yaml -p bloodstar-test logs app`.

- [ ] **Step 5: Tear the stack down and verify volumes are wiped**

Run:
```bash
docker compose -f docker-compose.test.yaml -p bloodstar-test down -v
docker volume ls | grep bloodstar-test
```
Expected: `down -v` removes all three named volumes. `docker volume ls` shows no `bloodstar-test_*` volumes.

- [ ] **Step 6: Commit (user runs)**

User command:
```bash
git add docker-compose.test.yaml
git commit -m "Add docker-compose.test.yaml for dedicated test stack"
```

---

## Task 4: `scripts/test-stack.sh`

Wrapper that exposes `up` / `down` / `wait` subcommands so every caller (npm scripts, CI, humans) uses the same entrypoint.

**Files:**
- Create: `scripts/test-stack.sh`

- [ ] **Step 1: Create the script**

```bash
mkdir -p scripts
```

Write `scripts/test-stack.sh`:

```bash
#!/usr/bin/env bash
# Wrapper around docker-compose.test.yaml. Single entrypoint used by
# npm scripts, CI, and humans.
set -euo pipefail

PROJECT="bloodstar-test"
COMPOSE_FILE="docker-compose.test.yaml"
COMPOSE=(docker compose -f "$COMPOSE_FILE" -p "$PROJECT")

wait_for_health() {
  local service="app"
  local retries=60
  local delay=2
  echo "Waiting for $service to become healthy..."
  for i in $(seq 1 "$retries"); do
    local status
    status=$("${COMPOSE[@]}" ps --format json "$service" \
      | sed -n 's/.*"Health":"\([^"]*\)".*/\1/p' | head -1)
    if [ "$status" = "healthy" ]; then
      echo "$service is healthy"
      return 0
    fi
    sleep "$delay"
  done
  echo "ERROR: $service did not become healthy in $((retries * delay))s" >&2
  "${COMPOSE[@]}" ps
  "${COMPOSE[@]}" logs --tail=100 "$service"
  return 1
}

cmd_up() {
  "${COMPOSE[@]}" up -d --build
  wait_for_health
}

cmd_down() {
  "${COMPOSE[@]}" down -v
}

cmd_logs() {
  "${COMPOSE[@]}" logs --tail=200 "$@"
}

cmd_wait() {
  wait_for_health
}

case "${1:-}" in
  up)    cmd_up ;;
  down)  cmd_down ;;
  wait)  cmd_wait ;;
  logs)  shift; cmd_logs "$@" ;;
  *)     echo "usage: $0 {up|down|wait|logs [service]}" >&2; exit 2 ;;
esac
```

Make it executable:
```bash
chmod +x scripts/test-stack.sh
```

- [ ] **Step 2: Test `up`**

Run:
```bash
./scripts/test-stack.sh up
```
Expected: builds (cached from Task 3), starts services, waits, prints `app is healthy`. Exits 0.

- [ ] **Step 3: Test the live stack responds**

Run:
```bash
curl -fsS http://localhost:8086/api/health.php
```
Expected: `{"status":"ok","db":"ok"}`.

- [ ] **Step 4: Test `down`**

Run:
```bash
./scripts/test-stack.sh down
docker volume ls | grep bloodstar-test || true
```
Expected: first command exits 0; second returns nothing (volumes gone).

- [ ] **Step 5: Test failure path**

Temporarily break the healthcheck to confirm `wait_for_health` surfaces the failure rather than hanging. Edit `docker-compose.test.yaml`, change app healthcheck to:
```yaml
test: ["CMD", "false"]
```
Run:
```bash
./scripts/test-stack.sh up
```
Expected: after ~120s, prints `ERROR: app did not become healthy`, dumps `ps` and logs, exits non-zero.

Revert the healthcheck change, then:
```bash
./scripts/test-stack.sh down
```

- [ ] **Step 6: Commit (user runs)**

User command:
```bash
git add scripts/test-stack.sh
git commit -m "Add scripts/test-stack.sh wrapper for the test Compose stack"
```

---

## Task 5: Test directory skeleton

Empty `tests/{unit,api,e2e}/` directories with placeholder READMEs, so later phases have a home.

**Files:**
- Create: `tests/README.md`
- Create: `tests/unit/.gitkeep`
- Create: `tests/api/.gitkeep`
- Create: `tests/e2e/.gitkeep`

- [ ] **Step 1: Create directories and gitkeep files**

Run:
```bash
mkdir -p tests/unit tests/api tests/e2e
touch tests/unit/.gitkeep tests/api/.gitkeep tests/e2e/.gitkeep
```

- [ ] **Step 2: Write `tests/README.md`**

```markdown
# Tests

Three test layers. See
[`docs/superpowers/specs/2026-04-20-testing-infrastructure-design.md`](../docs/superpowers/specs/2026-04-20-testing-infrastructure-design.md)
for the full design.

| Dir   | Framework  | Purpose                                                     |
|-------|------------|-------------------------------------------------------------|
| unit/ | Vitest     | Pure TypeScript: model, validation, team-color, etc.        |
| api/  | Hurl       | HTTP contract against the test Compose stack                |
| e2e/  | Playwright | Browser-level flows against the test Compose stack          |

## Running

| Command              | What it does                                                |
|----------------------|-------------------------------------------------------------|
| `npm test`           | Vitest unit suite. No Docker required.                      |
| `npm run test:api`   | Brings up the test stack, runs Hurl, tears down.            |
| `npm run test:e2e`   | Brings up the test stack, runs Playwright, tears down.      |
| `npm run test:e2e:ui`| Playwright UI mode for interactive debugging.               |
| `npm run test:all`   | Unit → API → E2E. Fail-fast.                                |

The stack itself is controlled via `scripts/test-stack.sh {up,down,wait,logs}`
if you need to run it independently.

## Fixtures

- `tests/fixtures/protected/` — throwaway JWT keys and DB config. Bind-mounted
  read-only into the app container.
- `tests/fixtures/published/` — default `almanac.css` / `print.css` seeded
  into the app's published-dir volume on up.

These files are *test* fixtures — never reuse them in any deployed system.
```

- [ ] **Step 3: Commit (user runs)**

User command:
```bash
git add tests/README.md tests/unit/.gitkeep tests/api/.gitkeep tests/e2e/.gitkeep
git commit -m "Add tests/ directory skeleton with README"
```

---

## Task 6: `package.json` test scripts

Add placeholder scripts now so callers have a stable interface. Each script shells out to `scripts/test-stack.sh` + the appropriate runner. Since Vitest/Hurl/Playwright aren't installed yet, the scripts print a clear "coming in phase N" message today; later phases replace each body with the real runner.

**Files:**
- Modify: `package.json` — add `scripts.test`, `test:api`, `test:e2e`, `test:e2e:ui`, `test:all`, `test:stack:up`, `test:stack:down`

- [ ] **Step 1: Add script entries**

Open `package.json`. Replace the `scripts` object with:

```json
"scripts": {
  "builddev": "webpack --mode development",
  "buildprod": "webpack --mode production",
  "watch": "webpack --mode development --watch",
  "serve": "live-server --cors --port=8085 ./dist",
  "test": "echo 'Unit tests arrive in Phase 2 (Vitest).' && exit 0",
  "test:api": "echo 'API tests arrive in Phase 3 (Hurl).' && exit 0",
  "test:e2e": "echo 'E2E tests arrive in Phase 4 (Playwright).' && exit 0",
  "test:e2e:ui": "echo 'E2E UI mode arrives in Phase 4 (Playwright).' && exit 0",
  "test:all": "npm run test && npm run test:api && npm run test:e2e",
  "test:stack:up": "./scripts/test-stack.sh up",
  "test:stack:down": "./scripts/test-stack.sh down"
}
```

- [ ] **Step 2: Verify every script is callable**

Run:
```bash
npm run test
npm run test:api
npm run test:e2e
npm run test:all
```
Expected: each exits 0 and prints the "arrives in Phase N" message. `test:all` runs all three placeholders in order.

- [ ] **Step 3: Verify the stack wrappers work via npm**

Run:
```bash
npm run test:stack:up
curl -fsS http://localhost:8086/api/health.php
npm run test:stack:down
```
Expected: stack comes up, health responds `{"status":"ok","db":"ok"}`, stack comes down.

- [ ] **Step 4: Commit (user runs)**

User command:
```bash
git add package.json
git commit -m "Add test scripts to package.json (placeholders + stack wrappers)"
```

---

## Task 7: GitHub Actions unit workflow

Empty-but-passing unit workflow, so CI exists and is wired up before any test code lands. Phase 2 fills it with real Vitest runs.

**Files:**
- Create: `.github/workflows/unit.yml`

- [ ] **Step 1: Create the workflow**

```bash
mkdir -p .github/workflows
```

Write `.github/workflows/unit.yml`:

```yaml
name: Unit tests

on:
  push:
    branches: ['**']
  pull_request:
    branches: [dev, stable]

concurrency:
  group: unit-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  vitest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test
```

Notes:
- Placeholder `npm test` in Task 6 exits 0, so this workflow passes today.
- `setup-node` with `cache: 'npm'` caches `node_modules` keyed on `package-lock.json`.
- Concurrency group cancels superseded pushes on the same ref.

- [ ] **Step 2: Validate YAML syntax locally**

If `actionlint` is installed (optional but recommended):
```bash
actionlint .github/workflows/unit.yml
```
Expected: no errors.

Otherwise:
```bash
python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/unit.yml'))"
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit (user runs)**

User command:
```bash
git add .github/workflows/unit.yml
git commit -m "Add GitHub Actions unit-test workflow (placeholder)"
```

- [ ] **Step 4: Push and verify on GitHub**

User pushes to a branch (or opens a PR). Check the Actions tab:
- `Unit tests` workflow should appear.
- It should succeed (the placeholder `npm test` exits 0).

---

## Task 8: README pointer

One-line addition to the root README so a new contributor finds the test harness.

**Files:**
- Modify: `README.md` — add a "Testing" section link below "Developing"

- [ ] **Step 1: Edit README**

Find the line in `README.md` that starts the "Deploy to a new server" heading. Insert this section immediately before it:

```markdown
## Testing

The project has a three-layer test suite (Vitest units, Hurl API, Playwright
E2E). See [`tests/README.md`](tests/README.md) and the design doc at
[`docs/superpowers/specs/2026-04-20-testing-infrastructure-design.md`](docs/superpowers/specs/2026-04-20-testing-infrastructure-design.md).

Quick start:

```bash
npm test               # unit (Phase 2+)
npm run test:api       # API (Phase 3+)
npm run test:e2e       # E2E (Phase 4+)
npm run test:stack:up  # bring the test Compose stack up manually
```
```

- [ ] **Step 2: Commit (user runs)**

User command:
```bash
git add README.md
git commit -m "Document testing harness in README"
```

---

## Task 9: End-to-end smoke of the whole harness

Last task: prove the whole Phase-1 deliverable works from a cold start.

**Files:** none created; this is a behavioral verification.

- [ ] **Step 1: Clean slate**

Run:
```bash
./scripts/test-stack.sh down || true
docker volume ls | grep bloodstar-test && echo "leftover volumes present!" || echo "clean"
```
Expected: second command prints `clean`.

- [ ] **Step 2: Cold start**

Run (timing):
```bash
time ./scripts/test-stack.sh up
```
Expected: exits 0 with `app is healthy`. Should be well under 3 minutes on a reasonable machine (mostly Docker build time on first run; under 45s on subsequent runs).

- [ ] **Step 3: Exercise health endpoint**

Run:
```bash
curl -fsS http://localhost:8086/api/health.php
```
Expected: `{"status":"ok","db":"ok"}`.

- [ ] **Step 4: Confirm DB schema loaded**

Run:
```bash
docker compose -f docker-compose.test.yaml -p bloodstar-test exec -T db \
  mysql -ubloodstar_user -pbloodstar_test_password bloodstar_db \
  -e 'SHOW TABLES;'
```
Expected: lists `block`, `hash`, `reset`, `share`, `unconfirmed`, `users`. That means `schema.sql` was auto-loaded from `/docker-entrypoint-initdb.d/`.

- [ ] **Step 5: Confirm mailhog is reachable**

Run:
```bash
curl -fsS http://localhost:8026/api/v2/messages | head -c 80
```
Expected: JSON beginning with something like `{"total":0,"count":0,"start":0,...}`.

- [ ] **Step 6: Confirm published CSS was seeded**

Run:
```bash
curl -fsS http://localhost:8086/p/almanac.css | head -5
```
Expected: first lines of the almanac stylesheet (same content as `tests/fixtures/published/almanac.css`). If this 404s, the nginx config in the prod image doesn't serve `/p/` as a static dir — this is worth knowing now rather than in Phase 3, and needs a follow-up task (add nginx rule). Log the finding.

- [ ] **Step 7: Confirm DB-failure path gives 503**

Stop just the DB:
```bash
docker compose -f docker-compose.test.yaml -p bloodstar-test stop db
curl -s -o /tmp/h.json -w 'HTTP %{http_code}\n' http://localhost:8086/api/health.php
cat /tmp/h.json; echo
```
Expected: `HTTP 503` and `{"status":"degraded","db":"error"}`. Then:
```bash
docker compose -f docker-compose.test.yaml -p bloodstar-test start db
./scripts/test-stack.sh wait
```
Expected: app becomes healthy again.

- [ ] **Step 8: Clean teardown**

Run:
```bash
./scripts/test-stack.sh down
docker volume ls | grep bloodstar-test || echo "clean"
```
Expected: `clean`.

- [ ] **Step 9: Run `npm` placeholders end-to-end**

Run:
```bash
npm run test:all
```
Expected: three placeholder messages, exits 0.

- [ ] **Step 10: Mark Phase 1 complete (user runs)**

User command (tag optional; useful for bisecting later):
```bash
git tag testing/phase-1-complete
```

---

## Acceptance criteria for Phase 1

All of the following must be true before starting Phase 2:

1. `./scripts/test-stack.sh up` brings up a healthy stack in under 45s (warm).
2. `curl http://localhost:8086/api/health.php` → `200 {"status":"ok","db":"ok"}`.
3. Stopping `db` makes `health.php` return `503 {"status":"degraded","db":"error"}`.
4. `./scripts/test-stack.sh down` leaves zero `bloodstar-test_*` volumes.
5. `npm run test:all` exits 0 (placeholders).
6. GitHub Actions "Unit tests" workflow passes on a pushed branch.
7. `tests/README.md`, `tests/fixtures/protected/{db,jwt_key.pem,jwt_key.pub}`, and `tests/fixtures/published/*.css` are committed.
8. No production `docker-compose.example.yaml`, `Dockerfile`, `dist/api/shared.php`, or `persistent/` contents were modified.

## Out of scope for Phase 1 (reminder)

- Real Vitest tests (Phase 2).
- Hurl files (Phase 3).
- Playwright specs (Phase 4).
- `integration.yml` / `nightly.yml` workflows (Phase 3 and later).
- Nginx tuning if Task 9 Step 6 reveals `/p/` routing issues — log as a follow-up.
