# leave.hurl — sharee voluntarily leaves a share.
#
# Note: tests run serially (--jobs 1). After each signup, items[0] is
# the just-delivered message (mailhog returns newest-first).

GET {{base_url}}/api/health.php
[Options]
variable: owner_username=owner-{{newUuid}}
variable: owner_email=owner-{{newUuid}}@test.local
variable: sharee_username=sharee-{{newUuid}}
variable: sharee_email=sharee-{{newUuid}}@test.local
HTTP 200

POST {{base_url}}/api/signup.php
{"username":"{{owner_username}}","password":"TestPass123","email":"{{owner_email}}"}
HTTP 200
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
owner_code: jsonpath "$.items[0].Content.Body" regex "(\\d{6})"
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
sharee_code: jsonpath "$.items[0].Content.Body" regex "(\\d{6})"
POST {{base_url}}/api/confirm.php
{"email":"{{sharee_email}}","code":"{{sharee_code}}"}
HTTP 200
[Captures]
sharee_token: jsonpath "$.token"

# Setup: owner saves and shares
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

# --- Sharee no longer sees it ---
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

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{owner_token}}","password":"TestPass123"}
HTTP 200
POST {{base_url}}/api/deleteaccount.php
{"token":"{{sharee_token}}","password":"TestPass123"}
HTTP 200
