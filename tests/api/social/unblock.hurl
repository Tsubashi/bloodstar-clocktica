# unblock.hurl — block then unblock, verify get-blocked empty.

GET {{base_url}}/api/health.php
[Options]
variable: blocker_username=blocker-{{newUuid}}
variable: blocker_email=blocker-{{newUuid}}@test.local
variable: blockee_username=blockee-{{newUuid}}
variable: blockee_email=blockee-{{newUuid}}@test.local
HTTP 200

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

# Setup: block
POST {{base_url}}/api/block.php
{"token":"{{blocker_token}}","username":"{{blockee_username}}"}
HTTP 200

# --- Unblock ---
POST {{base_url}}/api/unblock.php
{"token":"{{blocker_token}}","username":"{{blockee_username}}"}
HTTP 200
[Asserts]
body == "true"

# --- get-blocked empty ---
POST {{base_url}}/api/get-blocked.php
{"token":"{{blocker_token}}"}
HTTP 200
[Asserts]
jsonpath "$.users" count == 0

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{blocker_token}}","password":"TestPass123"}
HTTP 200
POST {{base_url}}/api/deleteaccount.php
{"token":"{{blockee_token}}","password":"TestPass123"}
HTTP 200
