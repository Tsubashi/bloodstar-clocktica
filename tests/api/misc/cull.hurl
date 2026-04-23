# cull.php removes old published editions. No auth. Returns {deleted: [...]}.

POST {{base_url}}/api/cull.php
{}
HTTP 200
[Asserts]
jsonpath "$.deleted" isCollection
