# Health endpoint — no auth, no DB write. Green here means the stack is up.
GET {{base_url}}/api/health.php
HTTP 200
[Asserts]
jsonpath "$.status" == "ok"
jsonpath "$.db" == "ok"
