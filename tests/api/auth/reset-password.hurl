# requestreset.php + reset.php flow: change password via email code.

GET {{base_url}}/api/health.php
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local
HTTP 200

# Setup: a confirmed account
POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200

GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
confirm_code: jsonpath "$.items[0].Content.Body" regex "(\\d{6})"

POST {{base_url}}/api/confirm.php
{"email":"{{email}}","code":"{{confirm_code}}"}
HTTP 200

# --- Request reset ---
# requestreset echoes back whichever identifier was submitted as $.username
POST {{base_url}}/api/requestreset.php
{"usernameOrEmail":"{{username}}"}
HTTP 200
[Asserts]
jsonpath "$.username" == "{{username}}"

# The newest mailhog message is the reset; subject contains "password reset"
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
reset_code: jsonpath "$.items[0].Content.Body" regex "(\\d{6})"

# --- Reset the password ---
POST {{base_url}}/api/reset.php
{"email":"{{email}}","code":"{{reset_code}}","password":"NewPass456"}
HTTP 200
[Captures]
reset_token: jsonpath "$.token"
[Asserts]
jsonpath "$.username" == "{{username}}"

# --- Old password no longer works ---
POST {{base_url}}/api/signin.php
{"usernameOrEmail":"{{username}}","password":"TestPass123"}
HTTP 200
[Asserts]
jsonpath "$.title" == "Sign-In Error"

# --- New password works ---
POST {{base_url}}/api/signin.php
{"usernameOrEmail":"{{username}}","password":"NewPass456"}
HTTP 200
[Asserts]
jsonpath "$.username" == "{{username}}"

# Teardown with new password
POST {{base_url}}/api/deleteaccount.php
{"token":"{{reset_token}}","password":"NewPass456"}
HTTP 200
