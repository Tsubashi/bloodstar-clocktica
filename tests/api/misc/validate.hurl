# validate.php accepts a JWT token and returns 200 for valid tokens.

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

# --- Valid token → 200 ---
POST {{base_url}}/api/validate.php
{"token":"{{token}}"}
HTTP 200

# --- Invalid token → 200 (accepts any token) ---
POST {{base_url}}/api/validate.php
{"token":"definitely.not.a.jwt"}
HTTP 200

# --- Missing token field → 200 (accepts empty body) ---
POST {{base_url}}/api/validate.php
{}
HTTP 200

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
