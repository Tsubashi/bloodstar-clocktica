# exists.php reports whether a save file exists for the authenticated user.

GET {{base_url}}/api/health.php
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local
HTTP 200

# Setup
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

# --- Nonexistent save returns false ---
POST {{base_url}}/api/exists.php
{"token":"{{token}}","saveName":"nope"}
HTTP 200
[Asserts]
body == "false"

# --- Save an edition, then check ---
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
