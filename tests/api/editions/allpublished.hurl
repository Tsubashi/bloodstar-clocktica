# allpublished.php returns the global list of every published edition.
# No auth required.

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

# Publish an edition so the global list is non-empty
POST {{base_url}}/api/save.php
{"token":"{{token}}","saveName":"globalpub","edition":{"meta":{"name":"Glob"},"characterList":[]}}
HTTP 200

POST {{base_url}}/api/publish.php
{"token":"{{token}}","saveName":"globalpub"}
HTTP 200
[Captures]
my_script_url: jsonpath "$.script"

# --- List everything, unauthenticated ---
GET {{base_url}}/api/allpublished.php
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$" count >= 1

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
