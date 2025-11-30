"""
Create sample area/hive/device and upload sensor data via API.

Defaults (override with env vars):
  BASE_URL=http://localhost:8090
  AREA_NAME=Sample Area
  AREA_LOC=37.123, 126.456
  HIVE_NAME=Sample Hive
  DEVICE_NAME=Sample Device
  DEVICE_TYPE_ID=2   # 1=CAMERA, 2=SENSOR, 3=INOUT (seeded in initialize)
  ROWS=5             # number of readings to upload

This script requires: pip install requests
Run: python add_device_and_data.py
"""

import datetime as dt
import os
from typing import Any, Dict

import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8090")
# Request reference:
# POST {BASE_URL}/area   body: {"name": <string>, "location": <string>}
# POST {BASE_URL}/hive   body: {"name": <string>, "areaId": <number>}
# POST {BASE_URL}/device body: {"name": <string>, "hiveId": <number>, "typeId": <number>}
# POST {BASE_URL}/data/upload body:
#   { "data": [ { "device_id": <number>, "time": "YYYY-MM-DDTHH:MM:SSZ", "values": {"temp": 25.5, "humi": 60, ...} } ] }


def post_json(path: str, payload: Dict[str, Any]) -> requests.Response:
    url = f"{BASE_URL}{path}"
    resp = requests.post(url, json=payload, timeout=5)
    try:
        body = resp.json()
    except Exception:
        body = resp.text
    print(f"[POST] {url} -> {resp.status_code} {body}")
    return resp


def create_area(name: str, location: str) -> int:
    resp = post_json("/area", {"name": name, "location": location})
    if resp.status_code in (200, 201, 409):
        data = resp.json()
        area_id = data.get("areaId") or data.get("area_id") or data.get("id")
        if not area_id:
            raise RuntimeError(f"Area response missing id: {data}")
        return int(area_id)
    raise RuntimeError(f"Failed to create area: {resp.text}")


def create_hive(name: str, area_id: int) -> int:
    resp = post_json("/hive", {"name": name, "areaId": area_id})
    if resp.status_code in (200, 201, 409):
        data = resp.json()
        hive_id = data.get("hiveId") or data.get("hive_id") or data.get("id")
        if not hive_id:
            raise RuntimeError(f"Hive response missing id: {data}")
        return int(hive_id)
    raise RuntimeError(f"Failed to create hive: {resp.text}")


def create_device(name: str, hive_id: int, type_id: int) -> int:
    resp = post_json("/device", {"name": name, "hiveId": hive_id, "typeId": type_id})
    if resp.status_code in (200, 201):
        data = resp.json()
        device_id = data.get("deviceId") or data.get("device_id") or data.get("id")
        if not device_id:
            raise RuntimeError(f"Device response missing id: {data}")
        return int(device_id)
    raise RuntimeError(f"Failed to create device: {resp.text}")


def upload_sensor_data(device_id: int, rows: int) -> None:
    now = dt.datetime.utcnow()
    payload_rows = []
    for i in range(rows):
        ts = (now - dt.timedelta(minutes=i * 5)).isoformat(timespec="seconds") + "Z"
        payload_rows.append(
            {
                "device_id": device_id,
                "time": ts,
                "values": {
                    "temp": 20 + i * 0.5,
                    "humi": 55 + i,
                    "co2": 420 + i * 3,
                    "weigh": 10.5 + i * 0.1,
                    "in_field": 5 + i,
                    "out_field": 2 + i,
                },
            }
        )
    resp = post_json("/data/upload", {"data": payload_rows})
    resp.raise_for_status()


def main():
    area_name = os.environ.get("AREA_NAME", "Sample Area")
    area_loc = os.environ.get("AREA_LOC", "37.123, 126.456")
    hive_name = os.environ.get("HIVE_NAME", "Sample Hive")
    device_name = os.environ.get("DEVICE_NAME", "Sample Device")
    device_type_id = int(os.environ.get("DEVICE_TYPE_ID", "2"))
    rows = int(os.environ.get("ROWS", "5"))

    area_id = create_area(area_name, area_loc)
    hive_id = create_hive(hive_name, area_id)
    device_id = create_device(device_name, hive_id, device_type_id)
    upload_sensor_data(device_id, rows)

    print("\nCreated resources:")
    print(f"  areaId:   {area_id}")
    print(f"  hiveId:   {hive_id}")
    print(f"  deviceId: {device_id}")
    print(f"Uploaded {rows} sensor rows.")

    print("\nNext: run export script to download CSV for this device.")


if __name__ == "__main__":
    main()
