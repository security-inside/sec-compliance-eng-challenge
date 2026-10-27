#!/usr/bin/env python3
"""Collect a minimized Linux inventory snapshot and submit it to the API."""

from __future__ import annotations

import argparse
import datetime as dt
import ipaddress
import os
import platform
import stat
import sys
import uuid
from urllib.parse import urlsplit

import psutil
import requests

AGENT_VERSION = "0.1.0"


def validate_api_url(value: str) -> str:
    """Require TLS remotely; permit cleartext only to a literal loopback target."""
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("API URL must use HTTP(S) and include a host")
    if parsed.username or parsed.password or parsed.fragment:
        raise ValueError("API URL must not contain credentials or a fragment")
    if parsed.scheme == "http":
        host = parsed.hostname.lower()
        try:
            is_loopback = ipaddress.ip_address(host).is_loopback
        except ValueError:
            is_loopback = host == "localhost"
        if not is_loopback:
            raise ValueError("remote API URLs must use HTTPS")
    return value.rstrip("/")


def collect(server_id: str) -> dict:
    """Build a bounded snapshot; intentionally omit process arguments and env vars."""
    processes = []
    for proc in psutil.process_iter(attrs=["name"]):
        try:
            name = proc.info.get("name")
            if name:
                processes.append(name[:256])
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
    processes = sorted(set(processes))[:2000]

    sessions = sorted({(entry.name or "")[:128] for entry in psutil.users() if entry.name})[:500]
    cpu = {
        "architecture": platform.machine()[:64],
        "logical_cores": psutil.cpu_count(logical=True) or 0,
        "physical_cores": psutil.cpu_count(logical=False) or 0,
    }
    return {
        "schema_version": 1,
        "server_id": server_id,
        "execution_id": str(uuid.uuid4()),
        "collected_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "agent_version": AGENT_VERSION,
        "cpu": cpu,
        "processes": processes,
        "active_users": sessions,
        "os_name": platform.system()[:128],
        "os_version": platform.release()[:128],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default=os.environ.get("COMPLIANCE_API_URL"), required=not os.environ.get("COMPLIANCE_API_URL"))
    parser.add_argument("--server-id", default=os.environ.get("COMPLIANCE_SERVER_ID"), required=not os.environ.get("COMPLIANCE_SERVER_ID"))
    parser.add_argument("--token-file", help="Read token from a local file with restrictive permissions")
    args = parser.parse_args()

    token = os.environ.get("COMPLIANCE_AGENT_TOKEN")
    if args.token_file:
        token_path = os.path.abspath(args.token_file)
        file_mode = stat.S_IMODE(os.stat(token_path).st_mode)
        if file_mode & 0o077:
            parser.error("token file must not be accessible by group or other users (chmod 600)")
        with open(token_path, encoding="utf-8") as token_stream:
            token = token_stream.read().strip()
    if not token:
        parser.error("provide COMPLIANCE_AGENT_TOKEN or --token-file")

    try:
        api_url = validate_api_url(args.api_url)
    except ValueError as exc:
        parser.error(str(exc))

    url = api_url + "/v1/snapshots"
    try:
        response = requests.post(
            url,
            json=collect(args.server_id),
            headers={"Authorization": f"Bearer {token}"},
            timeout=(3.05, 15),
            allow_redirects=False,
        )
        if response.status_code >= 400:
            print(f"Submission rejected (HTTP {response.status_code}).", file=sys.stderr)
            return 1
        print(response.json())
        return 0
    except requests.RequestException as exc:
        # Exception text may include request details; report only the exception class.
        print(f"Submission failed ({type(exc).__name__}).", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

