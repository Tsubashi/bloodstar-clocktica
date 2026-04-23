# save → open round-trip, including clobber-guard and clobber-overwrite.

GET {{base_url}}/api/health.php
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local
HTTP 200

POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200

GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
code: jsonpath "$.items[0].Content.Body" regex "(\\d{6})"

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
  "edition": {"meta": {"name": "Hurl Round Trip"}}
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
