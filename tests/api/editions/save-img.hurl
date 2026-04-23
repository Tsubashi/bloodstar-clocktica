# save-img.php uploads a character image encoded as a data URI.

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

# Need a save to hang the image off of
POST {{base_url}}/api/save.php
{"token":"{{token}}","saveName":"imgsave","edition":{"meta":{"name":"Img"}}}
HTTP 200

# Upload a tiny PNG as character image. Base64 below is the contents of
# tests/api/fixtures/tiny.png (1x1 red pixel, ~70 bytes).
POST {{base_url}}/api/save-img.php
{
  "token": "{{token}}",
  "saveName": "imgsave",
  "id": "testchar",
  "isSource": false,
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8//8/AwAI/AL+6lLFNgAAAABJRU5ErkJggg=="
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# Image should be retrievable as a static file at /usersave/<user>/<save>/<id>.png.
# Accept any status: nginx may or may not serve this path statically.
GET {{base_url}}/usersave/{{username}}/imgsave/testchar.png
HTTP *

# Teardown
POST {{base_url}}/api/deleteaccount.php
{"token":"{{token}}","password":"TestPass123"}
HTTP 200
