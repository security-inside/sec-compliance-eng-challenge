# API contract

The API is intended for a local demonstration. It listens on port `8000`; Compose binds it to loopback. Interactive OpenAPI documentation is available at `http://localhost:8000/docs` while the stack is running.

## Agent ingestion

`POST /v1/snapshots` requires `Authorization: Bearer <agent-token>` and accepts schema version 1 as either `application/json` or `text/csv`. JSON is the collector default. The server maps the token to one authorized server ID; the payload's `server_id` must match that mapping. Both formats are parsed into the same validated snapshot and canonical JSON record before persistence.
The API records the original `ingestion_format` (`json` or `csv`) separately from the normalized JSON payload and generated CSV export.

CSV uses a UTF-8 two-column `field,value` layout, with one row per snapshot field. `cpu`, `processes`, and `active_users` values contain JSON-encoded objects/arrays; scalar values are plain text. Duplicate fields, malformed CSV, unknown fields, and incomplete records are rejected.

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

The installed collector sends JSON by default. Select CSV for a request with `--format csv` (or set `COMPLIANCE_FORMAT=csv`):

```sh
python agent/collector.py --api-url http://localhost:8000 --server-id demo-linux-01 \
  --token-file agent-token.txt --format csv
```

Success returns `201` and the server ID, execution ID, payload SHA-256 digest, and acceptance status. An identical replay returns `200` when evidence is already available; if the record is pending, failed, or from a legacy schema, an identical replay retries CSV generation and upload. Because both wire formats normalize to canonical JSON, the same snapshot can be safely replayed in the other format. Reusing an execution ID with different snapshot content returns `409`.

Common rejections are `401` invalid credentials, `403` server identity mismatch, `409` execution ID conflict, `413` body too large (enforced while streaming, including requests without a declared content length), `415` unsupported or missing content type, `422` schema/body validation failure, and `503` when evidence is unavailable or its state cannot be confirmed. Validation responses contain field locations and error types, not submitted values. Audit events record rejection categories and roles without credentials or payload values.

## Reviewer endpoints

All reviewer endpoints require `Authorization: Bearer <viewer-token>`:

- `GET /v1/servers` returns distinct server identifiers mapped to configured agent tokens. It never returns agent credentials.
- `GET /v1/servers/{server_id}/snapshots` returns up to 100 recent records with timestamps, payload digest, evidence state, original `ingestion_format`, `json_available`, `csv_available`, OS/version, CPU summary, agent version, and process/user counts. It does not return process names or usernames. The UI enables each preview based on artifact availability; CSV also requires an available verified export.
- `GET /v1/servers/{server_id}/snapshots/{execution_id}/csv` returns the CSV export only after checking it against its stored CSV digest. Its download filename is `<server_identifier>_<YYYY-MM-DD>_<execution_id>.csv`, using the server ID and collection date. It returns `503` if an export is pending, failed, or legacy/unverified, and `500` if the digest does not match.
- `GET /v1/servers/{server_id}/snapshots/{execution_id}/json` returns the stored JSON snapshot after recomputing and checking its canonical SHA-256 digest. A mismatch is withheld with `500`; the response uses `Cache-Control: no-store`.

The viewer token is shared in this demo and does not provide per-person identity or fine-grained roles.
The JSON view returns the full stored snapshot, including process and logged-in user names. Restrict viewer-token access accordingly.

