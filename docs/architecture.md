# Architecture and data flow

## Components

- **Linux agent:** Runs on the target host, outside the Compose stack. It collects only CPU summary, process names, logged-in user names, OS name/version, configured server ID, execution ID, UTC collection time, and agent version. It requires HTTPS for non-loopback destinations, verifies certificates by default, and refuses redirects; it is not tamper-proof against a privileged target-host attacker.
- **API:** FastAPI accepts JSON or the documented two-column CSV form, validates both into the same canonical snapshot, authenticates the agent, binds its token to an authorized server ID, writes the snapshot and metadata to PostgreSQL, and writes a CSV export to MinIO. JSON is the collector default.
- **Web reviewer:** Static HTML, CSS, and JavaScript in a separate non-root Nginx container. It authenticates with a viewer token, lists configured agent/server identities, displays snapshot and host-profile summaries, evidence status, and digests, and provides integrity-checked JSON and CSV previews plus verified CSV downloads. Its summary omits process names and usernames; the token remains in page memory only. Nginx applies local-demo security headers and a Content Security Policy.
- **PostgreSQL:** Stores validated JSON snapshot content, original ingestion format, timestamps, payload and CSV digests, evidence object key, and evidence-export state.
- **MinIO:** S3-compatible local object storage for CSV evidence. Compose pins the local Chainguard image by digest for repeatable pulls.

## Trust boundaries

The agent host and its token are outside the API trust boundary. TLS is required for a non-local deployment. The API is the only component that should access PostgreSQL and MinIO. Browser-side reviewer credentials are suitable only for this isolated demo because they are held by the browser; production should use an identity provider and short-lived authorization. Compose publishes only the API and web ports; database and object storage ports remain internal to the Compose network.

## Ingestion sequence

1. Agent creates a versioned payload and sends it with a bearer token.
2. API enforces a byte limit, validates the schema, and maps the token to one permitted server ID.
3. API parses the submitted JSON or CSV into the validated model, canonicalizes it as JSON, and generates a sanitized evidence CSV; it calculates separate SHA-256 digests for each representation.
4. API inserts the unique `(server_id, execution_id)` record with `pending` evidence status, then uploads the CSV under a deterministic object key.
5. API marks the export `available` only after upload succeeds. On failure it records `failed`; replaying the same snapshot can safely retry the upload. Replaying different content under the same execution ID is rejected.
6. API checks the CSV digest before returning CSV content and checks the canonical payload digest before returning JSON; it records a minimal audit event for either read.

## Evidence and lifecycle

The database is the query source; the CSV is an export artifact. PostgreSQL and MinIO use named persistent volumes. The database and object store do not share a transaction: a process or storage failure can leave an export pending/failed, which an identical replay can repair. Existing database rows without a CSV digest are marked `legacy_unverified`; the API will not serve them until a matching snapshot is replayed and the CSV is regenerated.

A retention period is configured, but scheduled deletion is not implemented in this demo; operators must not interpret the configured value as proof that deletion occurs. Payload and CSV digests detect content mismatches against the values in PostgreSQL. They do not provide non-repudiation, authenticity, or tamper resistance if an attacker can change both the content and its database digest.

