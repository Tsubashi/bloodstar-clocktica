# share.hurl — owner creates an edition, shares with sharee, verifies
# sharee can list, open, and that get-shared reports the relationship.
#
# Note: tests run serially (--jobs 1). After each signup, items[0] is
# the just-delivered message (mailhog returns newest-first).

# --- Two-user setup ---
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
jsonpath "$.shared.{{owner_username}}" contains "shared-edition"

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
jsonpath "$.users" contains "{{sharee_username}}"

# --- Teardown both users ---
POST {{base_url}}/api/deleteaccount.php
{"token":"{{owner_token}}","password":"TestPass123"}
HTTP 200
POST {{base_url}}/api/deleteaccount.php
{"token":"{{sharee_token}}","password":"TestPass123"}
HTTP 200
