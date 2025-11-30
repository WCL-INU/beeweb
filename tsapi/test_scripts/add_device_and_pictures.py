"""
Create a new area/hive/device and upload PNG pictures from a local folder.

Defaults (override with env vars):
  BASE_URL=http://localhost:8090
  AREA_NAME=Picture Area
  AREA_LOC=37.000, 127.000
  HIVE_NAME=Picture Hive
  DEVICE_NAME=Picture Device
  DEVICE_TYPE_ID=1      # seeded as CAMERA
  IMAGES_DIR=./images   # folder containing *.png files

Endpoints used:
  POST {BASE_URL}/area   body: {"name": <string>, "location": <string>}
  POST {BASE_URL}/hive   body: {"name": <string>, "areaId": <number>}
  POST {BASE_URL}/device body: {"name": <string>, "hiveId": <number>, "typeId": <number>}
  POST {BASE_URL}/picture/upload (application/json)
    body: { "data": [ { "device_id": <number>, "time": "YYYY-MM-DDTHH:MM:SSZ", "picture": "<base64>" }, ... ] }

Requires:
  pip install requests
Run:
  python add_device_and_pictures.py
"""

import base64
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8090")


def post_json(path: str, payload: Dict[str, Any]) -> requests.Response:
    url = f"{BASE_URL}{path}"
    resp = requests.post(url, json=payload, timeout=10)
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
    resp.raise_for_status()
    raise RuntimeError("Unhandled area creation error")


def create_hive(name: str, area_id: int) -> int:
    resp = post_json("/hive", {"name": name, "areaId": area_id})
    if resp.status_code in (200, 201, 409):
        data = resp.json()
        hive_id = data.get("hiveId") or data.get("hive_id") or data.get("id")
        if not hive_id:
            raise RuntimeError(f"Hive response missing id: {data}")
        return int(hive_id)
    resp.raise_for_status()
    raise RuntimeError("Unhandled hive creation error")


def create_device(name: str, hive_id: int, type_id: int) -> int:
    resp = post_json("/device", {"name": name, "hiveId": hive_id, "typeId": type_id})
    if resp.status_code in (200, 201):
        data = resp.json()
        device_id = data.get("deviceId") or data.get("device_id") or data.get("id")
        if not device_id:
            raise RuntimeError(f"Device response missing id: {data}")
        return int(device_id)
    resp.raise_for_status()
    raise RuntimeError("Unhandled device creation error")


def load_images(images_dir: Path) -> List[Path]:
    files = sorted(images_dir.glob("*.png"))
    if not files:
        raise FileNotFoundError(f"No PNG files found in {images_dir}")
    return files


def upload_pictures(device_id: int, images: List[Path]) -> None:
    now = datetime.now(timezone.utc)
    items = []
    for idx, img_path in enumerate(images):
        ts = (now - timedelta(minutes=idx * 2)).strftime("%Y-%m-%dT%H:%M:%SZ")
        with img_path.open("rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        items.append({"device_id": device_id, "time": ts, "picture": b64})

    payload = {"data": items}
    url = f"{BASE_URL}/picture/upload"
    resp = requests.post(url, json=payload, timeout=20)
    try:
        body = resp.json()
    except Exception:
        body = resp.text
    print(f"[POST] {url} -> {resp.status_code} {body}")
    resp.raise_for_status()
    print(f"Uploaded {len(items)} pictures for device {device_id}")


def main():
    area_name = os.environ.get("AREA_NAME", "Picture Area")
    area_loc = os.environ.get("AREA_LOC", "37.000, 127.000")
    hive_name = os.environ.get("HIVE_NAME", "Picture Hive")
    device_name = os.environ.get("DEVICE_NAME", "Picture Device")
    device_type_id = int(os.environ.get("DEVICE_TYPE_ID", "1"))  # 1 = CAMERA
    images_dir = Path(os.environ.get("IMAGES_DIR", "./images")).resolve()

    images = load_images(images_dir)

    area_id = create_area(area_name, area_loc)
    hive_id = create_hive(hive_name, area_id)
    device_id = create_device(device_name, hive_id, device_type_id)
    upload_pictures(device_id, images)

    print("\nCreated resources:")
    print(f"  areaId:   {area_id}")
    print(f"  hiveId:   {hive_id}")
    print(f"  deviceId: {device_id}")
    print(f"Uploaded {len(images)} images from {images_dir}")


if __name__ == "__main__":
    main()
