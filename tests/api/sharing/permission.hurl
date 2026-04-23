# permission.hurl — non-owner without a share cannot read the edition.
# Unshare and delete attempts from non-owners: document observed behavior.
#
# Note: tests run serially (--jobs 1). After each signup, items[0] is
# the just-delivered message (mailhog returns newest-first).
#
# Observed behavior (from PHP source):
# - unshare.php uses the token's own username as owner, so sharee's call
#   silently targets sharee's own (non-existent) editions. Returns true.
# - delete.php uses the token's own username, so sharee's call tries to
#   delete sharee's own (non-existent) edition. Returns true. Owner is safe.
# - exists.php checks the token user's own usersave dir; owner's edition
#   remains intact.

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

# Setup: owner saves but does NOT share
POST {{base_url}}/api/save.php
{"token":"{{owner_token}}","saveName":"shared-edition","edition":{"meta":{"name":"Secret"}}}
HTTP 200

# --- Sharee cannot open unshared edition ---
POST {{base_url}}/api/open.php
{"token":"{{sharee_token}}","saveName":["{{owner_username}}","shared-edition"]}
HTTP 200
[Asserts]
jsonpath "$.error" exists

# --- Sharee tries unshare: observed behavior = silent true (scoped to sharee's own editions) ---
POST {{base_url}}/api/unshare.php
{"token":"{{sharee_token}}","saveName":"shared-edition","user":"{{owner_username}}"}
HTTP 200
[Asserts]
body == "true"

# --- Sharee tries delete: observed behavior = silent true (deletes sharee's own non-existent path) ---
POST {{base_url}}/api/delete.php
{"token":"{{sharee_token}}","saveName":"shared-edition"}
HTTP 200
[Asserts]
body == "true"

# --- Owner's edition is still intact ---
POST {{base_url}}/api/exists.php
{"token":"{{owner_token}}","saveName":"shared-edition"}
HTTP 200
[Asserts]
body == "true"

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{owner_token}}","password":"TestPass123"}
HTTP 200
POST {{base_url}}/api/deleteaccount.php
{"token":"{{sharee_token}}","password":"TestPass123"}
HTTP 200
