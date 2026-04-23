# block.hurl — blocker blocks blockee; covers success, idempotence,
# self-block rejection, and unknown-user rejection.

GET {{base_url}}/api/health.php
[Options]
variable: blocker_username=blocker-{{newUuid}}
variable: blocker_email=blocker-{{newUuid}}@test.local
variable: blockee_username=blockee-{{newUuid}}
variable: blockee_email=blockee-{{newUuid}}@test.local
HTTP 200

# Blocker signup + confirm
POST {{base_url}}/api/signup.php
{"username":"{{blocker_username}}","password":"TestPass123","email":"{{blocker_email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
blocker_code: jsonpath "$.items[0].Content.Body" regex "(\\d{6})"
POST {{base_url}}/api/confirm.php
{"email":"{{blocker_email}}","code":"{{blocker_code}}"}
HTTP 200
[Captures]
blocker_token: jsonpath "$.token"

# Blockee signup + confirm
POST {{base_url}}/api/signup.php
{"username":"{{blockee_username}}","password":"TestPass123","email":"{{blockee_email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
blockee_code: jsonpath "$.items[0].Content.Body" regex "(\\d{6})"
POST {{base_url}}/api/confirm.php
{"email":"{{blockee_email}}","code":"{{blockee_code}}"}
HTTP 200
[Captures]
blockee_token: jsonpath "$.token"

# --- Happy path ---
POST {{base_url}}/api/block.php
{"token":"{{blocker_token}}","username":"{{blockee_username}}"}
HTTP 200
[Asserts]
body == "true"

# --- get-blocked reports ---
POST {{base_url}}/api/get-blocked.php
{"token":"{{blocker_token}}"}
HTTP 200
[Asserts]
jsonpath "$.users" contains "{{blockee_username}}"

# --- Double-block returns error "user already added" ---
POST {{base_url}}/api/block.php
{"token":"{{blocker_token}}","username":"{{blockee_username}}"}
HTTP 200
[Asserts]
jsonpath "$.error" exists

# --- Cannot block self ---
POST {{base_url}}/api/block.php
{"token":"{{blocker_token}}","username":"{{blocker_username}}"}
HTTP 200
[Asserts]
jsonpath "$.error" exists

# --- Cannot block unknown user ---
POST {{base_url}}/api/block.php
{"token":"{{blocker_token}}","username":"definitely-not-a-user-zzz"}
HTTP 200
[Asserts]
jsonpath "$.error" exists

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{blocker_token}}","password":"TestPass123"}
HTTP 200
POST {{base_url}}/api/deleteaccount.php
{"token":"{{blockee_token}}","password":"TestPass123"}
HTTP 200
