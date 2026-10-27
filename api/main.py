"""Authenticated collection and review API for the local compliance demo."""

from __future__ import annotations

import csv
import hashlib
import hmac
import io
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Annotated

import boto3
import psycopg
from botocore.client import Config
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from psycopg.rows import dict_row

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(message)s")
log = logging.getLogger("evidence_api")

DATABASE_URL = os.environ["DATABASE_URL"]
AGENT_TOKENS: dict[str, str] = json.loads(os.environ["AGENT_TOKENS"])
VIEWER_TOKEN = os.environ["VIEWER_TOKEN"]
MAX_REQUEST_BYTES = int(os.getenv("MAX_REQUEST_BYTES", "1048576"))
S3_BUCKET = os.getenv("S3_BUCKET", "compliance-evidence")

s3 = boto3.client(
    "s3",
    endpoint_url=os.getenv("S3_ENDPOINT_URL", "http://storage:9000"),
    aws_access_key_id=os.environ["S3_ACCESS_KEY"],
    aws_secret_access_key=os.environ["S3_SECRET_KEY"],
    config=Config(signature_version="s3v4"),
    region_name="us-east-1",
)
app = FastAPI(title="Server Compliance Evidence API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:8080").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


class CpuInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")
    architecture: str = Field(min_length=1, max_length=64)
    logical_cores: int = Field(ge=0, le=4096)
    physical_cores: int = Field(ge=0, le=4096)


class Snapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: int = Field(ge=1, le=1)
    server_id: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
    execution_id: str = Field(pattern=r"^[A-Fa-f0-9-]{36}$")
    collected_at: datetime
    agent_version: str = Field(min_length=1, max_length=32)
    cpu: CpuInfo
    processes: list[str] = Field(max_length=2000)
    active_users: list[str] = Field(max_length=500)
    os_name: str = Field(min_length=1, max_length=128)
    os_version: str = Field(min_length=1, max_length=128)


def audit(event: str, **fields: str | int) -> None:
    safe = {"event": event, "at": datetime.now(timezone.utc).isoformat(), **fields}
    log.info(json.dumps(safe, separators=(",", ":"), sort_keys=True))


def bearer_token(value: str | None) -> str | None:
    if not value or not value.startswith("Bearer "):
        return None
    return value[7:].strip()


def agent_server(authorization: Annotated[str | None, Header()] = None) -> str:
    token = bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    for expected, server_id in AGENT_TOKENS.items():
        if hmac.compare_digest(token, expected):
            return server_id
    raise HTTPException(status_code=401, detail="Invalid credentials")


def require_viewer(authorization: Annotated[str | None, Header()] = None) -> None:
    token = bearer_token(authorization)
    if not token or not hmac.compare_digest(token, VIEWER_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid credentials")


def ensure_bucket() -> None:
    last_error: Exception | None = None
    for attempt in range(10):
        try:
            s3.head_bucket(Bucket=S3_BUCKET)
            return
        except Exception as exc:
            last_error = exc
            try:
                s3.create_bucket(Bucket=S3_BUCKET)
                return
            except Exception as create_exc:
                last_error = create_exc
                time.sleep(min(2 ** attempt, 10))
    # Avoid returning SDK details that can include endpoint or credential context.
    log.error("Object storage initialization failed (%s)", type(last_error).__name__)
    raise RuntimeError("Object storage is not available") from None


@app.on_event("startup")
def startup() -> None:
    ensure_bucket()


@app.middleware("http")
async def enforce_body_limit(request: Request, call_next):
    length = request.headers.get("content-length")
    if length:
        try:
            if int(length) > MAX_REQUEST_BYTES:
                return Response(status_code=413, content="Request too large")
        except ValueError:
            return Response(status_code=400, content="Invalid content length")
    if request.url.path == "/v1/snapshots" and request.method == "POST":
        body = await request.body()
        if len(body) > MAX_REQUEST_BYTES:
            return Response(status_code=413, content="Request too large")
    return await call_next(request)


def canonical_json(snapshot: Snapshot) -> bytes:
    data = snapshot.model_dump(mode="json")
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def csv_safe(value: str) -> str:
    # Prevent spreadsheet formula evaluation while preserving a readable export.
    if value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


def make_csv(snapshot: Snapshot) -> bytes:
    data = snapshot.model_dump(mode="json")
    rows = [
        ("field", "value"),
        ("schema_version", str(data["schema_version"])),
        ("server_id", data["server_id"]),
        ("execution_id", data["execution_id"]),
        ("collected_at", data["collected_at"]),
        ("agent_version", data["agent_version"]),
        ("cpu", json.dumps(data["cpu"], sort_keys=True)),
        ("processes", json.dumps(data["processes"], ensure_ascii=False)),
        ("active_users", json.dumps(data["active_users"], ensure_ascii=False)),
        ("os_name", data["os_name"]),
        ("os_version", data["os_version"]),
    ]
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, quoting=csv.QUOTE_ALL, lineterminator="\n")
    writer.writerows((csv_safe(str(k)), csv_safe(str(v))) for k, v in rows)
    return stream.getvalue().encode("utf-8")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/snapshots", status_code=201)
def ingest(snapshot: Snapshot, authorized_server: str = Depends(agent_server)) -> dict[str, str]:
    if snapshot.server_id != authorized_server:
        audit("ingestion_rejected", reason="server_identity_mismatch", server_id=authorized_server)
        raise HTTPException(status_code=403, detail="Credential is not authorized for this server")

    payload = canonical_json(snapshot)
    digest = hashlib.sha256(payload).hexdigest()
    execution = snapshot.execution_id
    safe_server = re.sub(r"[^A-Za-z0-9._-]", "_", snapshot.server_id)
    object_key = f"{safe_server}/{snapshot.collected_at.date().isoformat()}/{execution}.csv"
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        try:
            conn.execute(
                "INSERT INTO snapshots (server_id, execution_id, collected_at, received_at, payload, sha256, object_key) "
                "VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s)",
                (snapshot.server_id, execution, snapshot.collected_at, datetime.now(timezone.utc), payload.decode(), digest, object_key),
            )
        except psycopg.errors.UniqueViolation:
            audit("ingestion_rejected", reason="duplicate_execution", server_id=authorized_server, execution_id=execution)
            raise HTTPException(status_code=409, detail="Execution already received") from None
        conn.commit()

    try:
        s3.put_object(Bucket=S3_BUCKET, Key=object_key, Body=make_csv(snapshot), ContentType="text/csv; charset=utf-8")
    except Exception:
        # The DB row remains traceable and explicitly indicates a missing export.
        with psycopg.connect(DATABASE_URL) as conn:
            conn.execute("UPDATE snapshots SET object_key = NULL WHERE server_id = %s AND execution_id = %s", (snapshot.server_id, execution))
            conn.commit()
        audit("evidence_export_failed", server_id=authorized_server, execution_id=execution)
        raise HTTPException(status_code=503, detail="Snapshot stored but evidence export failed") from None

    audit("snapshot_received", server_id=authorized_server, execution_id=execution, sha256=digest)
    return {"server_id": snapshot.server_id, "execution_id": execution, "sha256": digest, "status": "accepted"}


@app.get("/v1/servers/{server_id}/snapshots", dependencies=[Depends(require_viewer)])
def list_snapshots(server_id: str) -> list[dict]:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        rows = conn.execute(
            "SELECT server_id, execution_id, collected_at, received_at, sha256, (object_key IS NOT NULL) AS csv_available "
            "FROM snapshots WHERE server_id = %s ORDER BY collected_at DESC LIMIT 100",
            (server_id,),
        ).fetchall()
    audit("snapshot_query", server_id=server_id, result_count=len(rows))
    return rows


@app.get("/v1/servers/{server_id}/snapshots/{execution_id}/csv", dependencies=[Depends(require_viewer)])
def download_csv(server_id: str, execution_id: str) -> Response:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        row = conn.execute(
            "SELECT object_key FROM snapshots WHERE server_id = %s AND execution_id = %s",
            (server_id, execution_id),
        ).fetchone()
    if not row or not row["object_key"]:
        raise HTTPException(status_code=404, detail="Evidence not found")
    result = s3.get_object(Bucket=S3_BUCKET, Key=row["object_key"])
    audit("evidence_downloaded", server_id=server_id, execution_id=execution_id)
    return Response(
        content=result["Body"].read(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{execution_id}.csv"', "X-Content-Type-Options": "nosniff"},
    )

