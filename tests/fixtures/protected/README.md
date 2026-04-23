# Test fixtures — protected secrets

These files are **throwaway test credentials**. They are committed to the repo
on purpose so the test stack is reproducible in CI without external secret
management.

- `db` — DB connection config for the MariaDB service in
  `docker-compose.test.yaml`. Matches the env vars set on that service.
- `jwt_key.pem` / `jwt_key.pub` — RSA keypair used by `dist/api/jwt.php` for
  signing/verifying session tokens. Regenerated whenever you like; no
  production system uses them.

**Never** reuse these credentials or keys for any deployed instance.
