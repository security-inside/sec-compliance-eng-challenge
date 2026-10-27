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

**Implemented:** Compose services for API, web, PostgreSQL, and MinIO; persistent volumes; example environment file; database health dependency; only web/API ports published to the host; MinIO image pinned by digest.

**Evidence:** `deploy/compose.yaml`, `.env.example`, root `README.md`.

## Phase 5 — Validation and audit walkthrough

**Goal:** Demonstrate expected and rejected paths, then explain evidence and limitations.

**Manual walkthrough checklist:**

1. [ ] Start the stack with rotated local secrets. The test stack used example-only local credentials.
2. [x] Submit a synthetic valid snapshot and confirm identifiers, timestamps, digest, persisted state, and CSV export.
3. [ ] Check wrong token, mismatched server ID, invalid field, oversized body, and duplicate execution ID. The duplicate-content conflict path was exercised; the other negative paths remain pending.
4. [ ] Query as a viewer, download the CSV, and try an invalid viewer token. Authorized query and download were exercised.
5. [ ] Restart the full stack and confirm database/object persistence. PostgreSQL and MinIO were restarted separately, and persistence was confirmed; a full-stack restart remains pending.
6. [x] Explain that SHA-256 detects a mismatch against the stored digest but is not a signature or protection from an attacker who can modify both data and digest.
7. [x] Document localhost HTTP, static demo tokens, retention, key rotation, TLS, backup recovery, monitoring, and production hardening limitations.

No automated test suite is included. Completed manual checks and their observed results are recorded above.

