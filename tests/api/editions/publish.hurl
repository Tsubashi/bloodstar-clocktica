# publish.php generates static assets under /p/<user>/<save>/ and returns
# URLs the client uses to share them. Verify the URLs are reachable and
# serve valid JSON/HTML.

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

# Save a publishable edition (minimal realistic shape)
POST {{base_url}}/api/save.php
{
  "token": "{{token}}",
  "saveName": "myedition",
  "edition": {
    "meta": {"name": "Published"},
    "almanac": {"synopsis": "A test."},
    "characterList": [{"id": "zero", "name": "Zero", "team": "townsfolk", "ability": "Nothing."}],
    "firstNightOrder": ["zero"],
    "otherNightOrder": ["zero"]
  }
}
HTTP 200

# --- Publish ---
POST {{base_url}}/api/publish.php
{"token":"{{token}}","saveName":"myedition"}
HTTP 200
[Captures]
script_url: jsonpath "$.script"
almanac_url: jsonpath "$.almanac"
[Asserts]
jsonpath "$.success" == true

# --- Published script is reachable and contains valid JSON content ---
GET {{script_url}}
HTTP 200
[Asserts]
body contains "\"id\""

# --- Published almanac is reachable ---
GET {{almanac_url}}
HTTP 200
[Asserts]
body contains "<html"

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
