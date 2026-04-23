# list.php returns the authenticated user's save names, plus optional shared map.

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

# --- List returns all three ---
POST {{base_url}}/api/list.php
{"token":"{{token}}"}
HTTP 200
[Asserts]
jsonpath "$.files" count == 3
jsonpath "$.files" contains "a"
jsonpath "$.files" contains "b"
jsonpath "$.files" contains "c"

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
