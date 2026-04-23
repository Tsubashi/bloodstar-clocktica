# delete.php removes an edition's save directory (and its published copy if any).

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

POST {{base_url}}/api/save.php
{"token":"{{token}}","saveName":"todelete","edition":{"meta":{"name":"Bye"}}}
HTTP 200

# exists → true
POST {{base_url}}/api/exists.php
{"token":"{{token}}","saveName":"todelete"}
HTTP 200
[Asserts]
body == "true"

# Delete
POST {{base_url}}/api/delete.php
{"token":"{{token}}","saveName":"todelete"}
HTTP 200
[Asserts]
body == "true"

# exists → false
POST {{base_url}}/api/exists.php
{"token":"{{token}}","saveName":"todelete"}
HTTP 200
[Asserts]
body == "false"

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
