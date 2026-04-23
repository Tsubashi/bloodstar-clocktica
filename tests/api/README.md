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
