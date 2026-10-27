# Architecture and data flow

## Components

- **Linux agent:** Runs on the target host, outside the Compose stack. It collects only CPU summary, process names, logged-in user names, OS name/version, configured server ID, execution ID, UTC collection time, and agent version.
- **API:** FastAPI validates requests, authenticates the agent, binds its token to an authorized server ID, writes the snapshot and metadata to PostgreSQL, and writes a CSV export to MinIO.
- **Web reviewer:** A static page in a separate Nginx container. It sends a reviewer token to the API and displays snapshot metadata or downloads a CSV.
- **PostgreSQL:** Stores validated JSON snapshot content, timestamps, digest, and evidence object key.
- **MinIO:** S3-compatible local object storage for CSV evidence.

## Trust boundaries

The agent host and its token are outside the API trust boundary. TLS is required for a non-local deployment. The API is the only component that should access PostgreSQL and MinIO. Browser-side reviewer credentials are suitable only for this isolated demo because they are held by the browser; production should use an identity provider and short-lived authorization. Compose publishes only the API and web ports; database and object storage ports remain internal to the Compose network.

## Ingestion sequence

1. Agent creates a versioned payload and sends it with a bearer token.
2. API enforces a byte limit, validates the schema, and maps the token to one permitted server ID.
3. API canonicalizes the JSON and calculates a SHA-256 digest.
4. API inserts the unique `(server_id, execution_id)` record and writes a sanitized CSV object.
5. API records a minimal audit event and returns the execution ID and digest.

## Evidence and lifecycle

The database is the query source; the CSV is an export artifact. PostgreSQL and MinIO use named persistent volumes. A retention period is configured, but scheduled deletion is not implemented in this demo; operators must not interpret the configured value as proof that deletion occurs. The digest is useful for detecting accidental or unauthorized content changes when compared with a separately trusted digest. It does not provide non-repudiation, authenticity, or tamper resistance if an attacker can change the record and digest together.

