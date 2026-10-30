#!/usr/bin/env python3
"""Exercise local ingestion API success and rejection scenarios.

By default this sends synthetic inventory only. It reads simple configuration
values from the ignored .env file without executing it as shell code.
"""

from __future__ import annotations

import argparse
import copy
import csv
import datetime as dt
import ipaddress
import io
import json
import os
import sys
import uuid
from pathlib import Path
from urllib.parse import urlsplit

import requests

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_FIELDS = (
    "schema_version",
    "server_id",
    "execution_id",
    "collected_at",
    "agent_version",
    "cpu",
    "processes",
    "active_users",
    "os_name",
    "os_version",
)
DEFAULT_MAX_BYTES = 1_048_576


def local_api_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("API URL must be an absolute HTTP(S) URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("API URL must not contain credentials, query, or fragment")
    host = parsed.hostname.lower()
    try:
        loopback = ipaddress.ip_address(host).is_loopback
    except ValueError:
        loopback = host == "localhost"
    if not loopback:
        raise ValueError("Safety guard: this scenario runner only sends requests to loopback")
    return value.rstrip("/")


def configured_identity() -> tuple[str | None, str | None]:
    """Resolve the configured token/server pair from exported demo settings."""
    server_id = os.getenv("COMPLIANCE_SERVER_ID")
    token = os.getenv("COMPLIANCE_AGENT_TOKEN")
    mapping_text = os.getenv("AGENT_TOKENS")
    if mapping_text:
        try:
            mapping = json.loads(mapping_text)
            matches = [(secret, identity) for secret, identity in mapping.items()
                       if not server_id or identity == server_id]
            if token:
                mapped_identity = mapping.get(token)
                if mapped_identity and not server_id:
                    server_id = mapped_identity
            elif len(matches) == 1:
                token, server_id = matches[0]
        except (json.JSONDecodeError, AttributeError):
            raise ValueError("AGENT_TOKENS must be a JSON object mapping tokens to server IDs") from None
    return server_id, token


def load_env_file(path: Path) -> None:
    """Read simple KEY=value entries without shell-evaluating the secrets file."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key, value = key.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


def sample_snapshot(server_id: str) -> dict:
    """Return a synthetic, collector-shaped record without inspecting this host."""
    return {
        "schema_version": 1,
        "server_id": server_id,
        "execution_id": str(uuid.uuid4()),
        "collected_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "agent_version": "scenario-runner-1.0",
        "cpu": {"architecture": "x86_64", "logical_cores": 4, "physical_cores": 2},
        "processes": ["python", "sshd", "systemd"],
        "active_users": ["demo-user"],
        "os_name": "Debian GNU/Linux",
        "os_version": "12 (synthetic test data)",
    }


def encode_snapshot_csv(snapshot: dict) -> bytes:
    rows = [("field", "value")]
    for field, value in snapshot.items():
        rendered = json.dumps(value, ensure_ascii=False, separators=(",", ":")) if isinstance(value, (dict, list)) else str(value)
        rows.append((field, rendered))
    stream = io.StringIO(newline="")
    csv.writer(stream, quoting=csv.QUOTE_ALL, lineterminator="\n").writerows(rows)
    return stream.getvalue().encode("utf-8")


def host_snapshot(server_id: str) -> dict:
    """Opt-in path that invokes the actual collector and therefore reads host inventory."""
    agent_dir = str(ROOT / "agent")
    if agent_dir not in sys.path:
        sys.path.insert(0, agent_dir)
    try:
        from collector import collect
    except ImportError as exc:
        raise ValueError("Host collection needs agent/requirements.txt installed") from exc
    return collect(server_id)


class ScenarioRunner:
    def __init__(self, api_url: str, server_id: str, agent_token: str,
                 viewer_token: str | None, max_request_bytes: int,
                 use_host_data: bool, wire_format: str) -> None:
        self.endpoint = f"{api_url}/v1/snapshots"
        self.api_url = api_url
        self.server_id = server_id
        self.agent_token = agent_token
        self.viewer_token = viewer_token
        self.max_request_bytes = max_request_bytes
        self.use_host_data = use_host_data
        self.wire_format = wire_format
        self.session = requests.Session()
        self.session.trust_env = False
        self.created_snapshot: dict | None = None
        self.created_format: str | None = None
        self.failures = 0

    def check(self, name: str, expected: int, *, payload: dict | None = None,
              token: str | None = None, authorization: str | None = None,
              raw_body: bytes | None = None, content_type: str | None = "application/json",
              wire_format: str = "json") -> requests.Response | None:
        headers = {"Content-Type": content_type} if content_type else {}
        if authorization is not None:
            headers["Authorization"] = authorization
        elif token is not None:
            headers["Authorization"] = f"Bearer {token}"
        if raw_body is not None:
            body = raw_body
        elif wire_format == "csv":
            body = encode_snapshot_csv(payload)
        else:
            body = json.dumps(payload, separators=(",", ":")).encode()
        try:
            response = self.session.post(self.endpoint, data=body, headers=headers,
                                         timeout=(3.05, 15), allow_redirects=False)
        except requests.RequestException as exc:
            self.failures += 1
            print(f"FAIL {name}: request failed ({type(exc).__name__})")
            return None
        passed = response.status_code == expected
        if not passed:
            self.failures += 1
        print(f"{'PASS' if passed else 'FAIL'} {name}: expected HTTP {expected}, got {response.status_code}")
        return response

    def base(self) -> dict:
        return sample_snapshot(self.server_id)

    def complete(self, wire_format: str = "json") -> None:
        payload = host_snapshot(self.server_id) if self.use_host_data else self.base()
        self.created_snapshot = copy.deepcopy(payload)
        self.created_format = wire_format
        label = "complete payload + correct token (JSON)" if wire_format == "json" else "complete payload + correct token (CSV)"
        response = self.check(label, 201, payload=payload, token=self.agent_token, wire_format=wire_format,
                              content_type="application/json" if wire_format == "json" else "text/csv; charset=utf-8")
        if response and response.status_code == 201:
            print("     created execution ID:", payload["execution_id"])

    def run(self, name: str) -> None:
        if name == "complete":
            self.complete()
        elif name == "complete-csv":
            self.complete(wire_format="csv")
        elif name == "real-collector":
            payload = host_snapshot(self.server_id)
            self.created_snapshot = copy.deepcopy(payload)
            wire_format = self.wire_format
            self.created_format = wire_format
            content_type = "application/json" if wire_format == "json" else "text/csv; charset=utf-8"
            response = self.check(
                f"real local collector payload ({wire_format.upper()})", 201,
                payload=payload, token=self.agent_token, wire_format=wire_format,
                content_type=content_type,
            )
            if response and response.status_code == 201:
                print("     real host snapshot stored; execution ID:", payload["execution_id"])
                self.reviewer_query()
        elif name == "empty-inventory":
            payload = self.base(); payload["processes"] = []; payload["active_users"] = []
            self.check("empty process/user lists are valid", 201, payload=payload, token=self.agent_token)
        elif name == "maximum-lists":
            payload = self.base()
            payload["processes"] = [f"synthetic-process-{i}" for i in range(2000)]
            payload["active_users"] = [f"synthetic-user-{i}" for i in range(500)]
            self.check("maximum allowed list sizes", 201, payload=payload, token=self.agent_token)
        elif name in {"missing-auth", "malformed-auth", "wrong-token"}:
            payload = self.base()
            if name == "missing-auth":
                self.check("missing Authorization header", 401, payload=payload)
            elif name == "malformed-auth":
                self.check("non-Bearer Authorization scheme", 401, payload=payload,
                           authorization="Basic synthetic-not-a-secret")
            else:
                self.check("incorrect agent token", 401, payload=payload,
                           token="invalid-scenario-token")
        elif name == "wrong-server":
            payload = self.base(); payload["server_id"] = "unauthorized-synthetic-server"
            self.check("correct token bound to a different server ID", 403,
                       payload=payload, token=self.agent_token)
        elif name == "missing-fields":
            for field in REQUIRED_FIELDS:
                payload = self.base(); payload.pop(field)
                self.check(f"missing required field: {field}", 422,
                           payload=payload, token=self.agent_token)
        elif name == "extra-field":
            payload = self.base(); payload["unexpected"] = "synthetic"
            self.check("unexpected top-level field", 422, payload=payload, token=self.agent_token)
        elif name == "extra-cpu-field":
            payload = self.base(); payload["cpu"]["model_name"] = "synthetic"
            self.check("unexpected nested CPU field", 422, payload=payload, token=self.agent_token)
        elif name == "invalid-values":
            cases = [
                ("invalid server ID", lambda p: p.update(server_id="bad server id")),
                ("invalid execution UUID", lambda p: p.update(execution_id="not-a-uuid")),
                ("unsupported schema version", lambda p: p.update(schema_version=2)),
                ("timezone-naive timestamp", lambda p: p.update(collected_at="2026-01-01T12:00:00")),
                ("empty OS name", lambda p: p.update(os_name="")),
                ("overlong agent version", lambda p: p.update(agent_version="v" * 33)),
                ("CPU cores below minimum", lambda p: p["cpu"].update(logical_cores=-1)),
                ("CPU cores above maximum", lambda p: p["cpu"].update(physical_cores=4097)),
                ("wrong process-list type", lambda p: p.update(processes="not-an-array")),
            ]
            for label, mutate in cases:
                payload = self.base(); mutate(payload)
                self.check(label, 422, payload=payload, token=self.agent_token)
        elif name == "list-limits":
            for field, values, label in (
                ("processes", ["p"] * 2001, "process list exceeds 2,000"),
                ("active_users", ["u"] * 501, "active-user list exceeds 500"),
            ):
                payload = self.base(); payload[field] = values
                self.check(label, 422, payload=payload, token=self.agent_token)
        elif name == "malformed-json":
            self.check("malformed JSON body", 422, token=self.agent_token,
                       raw_body=b'{"schema_version":', content_type="application/json")
        elif name == "wrong-content-type":
            self.check("unsupported text/plain content type", 415,
                       payload=self.base(), token=self.agent_token, content_type="text/plain")
        elif name == "missing-content-type":
            self.check("missing Content-Type header", 415, payload=self.base(), token=self.agent_token,
                       content_type=None)
        elif name == "oversized-body":
            body = json.dumps({"padding": "x" * (self.max_request_bytes + 1024)}).encode()
            self.check("body exceeds streaming request-size cap", 413,
                       token=self.agent_token, raw_body=body)
        elif name == "replay":
            if not self.created_snapshot:
                self.complete()
            if self.created_snapshot:
                self.check("identical execution replay", 200,
                           payload=self.created_snapshot, token=self.agent_token)
        elif name == "execution-conflict":
            if not self.created_snapshot:
                self.complete()
            if self.created_snapshot:
                payload = copy.deepcopy(self.created_snapshot)
                payload["processes"] = payload["processes"] + ["changed-after-first-submit"]
                self.check("changed payload reusing execution ID", 409,
                           payload=payload, token=self.agent_token)
        elif name == "reviewer-query":
            self.reviewer_query()

    def reviewer_query(self) -> None:
        if not self.viewer_token:
            print("SKIP reviewer query: set VIEWER_TOKEN to include reviewer endpoint checks")
            return
        headers = {"Authorization": f"Bearer {self.viewer_token}"}
        try:
            response = self.session.get(f"{self.api_url}/v1/servers", headers=headers,
                                        timeout=(3.05, 15), allow_redirects=False)
            self._report_get("viewer can list configured servers", response, 200)
            response = self.session.get(
                f"{self.api_url}/v1/servers/{self.server_id}/snapshots",
                headers=headers, timeout=(3.05, 15), allow_redirects=False)
            self._report_get("viewer can query selected server snapshots", response, 200)
            if self.created_snapshot:
                try:
                    records = response.json()
                    matching = next((item for item in records
                                     if item.get("execution_id") == self.created_snapshot["execution_id"]), None)
                    formats_match = (
                        matching is not None
                        and matching.get("ingestion_format") == self.created_format
                        and matching.get("json_available") is True
                        and matching.get("csv_available") is True
                    )
                except (requests.exceptions.JSONDecodeError, AttributeError):
                    formats_match = False
                self._report_get("UI metadata exposes input format and both verified views", response, 200,
                                 body_check=formats_match)
                json_url = (f"{self.api_url}/v1/servers/{self.server_id}/snapshots/"
                            f"{self.created_snapshot['execution_id']}/json")
                response = self.session.get(json_url, headers=headers,
                                            timeout=(3.05, 15), allow_redirects=False)
                try:
                    formatted = response.text == json.dumps(response.json(), indent=2, ensure_ascii=False)
                except requests.exceptions.JSONDecodeError:
                    formatted = False
                self._report_get("viewer can read integrity-checked formatted JSON", response, 200,
                                 body_check=formatted)
                csv_url = (f"{self.api_url}/v1/servers/{self.server_id}/snapshots/"
                           f"{self.created_snapshot['execution_id']}/csv")
                response = self.session.get(csv_url, headers=headers,
                                            timeout=(3.05, 15), allow_redirects=False)
                expected_name = (f"{self.server_id}_"
                                 f"{self.created_snapshot['collected_at'][:10]}_"
                                 f"{self.created_snapshot['execution_id']}.csv")
                actual_header = response.headers.get("Content-Disposition", "")
                passed = response.status_code == 200 and expected_name in actual_header
                if not passed:
                    self.failures += 1
                print(f"{'PASS' if passed else 'FAIL'} verified CSV download filename: "
                      f"expected {expected_name}, got HTTP {response.status_code}")
        except requests.RequestException as exc:
            self.failures += 1
            print(f"FAIL reviewer query: request failed ({type(exc).__name__})")

    def _report_get(self, name: str, response: requests.Response, expected: int,
                    body_check: bool = True) -> None:
        passed = response.status_code == expected and body_check
        if not passed:
            self.failures += 1
        print(f"{'PASS' if passed else 'FAIL'} {name}: expected HTTP {expected}, got {response.status_code}")


SCENARIOS = (
    "complete", "complete-csv", "real-collector", "empty-inventory", "maximum-lists", "missing-auth", "malformed-auth",
    "wrong-token", "wrong-server", "missing-fields", "extra-field", "extra-cpu-field",
    "invalid-values", "list-limits", "malformed-json", "wrong-content-type", "missing-content-type",
    "oversized-body", "replay", "execution-conflict", "reviewer-query",
)
def main() -> int:
    load_env_file(Path(os.getenv("COMPLIANCE_ENV_FILE", ROOT / ".env")))
    default_server, default_token = configured_identity()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default=os.getenv("COMPLIANCE_API_URL", "http://localhost:8000"))
    parser.add_argument("--server-id", default=default_server or os.getenv("COMPLIANCE_SERVER_ID"))
    parser.add_argument("--scenario", choices=("all", *SCENARIOS), default="all")
    parser.add_argument("--format", choices=("json", "csv"), default="json",
                        help="Wire format for the real-collector scenario (default: json)")
    parser.add_argument("--max-request-bytes", type=int,
                        default=int(os.getenv("MAX_REQUEST_BYTES", DEFAULT_MAX_BYTES)))
    parser.add_argument("--use-host-data", action="store_true",
                        help="Opt in to collecting actual local process/session data for valid records")
    args = parser.parse_args()
    if not args.server_id:
        parser.error("set COMPLIANCE_SERVER_ID or AGENT_TOKENS, or pass --server-id")
    token = default_token or os.getenv("COMPLIANCE_AGENT_TOKEN")
    if not token:
        parser.error("set COMPLIANCE_AGENT_TOKEN or export AGENT_TOKENS from the local demo configuration")
    if args.max_request_bytes < 1:
        parser.error("--max-request-bytes must be positive")
    try:
        api_url = local_api_url(args.api_url)
        runner = ScenarioRunner(api_url, args.server_id, token,
                                os.getenv("VIEWER_TOKEN"), args.max_request_bytes,
                                args.use_host_data, args.format)
        scenarios = SCENARIOS if args.scenario == "all" else (args.scenario,)
        real_mode = args.use_host_data or args.scenario == "real-collector"
        print(f"Target: {api_url} | server: {args.server_id} | mode: "
              f"{'real host inventory (explicit opt-in)' if real_mode else 'synthetic data'}")
        print("Successful scenarios persist records in the local demo database.")
        for scenario in scenarios:
            runner.run(scenario)
        print(f"\nFinished: {runner.failures} failed scenario check(s).")
        return 1 if runner.failures else 0
    except (ValueError, requests.RequestException) as exc:
        print(f"Cannot run scenarios: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
