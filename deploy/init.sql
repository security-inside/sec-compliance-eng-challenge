CREATE TABLE IF NOT EXISTS snapshots (
    server_id VARCHAR(128) NOT NULL,
    execution_id UUID NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    sha256 CHAR(64) NOT NULL,
    object_key TEXT,
    csv_sha256 CHAR(64),
    evidence_status TEXT NOT NULL DEFAULT 'legacy_unverified',
    PRIMARY KEY (server_id, execution_id)
);

CREATE INDEX IF NOT EXISTS snapshots_server_collected_idx
    ON snapshots (server_id, collected_at DESC);

