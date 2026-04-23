# resendconf.php issues a fresh 6-digit code for a user that signed up
# but hasn't confirmed yet.

GET {{base_url}}/api/health.php
[Options]
variable: username=test-{{newUuid}}
variable: email=test-{{newUuid}}@test.local
HTTP 200

# Start signup but do NOT confirm yet
POST {{base_url}}/api/signup.php
{"username":"{{username}}","password":"TestPass123","email":"{{email}}"}
HTTP 200
[Asserts]
body == "true"

# Capture the first code
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
first_code: jsonpath "$.items[0].Content.Body" regex "(\\d{6})"

# Resend confirmation
POST {{base_url}}/api/resendconf.php
{"email":"{{email}}"}
HTTP 200
[Asserts]
body == "true"

# Mailhog now has TWO messages; newest (item 0) is the resend
GET {{mailhog_url}}/api/v2/messages
HTTP 200
[Captures]
second_code: jsonpath "$.items[0].Content.Body" regex "(\\d{6})"
[Asserts]
jsonpath "$.total" >= 2

# Confirm with the SECOND code (proves the newer one is accepted)
POST {{base_url}}/api/confirm.php
{"email":"{{email}}","code":"{{second_code}}"}
HTTP 200
[Captures]
token: jsonpath "$.token"

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
