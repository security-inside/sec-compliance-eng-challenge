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

**Verification status:** Implementation is present; PostgreSQL/MinIO runtime and failure-path walkthrough are pending local Docker availability.

## Phase 4 — Containerized local deployment

**Goal:** Provide a repeatable local stack while keeping the collector separate.

**Implemented:** Compose services for API, web, PostgreSQL, and MinIO; persistent volumes; example environment file; database health dependency; only web/API ports published to the host.

**Evidence:** `deploy/compose.yaml`, `.env.example`, root `README.md`.

## Phase 5 — Validation and audit walkthrough

**Goal:** Demonstrate expected and rejected paths, then explain evidence and limitations.

**Manual walkthrough checklist:**

1. Start the stack with rotated local secrets.
2. Submit one valid snapshot and confirm its server identity, execution ID, timestamp, digest, and CSV object reference.
3. Submit with a wrong token, mismatched server ID, invalid field, oversized body, and duplicate execution ID; confirm each is rejected without secrets in logs.
4. Query as a viewer and download the CSV; try an invalid viewer token.
5. Restart the stack and confirm database/object persistence.
6. Explain that SHA-256 detects a mismatch against a trusted digest but is not a signature or protection from an attacker who can modify both data and digest.
7. Explain localhost HTTP, static demo tokens, retention enforcement, key rotation, TLS, backup recovery, monitoring, and production hardening as limitations or follow-up work.

No automated test suite or execution evidence is claimed by this document.

