# Development phases

The phases keep the two-day exercise focused on a demonstrable vertical slice. Each phase records its purpose and completion evidence; completion here means implementation is present, not independently audited.

## Phase 1 — Architecture and scope

**Goal:** Define components, trust boundaries, collected fields, identities, and data lifecycle.

**In scope:** Linux inventory snapshot; one credential per agent; server identity bound to that credential; reviewer token; PostgreSQL metadata and snapshot; MinIO CSV evidence; local Docker Compose.

**Out of scope:** Payment account data, cloud deployment, enterprise identity, multi-tenant production service, compliance certification, AI processing.

**Evidence:** `docs/architecture.md`, `docs/security.md`, `docs/compliance-mapping.md`.

## Phase 2 — Secure ingestion

**Goal:** Collect a defined, minimized snapshot and accept only authenticated, bounded, schema-valid requests.

**Implemented:** Python collector; per-agent bearer token mapped server-side to an authorized server identifier; token file permission check; streaming request-size bound; timezone-aware timestamps normalized to UTC; Pydantic schema validation with value-free error responses; duplicate execution protection; structured audit events for authentication and ingestion rejections.

**Evidence:** `agent/collector.py`, `api/main.py`.

## Phase 3 — Query and evidence export

**Goal:** Persist traceable snapshots and allow a reviewer to retrieve evidence under a separate credential.

**Implemented:** PostgreSQL records with UTC timestamps, payload and CSV SHA-256 digests, and an evidence lifecycle state; deterministic CSV objects in MinIO; exact replay support for retrying pending/failed/legacy exports while rejecting conflicting content under a reused execution ID; download-time CSV digest verification; viewer-authenticated query and export; spreadsheet formula-prefix neutralization; idempotent metadata migration for existing database volumes.

**Evidence:** `api/main.py`, `deploy/init.sql`, `web/`, `docs/api.md`, `docs/architecture.md`.

**Verification status:** Manually exercised with local Docker and synthetic records. Ingestion returned `201`; identical replay returned `200`; changed content under the same execution ID returned `409`; a valid CSV download returned `200`; a tampered CSV returned `500`; a MinIO outage persisted `failed` and returned `503`; replay after MinIO recovery restored `available`; an old-schema simulation migrated a record to `legacy_unverified` and replay regenerated its export. PostgreSQL and MinIO container restarts preserved database rows and CSV objects. The full acceptance walkthrough remains pending.

## Phase 4 — Containerized local deployment

**Goal:** Provide a repeatable local stack while keeping the collector separate.

**Implemented:** Compose services for API, web, PostgreSQL, and MinIO; persistent volumes; example environment file; database/API/web health checks; API startup waits for a healthy database and web waits for a healthy API; only web/API ports published to the host; all runtime images pinned by digest; API and web use read-only roots, dropped capabilities, and no-new-privileges; Nginx runs non-root with a tmpfs for transient files and security headers/CSP.

**Evidence:** `deploy/compose.yaml`, `deploy/nginx.conf`, `api/Dockerfile`, `.env.example`, root `README.md`.

**Verification status:** Compose build and startup passed. PostgreSQL, API, and web health checks passed; web page, JavaScript, and CSS returned `200`; API health and CORS preflight passed; web responses included CSP, `nosniff`, frame, and referrer headers. Database and storage ports remain unpublished.

## Phase 5 — Validation and audit walkthrough

**Goal:** Demonstrate expected and rejected paths, then explain evidence and limitations.

**Manual walkthrough checklist:**

1. [x] Rotate local PostgreSQL, MinIO, agent, and viewer demo credentials, then restart affected services. The rotated `.env` is ignored by Git; previous local credentials were held in a mode-0600 file under `/private/tmp` only to support rollback.
2. [x] Submit a synthetic valid snapshot and confirm identifiers, timestamps, digest, persisted state, and CSV export.
3. [x] Check wrong token, mismatched server ID, invalid field, oversized body, and duplicate execution ID. Observed `401`, `403`, `422`, `413`, `200` for identical replay, and `409` for changed content reusing the execution ID.
4. [x] Query as a viewer, download the CSV, and try an invalid viewer token. Observed `200` for authorized query/download and `401` for an invalid viewer token.
5. [x] Restart the full Compose stack without deleting volumes. All four available synthetic records remained queryable and their CSVs remained downloadable.
6. [x] Explain that SHA-256 detects a mismatch against the stored digest but is not a signature or protection from an attacker who can modify both data and digest.
7. [x] Document localhost HTTP, static demo tokens, retention, key rotation, TLS, backup recovery, monitoring, production hardening, agent integrity limits, and the framework-specific follow-up register.
8. [x] Run the standalone collector against the local API using a mode-0600 token file; confirm non-loopback HTTP is rejected by the agent URL policy.
9. [x] Perform the interactive browser walkthrough with Chrome: enter the rotated viewer credential, query `demo-linux-01`, render four results, and download/inspect a CSV.

No automated test suite is included. The Iteration 5 checks above were manually scripted for this walkthrough and were not added as a permanent test suite.

