# API contract

The API is intended for a local demonstration. It listens on port `8000`; Compose binds it to loopback. Interactive OpenAPI documentation is available at `http://localhost:8000/docs` while the stack is running.

## Agent ingestion

`POST /v1/snapshots` requires `Authorization: Bearer <agent-token>` and a JSON payload matching schema version 1. The server maps the token to one authorized server ID; the payload's `server_id` must match that mapping.

Required fields:

| Field | Type | Constraint |
| --- | --- | --- |
| `schema_version` | integer | Must be `1` |
| `server_id` | string | 1–128 alphanumeric, dot, underscore, or hyphen characters |
| `execution_id` | string | UUID |
| `collected_at` | timestamp | ISO 8601 with a timezone; the API normalizes it to UTC |
| `agent_version` | string | 1–32 characters |
| `cpu` | object | Architecture and logical/physical core counts |
| `processes` | string array | At most 2,000 names |
| `active_users` | string array | At most 500 names |
| `os_name`, `os_version` | strings | 1–128 characters |

Example local submission (use a shell variable populated securely in your shell session):

```sh
curl --fail-with-body -X POST http://localhost:8000/v1/snapshots \
  -H "Authorization: Bearer ${AGENT_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data-binary @snapshot.json
```

Success returns `201` and the server ID, execution ID, payload SHA-256 digest, and acceptance status. An identical replay returns `200` when evidence is already available; if the record is pending, failed, or from a legacy schema, an identical replay retries CSV generation and upload. Reusing an execution ID with different snapshot content returns `409`.

Common rejections are `401` invalid credentials, `403` server identity mismatch, `409` execution ID conflict, `413` body too large (enforced while streaming, including requests without a declared content length), `422` schema validation failure, and `503` when evidence is unavailable or its state cannot be confirmed. Validation responses contain field locations and error types, not submitted values. Audit events record rejection categories and roles without credentials or payload values.

## Reviewer endpoints

All reviewer endpoints require `Authorization: Bearer <viewer-token>`:

- `GET /v1/servers` returns distinct server identifiers mapped to configured agent tokens. It never returns agent credentials.
- `GET /v1/servers/{server_id}/snapshots` returns up to 100 recent records with timestamps, payload digest, evidence state, OS/version, CPU summary, agent version, process/user counts, and `csv_available`. It does not return process names or usernames.
- `GET /v1/servers/{server_id}/snapshots/{execution_id}/csv` returns the CSV export only after checking it against its stored CSV digest. It returns `503` if an export is pending, failed, or legacy/unverified, and `500` if the digest does not match.

The viewer token is shared in this demo and does not provide per-person identity or fine-grained roles.

