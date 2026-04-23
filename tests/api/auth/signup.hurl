# Full signup + confirm + signin + validate + delete-account flow.
# Exercises: signup.php, mailhog, confirm.php, signin.php, validate.php,
# deleteaccount.php. Self-contained: creates and destroys one scratch user.

# Pre-compute per-run identity values so later requests can reference them.
# [Options] is a request section (before HTTP response line), not a response section.
GET {{base_url}}/api/health.php
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local
HTTP 200

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
# Only one signup happened in this file, so items[0] is ours.
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
code: jsonpath "$.items[0].Content.Body" regex "(\\d{6})"
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
[Asserts]
jsonpath "$.email" == "{{email}}"
jsonpath "$.username" == "{{username}}"
jsonpath "$.token" matches "^[A-Za-z0-9\\-_=]+\\.[A-Za-z0-9\\-_=]+\\.[A-Za-z0-9\\-_.+/=]+$"

# --- Sign in ---
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

# --- Teardown: delete the account ---
POST {{base_url}}/api/deleteaccount.php
{
  "token": "{{signin_token}}",
  "password": "TestPass123"
}
HTTP 200
[Asserts]
body == "true"
