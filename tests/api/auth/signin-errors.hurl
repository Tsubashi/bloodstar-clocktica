# Signin rejects unknown users and wrong passwords.

GET {{base_url}}/api/health.php
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local
HTTP 200

# Setup: create & confirm a user
POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200
[Asserts]
body == "true"

GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
code: jsonpath "$.items[0].Content.Body" regex "(\\d{6})"

POST {{base_url}}/api/confirm.php
{"email":"{{email}}","code":"{{code}}"}
HTTP 200
[Captures]
setup_token: jsonpath "$.token"

# --- Wrong password ---
POST {{base_url}}/api/signin.php
{"usernameOrEmail":"{{username}}","password":"WrongPass123"}
HTTP 200
[Asserts]
jsonpath "$.title" == "Sign-In Error"
jsonpath "$.token" not exists

# --- Unknown username ---
POST {{base_url}}/api/signin.php
{"usernameOrEmail":"definitely-not-a-user","password":"TestPass123"}
HTTP 200
[Asserts]
jsonpath "$.title" == "Sign-In Error"
jsonpath "$.token" not exists

# --- Unknown email ---
POST {{base_url}}/api/signin.php
{"usernameOrEmail":"nobody@test.local","password":"TestPass123"}
HTTP 200
[Asserts]
jsonpath "$.title" == "Sign-In Error"
jsonpath "$.token" not exists

# --- Correct credentials (positive control) ---
POST {{base_url}}/api/signin.php
{"usernameOrEmail":"{{username}}","password":"TestPass123"}
HTTP 200
[Asserts]
jsonpath "$.username" == "{{username}}"

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{setup_token}}","password":"TestPass123"}
HTTP 200
