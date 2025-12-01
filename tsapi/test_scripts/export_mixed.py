"""
혼합(mixed) 익스포트를 생성하고 ZIP을 다운로드합니다.

기본값(환경변수로 재정의 가능):
  EXPORT_BASE=http://localhost:8090          # API 서버 베이스 URL
  EXPORT_DEVICE_IDS=1,2,3,4                   # 대상 디바이스 ID(콤마 구분)
  EXPORT_DATA_TYPES=1,2,3,4,5,6,7             # 1=PICTURE, 2~7=sensor (포함 여부로 사진/센서 선택)
  EXPORT_S_TIME=<now-24h UTC>                 # 시작 시각(UTC, ISO, Z)
  EXPORT_E_TIME=<now UTC>                     # 종료 시각(UTC, ISO, Z)
  EXPORT_OUT=mixed_export.zip                 # 결과 ZIP 파일 경로
  EXPORT_TIMEOUT=90                           # 완료 대기 시간(초)

요구 사항:
  pip install requests

실행:
  python export_mixed.py
"""

import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import requests


def _parse_int_list(env_value: Optional[str], default: List[int]) -> List[int]:
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


def create_export(base: str, device_ids: List[int], data_types: List[int], s_time: str, e_time: str) -> str:
    payload = {
        "deviceIds": device_ids,
        "dataTypes": data_types,
        "sTime": s_time,
        "eTime": e_time,
    }
    resp = requests.post(f"{base}/exports/mixed", json=payload, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    export_id = data.get("exportId")
    if not export_id:
        raise RuntimeError(f"exportId missing in response: {data}")
    print(f"[create] exportId={export_id}")
    return export_id


def poll_status(base: str, export_id: str, timeout_sec: int = 90, interval: float = 2.0) -> dict:
    deadline = time.time() + timeout_sec
    while True:
        resp = requests.get(f"{base}/exports/{export_id}/status", timeout=10)
        if resp.status_code == 404:
            raise RuntimeError("Export not found")
        resp.raise_for_status()
        data = resp.json()
        status = data.get("status")
        progress = data.get("progress")
        total_rows = data.get("totalRows")
        file_size = data.get("fileSize")
        print(f"[status] {status} progress={progress}/{total_rows} size={file_size}")
        if status in ("ready", "failed", "expired"):
            return data
        if time.time() > deadline:
            raise TimeoutError("Timed out waiting for export to finish")
        time.sleep(interval)


def download_file(base: str, export_id: str, out_path: Path) -> None:
    with requests.get(f"{base}/exports/{export_id}/download", stream=True, timeout=15) as resp:
        if resp.status_code != 200:
            raise RuntimeError(f"Download failed: {resp.status_code} {resp.text}")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
    print(f"[download] saved to {out_path.resolve()}")


def main():
    base = os.environ.get("EXPORT_BASE", "http://localhost:8090")
    device_ids_env = os.environ.get("EXPORT_DEVICE_IDS") or os.environ.get("EXPORT_DEVICE_ID", "1,2,3,4")
    data_types_env = os.environ.get("EXPORT_DATA_TYPES", "1,2,3,4,5,6,7")

    device_ids: List[int] = _parse_int_list(device_ids_env, [])
    if not device_ids:
        raise RuntimeError("No valid device IDs provided")

    data_types = _parse_int_list(data_types_env, [1, 2, 3, 4, 5, 6, 7])

    s_time_env = os.environ.get("EXPORT_S_TIME")
    e_time_env = os.environ.get("EXPORT_E_TIME")
    if s_time_env and e_time_env:
        s_time, e_time = s_time_env, e_time_env
    else:
        s_time, e_time = _default_time_range()

    out_file = Path(os.environ.get("EXPORT_OUT", "mixed_export.zip"))
    timeout_sec = int(os.environ.get("EXPORT_TIMEOUT", "90"))

    print(
        f"base={base}, deviceIds={device_ids}, dataTypes={data_types}, "
        f"sTime={s_time}, eTime={e_time}, out={out_file}, timeout={timeout_sec}s"
    )

    export_id = create_export(base, device_ids, data_types, s_time, e_time)
    status = poll_status(base, export_id, timeout_sec=timeout_sec)
    if status.get("status") != "ready":
        raise RuntimeError(f"Export did not complete: {status}")
    download_file(base, export_id, out_file)


if __name__ == "__main__":
    main()
