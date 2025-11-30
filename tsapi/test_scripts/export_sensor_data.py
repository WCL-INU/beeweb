"""
Trigger sensor data export and download the CSV.

Defaults (override with env vars):
  EXPORT_BASE=http://localhost:8090
  EXPORT_DEVICE_ID=1
  EXPORT_DATA_TYPES=2,3,4        # IN/OUT/TEMP defaults; adjust as needed
  EXPORT_S_TIME=<now-24h UTC>    # inclusive
  EXPORT_E_TIME=<now UTC>        # inclusive
  EXPORT_OUT=data_export.csv
  EXPORT_TIMEOUT=60              # seconds to wait for export

Requires:
  pip install requests
Run:
  python export_sensor_data.py
"""

import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List

import requests

# Request reference:
# POST {EXPORT_BASE}/exports/data
#   {
#     "deviceId": <number>,
#     "dataTypes": [<number>, ...],
#     "sTime": "YYYY-MM-DDTHH:MM:SSZ",
#     "eTime": "YYYY-MM-DDTHH:MM:SSZ"
#   }
# GET  {EXPORT_BASE}/exports/{exportId}/status
# GET  {EXPORT_BASE}/exports/{exportId}/download  (CSV stream)


def _parse_data_types(env_value: str | None, default: List[int]) -> List[int]:
    if not env_value:
        return default
    values: List[int] = []
    for part in env_value.split(","):
        try:
            n = int(part.strip())
            values.append(n)
        except ValueError:
            continue
    return values or default


def _default_time_range():
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=1)
    fmt = "%Y-%m-%dT%H:%M:%SZ"
    return start.strftime(fmt), end.strftime(fmt)


def create_export(base: str, device_id: int, data_types: List[int], s_time: str, e_time: str) -> str:
    payload = {
        "deviceId": device_id,
        "dataTypes": data_types,
        "sTime": s_time,
        "eTime": e_time,
    }
    resp = requests.post(f"{base}/exports/data", json=payload, timeout=5)
    resp.raise_for_status()
    data = resp.json()
    export_id = data.get("exportId")
    if not export_id:
        raise RuntimeError(f"exportId missing in response: {data}")
    print(f"Created export: {export_id}")
    return export_id


def poll_status(base: str, export_id: str, timeout_sec: int = 60, interval: float = 2.0) -> dict:
    deadline = time.time() + timeout_sec
    while True:
        resp = requests.get(f"{base}/exports/{export_id}/status", timeout=5)
        if resp.status_code == 404:
            raise RuntimeError("Export not found")
        resp.raise_for_status()
        data = resp.json()
        status = data.get("status")
        print(
            f"Status: {status}, progress={data.get('progress')}/{data.get('totalRows')}, fileSize={data.get('fileSize')}"
        )
        if status in ("ready", "failed", "expired"):
            return data
        if time.time() > deadline:
            raise TimeoutError("Timed out waiting for export to finish")
        time.sleep(interval)


def download_file(base: str, export_id: str, out_path: Path) -> None:
    with requests.get(f"{base}/exports/{export_id}/download", stream=True, timeout=10) as resp:
        if resp.status_code != 200:
            raise RuntimeError(f"Download failed: {resp.status_code} {resp.text}")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
    print(f"Saved CSV to {out_path.resolve()}")


def main():
    base = os.environ.get("EXPORT_BASE", "http://localhost:8090")
    device_id = int(os.environ.get("EXPORT_DEVICE_ID", "1"))
    data_types = _parse_data_types(os.environ.get("EXPORT_DATA_TYPES"), [2, 3, 4])

    s_time_env = os.environ.get("EXPORT_S_TIME")
    e_time_env = os.environ.get("EXPORT_E_TIME")
    if s_time_env and e_time_env:
        s_time, e_time = s_time_env, e_time_env
    else:
        s_time, e_time = _default_time_range()

    out_file = Path(os.environ.get("EXPORT_OUT", "data_export.csv"))
    timeout_sec = int(os.environ.get("EXPORT_TIMEOUT", "60"))

    print(
        f"Using base={base}, deviceId={device_id}, dataTypes={data_types}, "
        f"sTime={s_time}, eTime={e_time}, out={out_file}, timeout={timeout_sec}s"
    )

    export_id = create_export(base, device_id, data_types, s_time, e_time)
    status = poll_status(base, export_id, timeout_sec=timeout_sec)
    if status.get("status") != "ready":
        raise RuntimeError(f"Export did not complete: {status}")
    download_file(base, export_id, out_file)


if __name__ == "__main__":
    main()
