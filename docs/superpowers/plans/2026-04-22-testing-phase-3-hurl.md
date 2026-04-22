# Testing — Phase 3: Hurl API Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land a Hurl-based API-contract suite covering all 24 real PHP endpoints in `dist/api/`. The `.hurl` files double as the executable specification the replacement backend must satisfy. Wire the suite into a new `integration.yml` GitHub Actions workflow running against the Phase-1 Docker test stack.

**Architecture:** `tests/api/**/*.hurl` files run against a live stack brought up via `scripts/test-stack.sh`. Each `.hurl` file is self-contained: it creates its own scratch user via signup+confirm, captures a JWT, exercises the endpoints under test, and deletes the scratch user on teardown. Email-driven flows (signup confirm, password reset) extract codes from mailhog's HTTP API (`http://localhost:8026/api/v2/messages`) rather than probing SMTP.

**Tech Stack:** Hurl (Rust binary, single executable), existing Docker test stack (PHP 8.5 on nginx + MariaDB + mailhog), GitHub Actions.

**Scope:** Every endpoint in `dist/api/` except `test.php` (vestigial, not used). That's 25 endpoints across 5 feature groups (auth, editions, sharing, social, misc).

**Spec reference:** [`docs/superpowers/specs/2026-04-20-testing-infrastructure-design.md`](../specs/2026-04-20-testing-infrastructure-design.md)

**User preference:** The user runs all `git commit` commands themselves (gpg-signing blocks non-interactive shells). This plan presents each commit as a command, not as a subagent action.

---

## API-contract cheat sheet (for all tasks below)

All Hurl files rely on these facts — reference back here when writing assertions.

- **All authenticated endpoints accept the JWT via request body**: `{"token": "..."}`. Not `Authorization` header.
- **Error responses are HTTP 200** with `{"error": "..."}` JSON body (or sometimes a literal JSON string like `"emailTaken"`, `"badCode"`, `"clobber"`, `"alreadyConfirmed"`, `"notSignedUp"`, `"expired"`, `"signInRequired"`). The only endpoints that set a non-200 status are `health.php` (503 on DB failure) and `jwt.php` helper (400 on token failure).
- **Token-failure response** is HTTP 400 + literal JSON string `"signInRequired"` (not an object).
- **Mailhog** is at `http://localhost:8026` on the host (exposed by the test compose). Its v2 API returns `{"total":N,"count":N,"start":0,"items":[...]}` with newest messages first. Message fields we use: `items[i].Content.Headers.To`, `items[i].Content.Body` (for the 6-digit code).
- **Confirmation/reset codes** are 6 random digits. Subject for signup: `"Bloodstar Clocktica sign-up confirmation"`. Subject for reset: `"Bloodstar Clocktica password reset"`.
- **JSON round-trip for edition/save** — see Phase 2's `edition.test.ts`. Minimal valid edition shape: `{"meta": {"name": "..."}}` at minimum.
- **Username rules** (from `validate.ts`): 2+ chars of `[A-Za-z0-9\-_]`.
- **Password rules**: ≥8 chars with a lower, upper, and digit; OR ≥24 chars of anything.

---

## Task 1: Install Hurl and scaffold the runner

Install Hurl locally, add an `env.test` variables file, replace the placeholder `npm run test:api` script, and verify a trivial health.hurl runs end-to-end against the test stack.

**Files:**
- Create: `tests/api/env.test` (Hurl variables file)
- Create: `tests/api/misc/health.hurl` (simplest possible .hurl, one request)
- Modify: `package.json` — replace `test:api` placeholder with a real command
- Modify: `scripts/test-stack.sh` — optional convenience subcommand if needed
- Create: `tests/api/README.md` — quick "how to run" guide

- [ ] **Step 1: Install Hurl**

Hurl is a single Rust binary. Install locally:

```bash
brew install hurl   # macOS
# OR
cargo install hurl  # any platform with Rust
# OR
curl -fsSL https://github.com/Orange-OpenSource/hurl/releases/download/7.0.0/hurl-7.0.0-x86_64-unknown-linux-gnu.tar.gz | tar xz
```

Verify: `hurl --version` → prints version ≥5.0 (any recent release works — the syntax we use is stable since 4.x).

Do NOT add Hurl to `devDependencies` — it's not an npm package. Document the install requirement in `tests/api/README.md`.

- [ ] **Step 2: Create `tests/api/env.test`**

A Hurl variables file holds the URLs and any per-environment constants. Write it at `tests/api/env.test`:

```
# Host-facing URLs for the Phase-1 Docker test stack.
base_url=http://localhost:8086
mailhog_url=http://localhost:8026
```

The `env.test` extension is conventional; Hurl accepts any extension for `--variables-file`. Keep it simple: two variables, no secrets.

- [ ] **Step 3: Create `tests/api/misc/health.hurl`**

Start with the simplest possible test to prove the runner wiring works:

```
# Health endpoint — no auth, no DB write. Green here means the stack is up.
GET {{base_url}}/api/health.php
HTTP 200
[Asserts]
jsonpath "$.status" == "ok"
jsonpath "$.db" == "ok"
```

- [ ] **Step 4: Replace the `test:api` placeholder**

Open `package.json`. Change:
```json
"test:api": "echo 'API tests arrive in Phase 3 (Hurl).' && exit 0",
```
to:
```json
"test:api": "./scripts/run-api-tests.sh",
```

Leave other scripts alone.

- [ ] **Step 5: Create `scripts/run-api-tests.sh`**

This script brings the stack up, runs Hurl, tears down. Write:

```bash
#!/usr/bin/env bash
# Runs the Hurl API suite against a fresh test stack.
set -euo pipefail
cd "$(dirname "$0")/.."

cleanup() {
  ./scripts/test-stack.sh down
}
trap cleanup EXIT

./scripts/test-stack.sh up

hurl --test \
  --variables-file tests/api/env.test \
  --report-html tests/api/.hurl-report \
  tests/api/**/*.hurl
```

Make it executable:
```bash
chmod +x scripts/run-api-tests.sh
```

The `trap cleanup EXIT` ensures the stack is torn down even if Hurl fails or the user hits Ctrl+C.

- [ ] **Step 6: Create `tests/api/README.md`**

```markdown
# API tests (Hurl)

These `.hurl` files are the executable HTTP contract that the PHP backend
(and any replacement) must satisfy. They run against a live Docker test
stack brought up via `scripts/test-stack.sh`.

## Prerequisites

- Docker (for the test stack — Phase 1 already configured).
- [Hurl](https://hurl.dev) v5.0+ installed locally. On macOS: `brew install hurl`.

## Running

| Command                     | What it does                                              |
|-----------------------------|-----------------------------------------------------------|
| `npm run test:api`          | Bring up the stack, run every `.hurl` file, tear down.    |
| `npm run test:stack:up`     | Bring up the stack for interactive debugging.             |
| `hurl --test --variables-file tests/api/env.test tests/api/misc/health.hurl` | Run one file against a stack you already have up. |

## Layout

Each feature area gets its own subdirectory. Every `.hurl` file is
self-contained: it signs up a scratch user, captures a JWT, exercises
endpoints, and deletes the scratch user on teardown.

- `auth/` — signup, confirm, signin, reset-password, delete-account, etc.
- `editions/` — save, open, list, publish, delete, images.
- `sharing/` — share, unshare, leave, permission, get-shared.
- `social/` — block, unblock, get-blocked.
- `misc/` — exists, validate (JWT), cull, health, allpublished.
- `fixtures/` — shared inputs (sample edition JSON, etc.).

## Hurl usage notes

- Variables from `env.test` (base_url, mailhog_url) are always available
  as `{{base_url}}`, `{{mailhog_url}}`.
- Hurl's `newUuid` function (`{{newUuid}}`) generates a random UUID —
  useful for per-test unique emails.
- Mailhog inbox: `GET {{mailhog_url}}/api/v2/messages` returns the newest
  message first in `items[0]`. Plain text body is `items[0].Content.Body`.
- To extract a 6-digit code from an email body: regex `\d{6}`.
```

- [ ] **Step 7: Verify the stack + health.hurl pass end-to-end**

Make sure Docker is running, then:

```bash
./scripts/test-stack.sh up
hurl --test --variables-file tests/api/env.test tests/api/misc/health.hurl
```

Expected:
```
tests/api/misc/health.hurl: Running [1/1]
tests/api/misc/health.hurl: Success (1 request(s) in ...ms)
--------------------------------------------------------------------------------
Executed files:  1
Succeeded files: 1 (100.0%)
Failed files:    0 (0.0%)
Duration:        ... ms
```

Then tear down:
```bash
./scripts/test-stack.sh down
```

- [ ] **Step 8: Verify the npm script**

```bash
npm run test:api
```

Expected: stack comes up, health.hurl passes, stack tears down. Exit 0.

- [ ] **Step 9: Stage**

```bash
git add tests/api/env.test tests/api/misc/health.hurl tests/api/README.md \
        scripts/run-api-tests.sh package.json
git status --short
```

Expected: 5 new/modified entries, nothing else.

- [ ] **Step 10: Commit (user runs)**

```bash
git commit -m "Install Hurl API test runner with health.hurl smoke"
```

---

## Task 2: Auth foundation — signup + confirm + signin

The critical chain every other authenticated test depends on. One `.hurl` file walks the full flow: signup → check mailhog for confirmation code → confirm → signin → capture JWT → validate the JWT via `/api/validate.php`.

**Files:**
- Create: `tests/api/auth/signup.hurl`

- [ ] **Step 1: Write `tests/api/auth/signup.hurl`**

```
# Full signup + confirm + signin flow.
# Exercises: signup.php, mailhog fetch, confirm.php, signin.php, validate.php.

# Unique scratch account per run so re-runs don't collide.
POST {{base_url}}/api/signup.php
{
  "username": "u{{newUuid}}",
  "password": "TestPass123",
  "email": "u-{{newUuid}}@test.local"
}
HTTP 200
[Captures]
# Re-capture what we just sent so later requests can reference it.
# Hurl doesn't let a body literal populate variables, so we store the
# UUID-based values in the prior request and use them as template
# variables here. Trick: capture them from the echo'd body by having
# the test signup.php server echo them — BUT it doesn't. So instead,
# we restructure: generate the values as top-of-file variables and
# reuse them throughout.
[Asserts]
body == "true"
```

The above doesn't work because Hurl's `{{newUuid}}` evaluates fresh at each site. We need top-level variables. Rewrite:

```
# Full signup + confirm + signin flow.
# Exercises: signup.php, mailhog fetch, confirm.php, signin.php, validate.php.

# Pre-compute per-run identities using a top-level OPTIONS request to
# capture UUIDs into file-scoped variables, since Hurl re-evaluates
# newUuid at each callsite.

# --- Trick: do one throwaway request and capture {{newUuid}} once. ---
GET {{base_url}}/api/health.php
HTTP 200
[Captures]
run_id: variable "newUuid"
```

Still wrong — Hurl doesn't have a way to capture from the `newUuid` function directly. The correct idiom is to invoke `{{newUuid}}` exactly once per desired unique value and reuse as a Hurl variable:

```
# Generate a unique run ID up-front.
GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local

# --- Sign up ---
POST {{base_url}}/api/signup.php
{
  "username": "{{username}}",
  "password": "TestPass123",
  "email": "{{email}}"
}
HTTP 200
[Asserts]
body == "true"

# --- Fetch the confirmation email from mailhog ---
# Mailhog returns newest first. Find our message by matching the email
# address and extract the 6-digit code from the body.
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
code: jsonpath "$.items[?(@.Content.Headers.To[0]=='{{email}}')].Content.Body" nth 0 regex "\\d{6}"
[Asserts]
jsonpath "$.total" >= 1

# --- Confirm with the captured code ---
POST {{base_url}}/api/confirm.php
{
  "email": "{{email}}",
  "code": "{{code}}"
}
HTTP 200
[Captures]
token: jsonpath "$.token"
returned_email: jsonpath "$.email"
returned_username: jsonpath "$.username"
[Asserts]
jsonpath "$.email" == "{{email}}"
jsonpath "$.username" == "{{username}}"
jsonpath "$.token" matches "^[A-Za-z0-9\\-_=]+\\.[A-Za-z0-9\\-_=]+\\.[A-Za-z0-9\\-_.+/=]+$"

# --- Sign in with the confirmed credentials ---
POST {{base_url}}/api/signin.php
{
  "usernameOrEmail": "{{username}}",
  "password": "TestPass123"
}
HTTP 200
[Captures]
signin_token: jsonpath "$.token"
[Asserts]
jsonpath "$.email" == "{{email}}"
jsonpath "$.username" == "{{username}}"

# --- Validate the token ---
POST {{base_url}}/api/validate.php
{
  "token": "{{signin_token}}"
}
HTTP 200

# --- Teardown: delete the account ---
POST {{base_url}}/api/deleteaccount.php
{
  "token": "{{signin_token}}",
  "password": "TestPass123"
}
HTTP 200
[Asserts]
body == "true"
```

> **Note for the implementer:** Hurl's `jsonpath` + `nth` + `regex` chain shown in the mailhog-extract step matches Hurl syntax circa v5.x. If the implementer finds that the syntax differs in their installed Hurl version, read the installed version's docs and adjust. The pattern is: "from the mailhog messages array, find the one addressed to our test email, take its Body, extract the first 6-digit run." If Hurl's jsonpath filter syntax turns out to be different, an alternative is: (a) fetch all messages, (b) capture `body: jsonpath "$.items[0].Content.Body"` (assuming newest-first, which mailhog guarantees), (c) `code: body regex "\\d{6}"`.

- [ ] **Step 2: Run it**

```bash
./scripts/test-stack.sh up
hurl --test --variables-file tests/api/env.test tests/api/auth/signup.hurl
```

Expected: success. Common failures:
- Hurl jsonpath syntax mismatch → use the fallback described above.
- Confirmation email never arrives → check `docker compose logs app` for SMTP errors; check mailhog UI at http://localhost:8026.
- JWT regex too strict → loosen to `matches ".+\\..+\\..+"`.

Tear down: `./scripts/test-stack.sh down`.

- [ ] **Step 3: Stage and commit**

```bash
git add tests/api/auth/signup.hurl
```

```bash
git commit -m "Add Hurl test for signup + confirm + signin + validate + delete-account flow"
```

---

## Task 3: Auth edge cases — errors, resend, reset, exists

**Files:**
- Create: `tests/api/auth/signin-errors.hurl`
- Create: `tests/api/auth/resend-confirm.hurl`
- Create: `tests/api/auth/reset-password.hurl`
- Create: `tests/api/auth/exists.hurl`

Each is self-contained: makes its own scratch user, tests, deletes.

- [ ] **Step 1: `tests/api/auth/signin-errors.hurl`**

```
# Signin rejects unknown users and wrong passwords.

GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local

# Setup: create & confirm a user
POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200
[Asserts]
body == "true"

GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
code: jsonpath "$.items[0].Content.Body" regex "\\d{6}"

POST {{base_url}}/api/confirm.php
{"email":"{{email}}","code":"{{code}}"}
HTTP 200
[Captures]
setup_token: jsonpath "$.token"

# --- Wrong password ---
POST {{base_url}}/api/signin.php
{"usernameOrEmail":"{{username}}","password":"WrongPass123"}
HTTP 200
[Asserts]
jsonpath "$.title" == "Sign-In Error"
jsonpath "$.token" not exists

# --- Unknown username ---
POST {{base_url}}/api/signin.php
{"usernameOrEmail":"definitely-not-a-user","password":"TestPass123"}
HTTP 200
[Asserts]
jsonpath "$.title" == "Sign-In Error"
jsonpath "$.token" not exists

# --- Unknown email ---
POST {{base_url}}/api/signin.php
{"usernameOrEmail":"nobody@test.local","password":"TestPass123"}
HTTP 200
[Asserts]
jsonpath "$.title" == "Sign-In Error"
jsonpath "$.token" not exists

# --- Signin works with the correct credentials (positive control) ---
POST {{base_url}}/api/signin.php
{"usernameOrEmail":"{{username}}","password":"TestPass123"}
HTTP 200
[Asserts]
jsonpath "$.username" == "{{username}}"

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{setup_token}}","password":"TestPass123"}
HTTP 200
```

- [ ] **Step 2: `tests/api/auth/resend-confirm.hurl`**

```
# resendconf.php issues a fresh 6-digit code for a user that signed up
# but hasn't confirmed yet.

GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local

# Start signup but do NOT confirm
POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200
[Asserts]
body == "true"

# Capture the first code to compare later
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
first_code: jsonpath "$.items[0].Content.Body" regex "\\d{6}"

# Resend confirmation
POST {{base_url}}/api/resendconf.php
{"email":"{{email}}"}
HTTP 200
[Asserts]
body == "true"

# Mailhog now has TWO messages; newest (item 0) is the resend
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
second_code: jsonpath "$.items[0].Content.Body" regex "\\d{6}"
[Asserts]
jsonpath "$.total" >= 2

# Confirm with the SECOND code (proves the newer one is accepted)
POST {{base_url}}/api/confirm.php
{"email":"{{email}}","code":"{{second_code}}"}
HTTP 200
[Captures]
token: jsonpath "$.token"

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
```

- [ ] **Step 3: `tests/api/auth/reset-password.hurl`**

```
# requestreset.php + reset.php flow.

GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local

# Setup: a confirmed account
POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200

GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
confirm_code: jsonpath "$.items[0].Content.Body" regex "\\d{6}"

POST {{base_url}}/api/confirm.php
{"email":"{{email}}","code":"{{confirm_code}}"}
HTTP 200

# --- Request reset ---
POST {{base_url}}/api/requestreset.php
{"usernameOrEmail":"{{email}}"}
HTTP 200
[Asserts]
jsonpath "$.username" == "{{username}}"

# The newest mailhog message is the reset; subject contains "password reset"
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
reset_code: jsonpath "$.items[0].Content.Body" regex "\\d{6}"

# --- Reset the password ---
POST {{base_url}}/api/reset.php
{"email":"{{email}}","code":"{{reset_code}}","password":"NewPass456"}
HTTP 200
[Captures]
reset_token: jsonpath "$.token"
[Asserts]
jsonpath "$.username" == "{{username}}"

# --- Old password no longer works ---
POST {{base_url}}/api/signin.php
{"usernameOrEmail":"{{username}}","password":"TestPass123"}
HTTP 200
[Asserts]
jsonpath "$.title" == "Sign-In Error"

# --- New password works ---
POST {{base_url}}/api/signin.php
{"usernameOrEmail":"{{username}}","password":"NewPass456"}
HTTP 200
[Asserts]
jsonpath "$.username" == "{{username}}"

# Teardown with new password
POST {{base_url}}/api/deleteaccount.php
{"token":"{{reset_token}}","password":"NewPass456"}
HTTP 200
```

- [ ] **Step 4: `tests/api/auth/exists.hurl`**

```
# exists.php reports whether a save file exists for the authenticated user.

GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local

# Setup
POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200

GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
code: jsonpath "$.items[0].Content.Body" regex "\\d{6}"

POST {{base_url}}/api/confirm.php
{"email":"{{email}}","code":"{{code}}"}
HTTP 200
[Captures]
token: jsonpath "$.token"

# --- Nonexistent save returns false ---
POST {{base_url}}/api/exists.php
{"token":"{{token}}","saveName":"nope"}
HTTP 200
[Asserts]
body == "false"

# --- Save it, then check ---
POST {{base_url}}/api/save.php
{"token":"{{token}}","saveName":"mytest","edition":{"meta":{"name":"Test Edition"}}}
HTTP 200

POST {{base_url}}/api/exists.php
{"token":"{{token}}","saveName":"mytest"}
HTTP 200
[Asserts]
body == "true"

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
```

- [ ] **Step 5: Run & verify**

```bash
./scripts/test-stack.sh up
hurl --test --variables-file tests/api/env.test tests/api/auth/*.hurl
./scripts/test-stack.sh down
```

Expected: 5 files pass (signup.hurl + 4 new ones).

- [ ] **Step 6: Commit**

```bash
git add tests/api/auth/signin-errors.hurl tests/api/auth/resend-confirm.hurl \
        tests/api/auth/reset-password.hurl tests/api/auth/exists.hurl
git commit -m "Add Hurl tests for auth edge cases (signin errors, resend, reset, exists)"
```

---

## Task 4: Editions — save / open / list / save-img / delete

One `.hurl` file per feature, each creating its own scratch user.

**Files:**
- Create: `tests/api/fixtures/edition.json`
- Create: `tests/api/fixtures/tiny.png`
- Create: `tests/api/editions/save-open.hurl`
- Create: `tests/api/editions/list.hurl`
- Create: `tests/api/editions/save-img.hurl`
- Create: `tests/api/editions/delete.hurl`

- [ ] **Step 1: Create fixtures**

Write `tests/api/fixtures/edition.json` — a small but structurally real edition:

```json
{
  "meta": {"name": "Hurl Test Edition", "author": "Hurl"},
  "almanac": {"synopsis": "For testing"},
  "characterList": [
    {"id": "testchar", "name": "Test Character", "team": "townsfolk", "ability": "You start knowing something."}
  ],
  "firstNightOrder": ["testchar"],
  "otherNightOrder": ["testchar"]
}
```

Generate a 1-pixel PNG for `tests/api/fixtures/tiny.png`:

```bash
# If `convert` (ImageMagick) is installed:
convert -size 1x1 xc:red tests/api/fixtures/tiny.png
# OR via Python one-liner:
python3 -c "import base64; open('tests/api/fixtures/tiny.png','wb').write(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8//8/AwAI/AL+6lLFNgAAAABJRU5ErkJggg=='))"
```

Verify file is ~70 bytes: `ls -la tests/api/fixtures/tiny.png`.

- [ ] **Step 2: `tests/api/editions/save-open.hurl`**

Uses Hurl's `file` body type to load the fixture edition:

```
# save → open round-trip proves the edition byte-identical.

GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local

# Setup
POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200

GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
code: jsonpath "$.items[0].Content.Body" regex "\\d{6}"

POST {{base_url}}/api/confirm.php
{"email":"{{email}}","code":"{{code}}"}
HTTP 200
[Captures]
token: jsonpath "$.token"

# --- Save an edition ---
POST {{base_url}}/api/save.php
{
  "token": "{{token}}",
  "saveName": "round-trip",
  "edition": {
    "meta": {"name": "Hurl Round Trip"}
  }
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# --- Re-save with the same name WITHOUT clobber: should reject ---
POST {{base_url}}/api/save.php
{
  "token": "{{token}}",
  "saveName": "round-trip",
  "edition": {"meta":{"name":"different name"}}
}
HTTP 200
[Asserts]
body == "\"clobber\""

# --- Re-save WITH clobber ---
POST {{base_url}}/api/save.php
{
  "token": "{{token}}",
  "saveName": "round-trip",
  "edition": {"meta":{"name":"different name"}},
  "clobber": true
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# --- Open and assert contents ---
POST {{base_url}}/api/open.php
{"token":"{{token}}","saveName":"round-trip"}
HTTP 200
[Asserts]
jsonpath "$.data.meta.name" == "different name"

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
```

- [ ] **Step 3: `tests/api/editions/list.hurl`**

```
# list.php returns the save names owned by the authenticated user.

GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local

POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200

GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
code: jsonpath "$.items[0].Content.Body" regex "\\d{6}"

POST {{base_url}}/api/confirm.php
{"email":"{{email}}","code":"{{code}}"}
HTTP 200
[Captures]
token: jsonpath "$.token"

# --- Empty list for a new user ---
POST {{base_url}}/api/list.php
{"token":"{{token}}"}
HTTP 200
[Asserts]
jsonpath "$.files" count == 0

# --- Save three editions ---
POST {{base_url}}/api/save.php
{"token":"{{token}}","saveName":"a","edition":{"meta":{"name":"A"}}}
HTTP 200

POST {{base_url}}/api/save.php
{"token":"{{token}}","saveName":"b","edition":{"meta":{"name":"B"}}}
HTTP 200

POST {{base_url}}/api/save.php
{"token":"{{token}}","saveName":"c","edition":{"meta":{"name":"C"}}}
HTTP 200

# --- List returns all three (order not guaranteed) ---
POST {{base_url}}/api/list.php
{"token":"{{token}}"}
HTTP 200
[Asserts]
jsonpath "$.files" count == 3
jsonpath "$.files" includes "a"
jsonpath "$.files" includes "b"
jsonpath "$.files" includes "c"

# --- With includeShared, returns {files, shared} ---
POST {{base_url}}/api/list.php
{"token":"{{token}}","includeShared":true}
HTTP 200
[Asserts]
jsonpath "$.files" count == 3
jsonpath "$.shared" exists

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
```

- [ ] **Step 4: `tests/api/editions/save-img.hurl`**

Hurl can send binary file bytes with `file,path;`. But `save-img.php` expects a base64 data URI in the JSON body, so we pre-encode the fixture PNG:

```
# save-img.php accepts a data URI for a character image.

GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local

POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200

GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
code: jsonpath "$.items[0].Content.Body" regex "\\d{6}"

POST {{base_url}}/api/confirm.php
{"email":"{{email}}","code":"{{code}}"}
HTTP 200
[Captures]
token: jsonpath "$.token"

# Need a save to hang the image off of
POST {{base_url}}/api/save.php
{"token":"{{token}}","saveName":"imgsave","edition":{"meta":{"name":"Img"}}}
HTTP 200

# Upload a tiny PNG as the character image. The data URI literal below
# is the base64 of tests/api/fixtures/tiny.png (1x1 red pixel).
POST {{base_url}}/api/save-img.php
{
  "token": "{{token}}",
  "saveName": "imgsave",
  "id": "testchar",
  "isSource": false,
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8//8/AwAI/AL+6lLFNgAAAABJRU5ErkJggg=="
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# Image should now be retrievable as a static file at /usersave/<user>/<save>/<id>.png
GET {{base_url}}/usersave/{{username}}/imgsave/testchar.png
HTTP 200
[Asserts]
header "Content-Type" == "image/png"
bytes count > 50

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
```

> **Note for the implementer:** If `GET /usersave/...` 403s or 404s because nginx doesn't serve that path statically, flag as DONE_WITH_CONCERNS. The test still passes if save-img.php returns success; the static-serve piece is a separate nginx concern.

- [ ] **Step 5: `tests/api/editions/delete.hurl`**

```
# delete.php removes an edition's directory and its shares.

GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local

POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200

GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
code: jsonpath "$.items[0].Content.Body" regex "\\d{6}"

POST {{base_url}}/api/confirm.php
{"email":"{{email}}","code":"{{code}}"}
HTTP 200
[Captures]
token: jsonpath "$.token"

POST {{base_url}}/api/save.php
{"token":"{{token}}","saveName":"todelete","edition":{"meta":{"name":"Bye"}}}
HTTP 200

# Exists returns true
POST {{base_url}}/api/exists.php
{"token":"{{token}}","saveName":"todelete"}
HTTP 200
[Asserts]
body == "true"

# Delete
POST {{base_url}}/api/delete.php
{"token":"{{token}}","saveName":"todelete"}
HTTP 200
[Asserts]
body == "true"

# Exists now returns false
POST {{base_url}}/api/exists.php
{"token":"{{token}}","saveName":"todelete"}
HTTP 200
[Asserts]
body == "false"

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
```

- [ ] **Step 6: Run & verify**

```bash
./scripts/test-stack.sh up
hurl --test --variables-file tests/api/env.test tests/api/auth/*.hurl tests/api/editions/*.hurl
./scripts/test-stack.sh down
```

Expected: 9 files pass.

- [ ] **Step 7: Commit**

```bash
git add tests/api/fixtures/ tests/api/editions/
git commit -m "Add Hurl tests for edition save/open/list/save-img/delete"
```

---

## Task 5: Editions — publish + allpublished

Publishing is complex: it generates `script.json`, `almanac.html`, `full.json` and copies images into `/var/www/html/p/<user>/<save>/`. Tests verify the endpoint returns the expected URL shape and that the published files are reachable.

**Files:**
- Create: `tests/api/editions/publish.hurl`
- Create: `tests/api/editions/allpublished.hurl`

- [ ] **Step 1: `tests/api/editions/publish.hurl`**

```
# publish.php generates static assets under /p/<user>/<save>/ and returns
# URLs the client uses to share them.

GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local

POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200

GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
code: jsonpath "$.items[0].Content.Body" regex "\\d{6}"

POST {{base_url}}/api/confirm.php
{"email":"{{email}}","code":"{{code}}"}
HTTP 200
[Captures]
token: jsonpath "$.token"

# Save a publishable edition
POST {{base_url}}/api/save.php
{
  "token": "{{token}}",
  "saveName": "myedition",
  "edition": {
    "meta": {"name": "Published"},
    "almanac": {"synopsis": "A test."},
    "characterList": [{"id": "zero", "name": "Zero", "team": "townsfolk", "ability": "Nothing."}],
    "firstNightOrder": ["zero"],
    "otherNightOrder": ["zero"]
  }
}
HTTP 200

# --- Publish ---
POST {{base_url}}/api/publish.php
{"token":"{{token}}","saveName":"myedition"}
HTTP 200
[Captures]
script_url: jsonpath "$.script"
almanac_url: jsonpath "$.almanac"
[Asserts]
jsonpath "$.success" == true
jsonpath "$.script" matches "/p/{{username}}/myedition/.*\\.json"
jsonpath "$.almanac" matches "/p/{{username}}/myedition/.*\\.html"

# --- Published script is reachable and is valid JSON ---
GET {{script_url}}
HTTP 200
[Asserts]
header "Content-Type" matches "application/json.*"
jsonpath "$" isCollection

# --- Published almanac is reachable ---
GET {{almanac_url}}
HTTP 200
[Asserts]
header "Content-Type" matches "text/html.*"

# --- full.json also exists ---
GET {{base_url}}/p/{{username}}/myedition/full.json
HTTP 200

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
```

> **Note for the implementer:** the exact filenames (`script.json` etc.) may differ from what's asserted — read `dist/api/publish.php` and `dist/api/almanac.php` to confirm. Adjust the URL patterns in the asserts to match observed reality. The rough-shape assertions (valid JSON, HTML content-type) should hold regardless.

- [ ] **Step 2: `tests/api/editions/allpublished.hurl`**

```
# allpublished.php returns the global list of every published edition.
# No auth required.

GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local

POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200

GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
code: jsonpath "$.items[0].Content.Body" regex "\\d{6}"

POST {{base_url}}/api/confirm.php
{"email":"{{email}}","code":"{{code}}"}
HTTP 200
[Captures]
token: jsonpath "$.token"

# Publish an edition so the global list is non-empty
POST {{base_url}}/api/save.php
{"token":"{{token}}","saveName":"globalpub","edition":{"meta":{"name":"Glob"},"characterList":[]}}
HTTP 200

POST {{base_url}}/api/publish.php
{"token":"{{token}}","saveName":"globalpub"}
HTTP 200
[Captures]
my_script_url: jsonpath "$.script"

# --- List everything, unauthenticated ---
GET {{base_url}}/api/allpublished.php
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$" count >= 1
# Find our just-published entry
jsonpath "$[?(@[0]=='{{my_script_url}}')]" count == 1

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
```

- [ ] **Step 3: Run, commit**

```bash
./scripts/test-stack.sh up
hurl --test --variables-file tests/api/env.test tests/api/editions/*.hurl
./scripts/test-stack.sh down
```

```bash
git add tests/api/editions/publish.hurl tests/api/editions/allpublished.hurl
git commit -m "Add Hurl tests for publish + allpublished"
```

---

## Task 6: Sharing — share / unshare / leave / get-shared / permission

Each flow needs TWO users (owner + sharee). Each `.hurl` file below is fully self-contained: signs up both scratch users, runs the test, deletes both users on teardown. The two-user setup block is repeated verbatim in each file so the files can be read and reasoned about independently.

**Files:**
- Create: `tests/api/sharing/share.hurl`
- Create: `tests/api/sharing/unshare.hurl`
- Create: `tests/api/sharing/leave.hurl`
- Create: `tests/api/sharing/permission.hurl`

- [ ] **Step 1: `tests/api/sharing/share.hurl`**

```
# share.hurl — owner creates an edition, shares it with sharee, verifies
# sharee can list, open, and that get-shared reports the relationship.

# --- Two-user setup: create and confirm both owner and sharee ---
GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: owner_username=owner-{{newUuid}}
variable: owner_email=owner-{{newUuid}}@test.local
variable: sharee_username=sharee-{{newUuid}}
variable: sharee_email=sharee-{{newUuid}}@test.local

# Create owner
POST {{base_url}}/api/signup.php
{"username":"{{owner_username}}","password":"TestPass123","email":"{{owner_email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
owner_code: jsonpath "$.items[?(@.Content.Headers.To[0]=='{{owner_email}}')].Content.Body" nth 0 regex "\\d{6}"
POST {{base_url}}/api/confirm.php
{"email":"{{owner_email}}","code":"{{owner_code}}"}
HTTP 200
[Captures]
owner_token: jsonpath "$.token"

# Create sharee
POST {{base_url}}/api/signup.php
{"username":"{{sharee_username}}","password":"TestPass123","email":"{{sharee_email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
sharee_code: jsonpath "$.items[?(@.Content.Headers.To[0]=='{{sharee_email}}')].Content.Body" nth 0 regex "\\d{6}"
POST {{base_url}}/api/confirm.php
{"email":"{{sharee_email}}","code":"{{sharee_code}}"}
HTTP 200
[Captures]
sharee_token: jsonpath "$.token"

# --- Owner saves an edition ---
POST {{base_url}}/api/save.php
{"token":"{{owner_token}}","saveName":"shared-edition","edition":{"meta":{"name":"Shared"}}}
HTTP 200

# --- Owner shares with sharee ---
POST {{base_url}}/api/share.php
{"token":"{{owner_token}}","saveName":"shared-edition","user":"{{sharee_username}}"}
HTTP 200
[Asserts]
body == "true"

# --- Sharee's list now includes the shared edition ---
POST {{base_url}}/api/list.php
{"token":"{{sharee_token}}","includeShared":true}
HTTP 200
[Asserts]
jsonpath "$.shared.{{owner_username}}" includes "shared-edition"

# --- Sharee can open it ---
POST {{base_url}}/api/open.php
{"token":"{{sharee_token}}","saveName":["{{owner_username}}","shared-edition"]}
HTTP 200
[Asserts]
jsonpath "$.data.meta.name" == "Shared"

# --- get-shared reports the sharee ---
POST {{base_url}}/api/get-shared.php
{"token":"{{owner_token}}","saveName":"shared-edition"}
HTTP 200
[Asserts]
jsonpath "$.users" includes "{{sharee_username}}"

# --- Teardown both users ---
POST {{base_url}}/api/deleteaccount.php
{"token":"{{owner_token}}","password":"TestPass123"}
HTTP 200
POST {{base_url}}/api/deleteaccount.php
{"token":"{{sharee_token}}","password":"TestPass123"}
HTTP 200
```

- [ ] **Step 2: `tests/api/sharing/unshare.hurl`**

```
# unshare.hurl — owner shares, then unshares (first targeted, then all).

# --- Two-user setup ---
GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: owner_username=owner-{{newUuid}}
variable: owner_email=owner-{{newUuid}}@test.local
variable: sharee_username=sharee-{{newUuid}}
variable: sharee_email=sharee-{{newUuid}}@test.local

POST {{base_url}}/api/signup.php
{"username":"{{owner_username}}","password":"TestPass123","email":"{{owner_email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
owner_code: jsonpath "$.items[?(@.Content.Headers.To[0]=='{{owner_email}}')].Content.Body" nth 0 regex "\\d{6}"
POST {{base_url}}/api/confirm.php
{"email":"{{owner_email}}","code":"{{owner_code}}"}
HTTP 200
[Captures]
owner_token: jsonpath "$.token"

POST {{base_url}}/api/signup.php
{"username":"{{sharee_username}}","password":"TestPass123","email":"{{sharee_email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
sharee_code: jsonpath "$.items[?(@.Content.Headers.To[0]=='{{sharee_email}}')].Content.Body" nth 0 regex "\\d{6}"
POST {{base_url}}/api/confirm.php
{"email":"{{sharee_email}}","code":"{{sharee_code}}"}
HTTP 200
[Captures]
sharee_token: jsonpath "$.token"

# --- Setup state: owner saves and shares ---
POST {{base_url}}/api/save.php
{"token":"{{owner_token}}","saveName":"shared-edition","edition":{"meta":{"name":"Shared"}}}
HTTP 200
POST {{base_url}}/api/share.php
{"token":"{{owner_token}}","saveName":"shared-edition","user":"{{sharee_username}}"}
HTTP 200

# --- Targeted unshare ---
POST {{base_url}}/api/unshare.php
{"token":"{{owner_token}}","saveName":"shared-edition","user":"{{sharee_username}}"}
HTTP 200
[Asserts]
body == "true"

# --- Sharee no longer sees it ---
POST {{base_url}}/api/list.php
{"token":"{{sharee_token}}","includeShared":true}
HTTP 200
[Asserts]
jsonpath "$.shared" count == 0

# --- Sharee cannot open it anymore ---
POST {{base_url}}/api/open.php
{"token":"{{sharee_token}}","saveName":["{{owner_username}}","shared-edition"]}
HTTP 200
[Asserts]
jsonpath "$.error" exists

# --- Re-share, then unshare-all ---
POST {{base_url}}/api/share.php
{"token":"{{owner_token}}","saveName":"shared-edition","user":"{{sharee_username}}"}
HTTP 200

POST {{base_url}}/api/unshare.php
{"token":"{{owner_token}}","saveName":"shared-edition","all":true}
HTTP 200

POST {{base_url}}/api/list.php
{"token":"{{sharee_token}}","includeShared":true}
HTTP 200
[Asserts]
jsonpath "$.shared" count == 0

# --- Teardown ---
POST {{base_url}}/api/deleteaccount.php
{"token":"{{owner_token}}","password":"TestPass123"}
HTTP 200
POST {{base_url}}/api/deleteaccount.php
{"token":"{{sharee_token}}","password":"TestPass123"}
HTTP 200
```

- [ ] **Step 3: `tests/api/sharing/leave.hurl`**

```
# leave.hurl — owner shares with sharee, sharee leaves the share.

# --- Two-user setup ---
GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: owner_username=owner-{{newUuid}}
variable: owner_email=owner-{{newUuid}}@test.local
variable: sharee_username=sharee-{{newUuid}}
variable: sharee_email=sharee-{{newUuid}}@test.local

POST {{base_url}}/api/signup.php
{"username":"{{owner_username}}","password":"TestPass123","email":"{{owner_email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
owner_code: jsonpath "$.items[?(@.Content.Headers.To[0]=='{{owner_email}}')].Content.Body" nth 0 regex "\\d{6}"
POST {{base_url}}/api/confirm.php
{"email":"{{owner_email}}","code":"{{owner_code}}"}
HTTP 200
[Captures]
owner_token: jsonpath "$.token"

POST {{base_url}}/api/signup.php
{"username":"{{sharee_username}}","password":"TestPass123","email":"{{sharee_email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
sharee_code: jsonpath "$.items[?(@.Content.Headers.To[0]=='{{sharee_email}}')].Content.Body" nth 0 regex "\\d{6}"
POST {{base_url}}/api/confirm.php
{"email":"{{sharee_email}}","code":"{{sharee_code}}"}
HTTP 200
[Captures]
sharee_token: jsonpath "$.token"

# --- Setup: owner saves and shares ---
POST {{base_url}}/api/save.php
{"token":"{{owner_token}}","saveName":"shared-edition","edition":{"meta":{"name":"Shared"}}}
HTTP 200
POST {{base_url}}/api/share.php
{"token":"{{owner_token}}","saveName":"shared-edition","user":"{{sharee_username}}"}
HTTP 200

# --- Sharee leaves ---
POST {{base_url}}/api/leave.php
{"token":"{{sharee_token}}","owner":"{{owner_username}}","saveName":"shared-edition"}
HTTP 200
[Asserts]
body == "true"

# --- Sharee's list no longer has it ---
POST {{base_url}}/api/list.php
{"token":"{{sharee_token}}","includeShared":true}
HTTP 200
[Asserts]
jsonpath "$.shared" count == 0

# --- Owner's get-shared no longer lists the sharee ---
POST {{base_url}}/api/get-shared.php
{"token":"{{owner_token}}","saveName":"shared-edition"}
HTTP 200
[Asserts]
jsonpath "$.users" count == 0

# --- Teardown ---
POST {{base_url}}/api/deleteaccount.php
{"token":"{{owner_token}}","password":"TestPass123"}
HTTP 200
POST {{base_url}}/api/deleteaccount.php
{"token":"{{sharee_token}}","password":"TestPass123"}
HTTP 200
```

- [ ] **Step 4: `tests/api/sharing/permission.hurl`**

```
# permission.hurl — non-owner cannot read, unshare, or delete an edition
# they have no share access to. Asserts the CURRENT behavior; flag real
# authz bugs but do not fix them here.

# --- Two-user setup ---
GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: owner_username=owner-{{newUuid}}
variable: owner_email=owner-{{newUuid}}@test.local
variable: sharee_username=sharee-{{newUuid}}
variable: sharee_email=sharee-{{newUuid}}@test.local

POST {{base_url}}/api/signup.php
{"username":"{{owner_username}}","password":"TestPass123","email":"{{owner_email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
owner_code: jsonpath "$.items[?(@.Content.Headers.To[0]=='{{owner_email}}')].Content.Body" nth 0 regex "\\d{6}"
POST {{base_url}}/api/confirm.php
{"email":"{{owner_email}}","code":"{{owner_code}}"}
HTTP 200
[Captures]
owner_token: jsonpath "$.token"

POST {{base_url}}/api/signup.php
{"username":"{{sharee_username}}","password":"TestPass123","email":"{{sharee_email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
sharee_code: jsonpath "$.items[?(@.Content.Headers.To[0]=='{{sharee_email}}')].Content.Body" nth 0 regex "\\d{6}"
POST {{base_url}}/api/confirm.php
{"email":"{{sharee_email}}","code":"{{sharee_code}}"}
HTTP 200
[Captures]
sharee_token: jsonpath "$.token"

# --- Setup: owner saves but does NOT share ---
POST {{base_url}}/api/save.php
{"token":"{{owner_token}}","saveName":"shared-edition","edition":{"meta":{"name":"Secret"}}}
HTTP 200

# --- Sharee tries to open unshared edition → error ---
POST {{base_url}}/api/open.php
{"token":"{{sharee_token}}","saveName":["{{owner_username}}","shared-edition"]}
HTTP 200
[Asserts]
jsonpath "$.error" exists

# --- Sharee tries to unshare (observe & adjust) ---
POST {{base_url}}/api/unshare.php
{"token":"{{sharee_token}}","saveName":"shared-edition","user":"{{owner_username}}"}
HTTP 200
# If this returns `true` (silent success for non-owner) that is a security
# concern — flag in DONE_WITH_CONCERNS but do not fix. Assert whatever the
# code actually returns; the goal is to document reality.

# --- Sharee tries to delete (observe & adjust) ---
POST {{base_url}}/api/delete.php
{"token":"{{sharee_token}}","saveName":"shared-edition"}
HTTP 200
# Same principle — if non-owner delete silently succeeds, that's a real
# authz bug worth a follow-up task but not a fix here.

# --- Owner's edition is still intact ---
POST {{base_url}}/api/exists.php
{"token":"{{owner_token}}","saveName":"shared-edition"}
HTTP 200
[Asserts]
body == "true"

# --- Teardown ---
POST {{base_url}}/api/deleteaccount.php
{"token":"{{owner_token}}","password":"TestPass123"}
HTTP 200
POST {{base_url}}/api/deleteaccount.php
{"token":"{{sharee_token}}","password":"TestPass123"}
HTTP 200
```

> **Note for the implementer:** Permission boundaries in this codebase are looser than ideal. Write the assertions to match observed behavior on the un-asserted "observe & adjust" requests; flag any real authz bug in DONE_WITH_CONCERNS. Do NOT fix the bug in this task — file it as a follow-up.

- [ ] **Step 5: Run and commit**

```bash
./scripts/test-stack.sh up
hurl --test --variables-file tests/api/env.test tests/api/sharing/*.hurl
./scripts/test-stack.sh down
```

```bash
git add tests/api/sharing/
git commit -m "Add Hurl tests for sharing (share/unshare/leave/permission)"
```

---

## Task 7: Social — block / unblock / get-blocked

Each `.hurl` file below is fully self-contained. `block.hurl` and `unblock.hurl` need two scratch users (blocker + blockee); `get-blocked.hurl` only needs one.

**Files:**
- Create: `tests/api/social/block.hurl`
- Create: `tests/api/social/unblock.hurl`
- Create: `tests/api/social/get-blocked.hurl`

- [ ] **Step 1: `tests/api/social/block.hurl`**

```
# block.hurl — blocker blocks blockee; covers success, idempotence,
# self-block rejection, and unknown-user rejection.

# --- Two-user setup: create and confirm blocker and blockee ---
GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: blocker_username=blocker-{{newUuid}}
variable: blocker_email=blocker-{{newUuid}}@test.local
variable: blockee_username=blockee-{{newUuid}}
variable: blockee_email=blockee-{{newUuid}}@test.local

POST {{base_url}}/api/signup.php
{"username":"{{blocker_username}}","password":"TestPass123","email":"{{blocker_email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
blocker_code: jsonpath "$.items[?(@.Content.Headers.To[0]=='{{blocker_email}}')].Content.Body" nth 0 regex "\\d{6}"
POST {{base_url}}/api/confirm.php
{"email":"{{blocker_email}}","code":"{{blocker_code}}"}
HTTP 200
[Captures]
blocker_token: jsonpath "$.token"

POST {{base_url}}/api/signup.php
{"username":"{{blockee_username}}","password":"TestPass123","email":"{{blockee_email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
blockee_code: jsonpath "$.items[?(@.Content.Headers.To[0]=='{{blockee_email}}')].Content.Body" nth 0 regex "\\d{6}"
POST {{base_url}}/api/confirm.php
{"email":"{{blockee_email}}","code":"{{blockee_code}}"}
HTTP 200
[Captures]
blockee_token: jsonpath "$.token"

# --- Happy path: block blockee ---
POST {{base_url}}/api/block.php
{"token":"{{blocker_token}}","username":"{{blockee_username}}"}
HTTP 200
[Asserts]
body == "true"

# --- get-blocked now includes them ---
POST {{base_url}}/api/get-blocked.php
{"token":"{{blocker_token}}"}
HTTP 200
[Asserts]
jsonpath "$.users" includes "{{blockee_username}}"

# --- Double-block: observe behavior (prevented vs silently idempotent) ---
POST {{base_url}}/api/block.php
{"token":"{{blocker_token}}","username":"{{blockee_username}}"}
HTTP 200
# Assert what the code actually does. If `true` (idempotent), no further
# assertion; if `{"error":"..."}`, add `jsonpath "$.error" exists`.

# --- Cannot block self ---
POST {{base_url}}/api/block.php
{"token":"{{blocker_token}}","username":"{{blocker_username}}"}
HTTP 200
[Asserts]
jsonpath "$.error" exists

# --- Cannot block unknown user ---
POST {{base_url}}/api/block.php
{"token":"{{blocker_token}}","username":"definitely-not-a-user"}
HTTP 200
[Asserts]
jsonpath "$.error" exists

# --- Teardown both users ---
POST {{base_url}}/api/deleteaccount.php
{"token":"{{blocker_token}}","password":"TestPass123"}
HTTP 200
POST {{base_url}}/api/deleteaccount.php
{"token":"{{blockee_token}}","password":"TestPass123"}
HTTP 200
```

- [ ] **Step 2: `tests/api/social/unblock.hurl`**

```
# unblock.hurl — blocker blocks blockee, then unblocks and verifies
# get-blocked is empty.

# --- Two-user setup ---
GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: blocker_username=blocker-{{newUuid}}
variable: blocker_email=blocker-{{newUuid}}@test.local
variable: blockee_username=blockee-{{newUuid}}
variable: blockee_email=blockee-{{newUuid}}@test.local

POST {{base_url}}/api/signup.php
{"username":"{{blocker_username}}","password":"TestPass123","email":"{{blocker_email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
blocker_code: jsonpath "$.items[?(@.Content.Headers.To[0]=='{{blocker_email}}')].Content.Body" nth 0 regex "\\d{6}"
POST {{base_url}}/api/confirm.php
{"email":"{{blocker_email}}","code":"{{blocker_code}}"}
HTTP 200
[Captures]
blocker_token: jsonpath "$.token"

POST {{base_url}}/api/signup.php
{"username":"{{blockee_username}}","password":"TestPass123","email":"{{blockee_email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
blockee_code: jsonpath "$.items[?(@.Content.Headers.To[0]=='{{blockee_email}}')].Content.Body" nth 0 regex "\\d{6}"
POST {{base_url}}/api/confirm.php
{"email":"{{blockee_email}}","code":"{{blockee_code}}"}
HTTP 200
[Captures]
blockee_token: jsonpath "$.token"

# --- Setup: establish a block so we have something to remove ---
POST {{base_url}}/api/block.php
{"token":"{{blocker_token}}","username":"{{blockee_username}}"}
HTTP 200

# --- Unblock ---
POST {{base_url}}/api/unblock.php
{"token":"{{blocker_token}}","username":"{{blockee_username}}"}
HTTP 200
[Asserts]
body == "true"

# --- get-blocked is now empty ---
POST {{base_url}}/api/get-blocked.php
{"token":"{{blocker_token}}"}
HTTP 200
[Asserts]
jsonpath "$.users" count == 0

# --- Teardown both users ---
POST {{base_url}}/api/deleteaccount.php
{"token":"{{blocker_token}}","password":"TestPass123"}
HTTP 200
POST {{base_url}}/api/deleteaccount.php
{"token":"{{blockee_token}}","password":"TestPass123"}
HTTP 200
```

- [ ] **Step 3: `tests/api/social/get-blocked.hurl`**

```
# get-blocked.hurl — fresh user has an empty block list. Only needs one
# scratch user.

# --- Single-user setup ---
GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local

POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
code: jsonpath "$.items[?(@.Content.Headers.To[0]=='{{email}}')].Content.Body" nth 0 regex "\\d{6}"
POST {{base_url}}/api/confirm.php
{"email":"{{email}}","code":"{{code}}"}
HTTP 200
[Captures]
token: jsonpath "$.token"

# --- Fresh account has no blocks ---
POST {{base_url}}/api/get-blocked.php
{"token":"{{token}}"}
HTTP 200
[Asserts]
jsonpath "$.users" count == 0

# --- Teardown ---
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
```

- [ ] **Step 4: Run & commit**

```bash
./scripts/test-stack.sh up
hurl --test --variables-file tests/api/env.test tests/api/social/*.hurl
./scripts/test-stack.sh down
```

```bash
git add tests/api/social/
git commit -m "Add Hurl tests for block/unblock/get-blocked"
```

---

## Task 8: Misc — cull + validate

Health is already done (Task 1). `cull.php` has no auth; `validate.php` checks a JWT.

**Files:**
- Create: `tests/api/misc/cull.hurl`
- Create: `tests/api/misc/validate.hurl`

- [ ] **Step 1: `tests/api/misc/cull.hurl`**

```
# cull.php removes old published editions. No auth. Should always return
# {"deleted": [...]} — empty in a fresh stack.

POST {{base_url}}/api/cull.php
{}
HTTP 200
[Asserts]
jsonpath "$.deleted" isCollection
```

- [ ] **Step 2: `tests/api/misc/validate.hurl`**

```
# Validate.php accepts a valid JWT and rejects an invalid one.

GET {{base_url}}/api/health.php
HTTP 200
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local

POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200

GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
code: jsonpath "$.items[0].Content.Body" regex "\\d{6}"

POST {{base_url}}/api/confirm.php
{"email":"{{email}}","code":"{{code}}"}
HTTP 200
[Captures]
token: jsonpath "$.token"

# Valid token → 200
POST {{base_url}}/api/validate.php
{"token":"{{token}}"}
HTTP 200

# Garbage token → 400 "signInRequired" (literal JSON string)
POST {{base_url}}/api/validate.php
{"token":"definitely.not.a.jwt"}
HTTP 400
[Asserts]
body == "\"signInRequired\""

# Missing token field → 200 {"error": "field \"token\" is missing"}
POST {{base_url}}/api/validate.php
{}
HTTP 200
[Asserts]
jsonpath "$.error" exists

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
```

- [ ] **Step 3: Run & commit**

```bash
./scripts/test-stack.sh up
hurl --test --variables-file tests/api/env.test tests/api/misc/*.hurl
./scripts/test-stack.sh down
```

```bash
git add tests/api/misc/cull.hurl tests/api/misc/validate.hurl
git commit -m "Add Hurl tests for cull + JWT validation"
```

---

## Task 9: CI — `integration.yml`

A new GitHub Actions workflow runs the Hurl suite on every PR.

**Files:**
- Create: `.github/workflows/integration.yml`

- [ ] **Step 1: Write the workflow**

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
    steps:
      - uses: actions/checkout@v4

      - name: Install Hurl
        run: |
          curl -fsSL -o /tmp/hurl.deb \
            https://github.com/Orange-OpenSource/hurl/releases/download/7.0.0/hurl_7.0.0_amd64.deb
          sudo dpkg -i /tmp/hurl.deb
          hurl --version

      - name: Run API test suite
        run: npm run test:api

      - name: Upload Hurl report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: hurl-report
          path: tests/api/.hurl-report
          if-no-files-found: ignore
```

Notes:
- Pin Hurl to `7.0.0` (or whatever current stable is when this lands). Update when a breaking change ships upstream.
- `npm run test:api` is the same command a dev uses locally — no CI-only magic.
- Report artifact uploaded only on failure; stack teardown happens inside `scripts/run-api-tests.sh`'s exit trap.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/integration.yml
git commit -m "Add GitHub Actions integration workflow for Hurl API tests"
```

---

## Task 10: End-to-end verification

Prove the whole suite passes from a cold start.

**Files:** none (behavioral).

- [ ] **Step 1: Clean slate**

```bash
./scripts/test-stack.sh down 2>/dev/null || true
docker volume ls | grep bloodstar-test || echo "clean"
```

- [ ] **Step 2: Full suite**

```bash
time npm run test:api
```

Expected: stack comes up, every `.hurl` file passes, stack tears down, exit 0. Should complete in under 5 minutes even on a slow machine (most time is Docker cold build).

Report: total files, total requests, total duration.

- [ ] **Step 3: `test:all` still chains cleanly**

```bash
npm run test:all
```

Expected: Vitest (Phase 2) passes, then `test:api` runs the whole Hurl suite, then `test:e2e` prints its Phase-4 placeholder, all exit 0.

- [ ] **Step 4: Push + CI**

User pushes the branch; verify `integration.yml` runs green on GitHub.

- [ ] **Step 5: Optional tag**

```bash
git tag testing/phase-3-complete
```

---

## Acceptance criteria for Phase 3

1. `npm run test:api` brings up the stack, runs every `.hurl` file, tears down, exits 0.
2. All 25 real endpoints in `dist/api/` are exercised by at least one `.hurl` file.
3. Each `.hurl` file is fully self-contained (creates + deletes its own user).
4. No `.hurl` file leaves DB rows or filesystem artifacts after teardown (verify with `docker compose exec db mariadb ... -e 'SELECT count(*) FROM users'` → 0).
5. Email-driven flows use mailhog, not SMTP probing.
6. `.github/workflows/integration.yml` exists and passes on the pushed branch.
7. No production source file in `dist/api/` or `src/` is modified.
8. `tests/api/README.md` documents how to install Hurl and run the suite.

## Out of scope for Phase 3 (reminder)

- Playwright / browser tests (Phase 4).
- Nightly full-matrix workflow (Phase 6).
- Load / performance testing.
- Security-focused penetration tests (the Task-6 permission tests document current behavior, not ideal behavior).

## Anticipated gotchas

- **Hurl jsonpath filter syntax may differ between minor versions.** Where the plan uses `$.items[?(@.Content.Headers.To[0]=='{{email}}')]`, older Hurls may need a simpler shape. Fallback: capture `items[0]` assuming mailhog's newest-first ordering (valid for the bodies of single-user tests).
- **Mailhog accumulates messages across `.hurl` files when the stack is reused during debugging.** For developers: `curl -X DELETE http://localhost:8026/api/v1/messages` clears the inbox. The CI command always tears down and wipes state — no issue there.
- **`save.php` max-characters limit is 200.** Any test that generates characters in a loop needs to stay well under that.
- **PHP `errorlog`** may mention warnings when tests probe error paths; that's OK as long as the response body/status matches expectations.
- **`deleteaccount.php` may fail if the test never made it far enough to have a valid token.** Each test file should be structured so that if setup fails, teardown is skipped (Hurl stops on the first failing request by default — that's the behavior we want).
