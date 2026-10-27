# Security design and limitations

## Implemented controls

- Separate ingestion and reviewer bearer credentials.
- Ingestion token maps to exactly one server identifier; payload identity must match that mapping.
- Request body size limit and typed schema validation.
- Ingestion byte limit enforced while streaming request bodies, including requests without a `Content-Length` header.
- Timezone-aware collection timestamps normalized to UTC.
- Unique server/execution pair prevents duplicate submissions.
- Database parameters are bound values, not interpolated SQL.
- CSV cells are quoted and formula-leading values are neutralized.
- Export lifecycle is recorded as pending, available, failed, or legacy/unverified; exact payload replays can retry an incomplete export without replacing different evidence.
- The CSV SHA-256 digest is checked before download. This detects an object mismatch relative to the database record but does not make either store immutable.
- Startup adds export metadata columns idempotently; pre-existing records without an expected CSV digest are treated as legacy/unverified until the same snapshot is replayed and its export regenerated.
- API emits minimal structured audit events and does not log authorization headers or payload contents.
- Rejected authentication attempts and schema failures are recorded by category without credentials or submitted values.
- PostgreSQL and MinIO are not published on host ports in the Compose file.

## Local-demo limitations

- Compose uses HTTP on localhost. Use TLS in transit for any remote agent or shared environment.
- Static bearer tokens are demo credentials, not an enterprise identity or key-management solution. Rotate them and use a secrets manager in deployment. The collector can read a token from a local file and rejects files accessible by group/other users; this does not replace managed secret distribution or rotation.
- The viewer token is a shared bearer credential. It does not provide individual identity, MFA, roles, or a durable user audit trail.
- The browser UI sends the reviewer token from the browser. Do not reuse this pattern as a production authentication flow.
- PostgreSQL and MinIO demo credentials must be replaced. At-rest encryption depends on the underlying host or production storage configuration.
- Retention is documented but automatic expiry/deletion is not implemented. Backups, restore testing, alerting, rate limiting, vulnerability management, image pinning/scanning, and key rotation automation are follow-up work.
- Process and session names can reveal operational or personal information. The demo collects names only, not command-line arguments or environment variables, but still requires access limitation and a justified retention period.
- Do not ingest cardholder data or sensitive authentication data. PCI DSS applicability must be assessed against the actual CDE and impact boundary.

