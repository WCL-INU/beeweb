"""
Upload sample picture_data via API (no arguments required).

Defaults (override with env vars):
  BASE_URL=http://localhost:8090
  PICTURE_DEVICE_ID=1
  PICTURE_COUNT=3           # how many pictures to upload

Endpoints used:
  POST {BASE_URL}/picture/upload  (application/json)
    body: { "data": [ { "device_id": <number>, "time": "YYYY-MM-DDTHH:MM:SSZ", "picture": "<base64>" }, ... ] }

Requires:
  pip install requests
Run:
  python add_pictures.py
"""

import base64
import os
from datetime import datetime, timedelta, timezone

import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8090")
DEVICE_ID = int(os.environ.get("PICTURE_DEVICE_ID", "1"))
COUNT = int(os.environ.get("PICTURE_COUNT", "3"))

# Tiny 1x1 PNG (black) base64, keeps payload small.
SAMPLE_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
)


def main():
    now = datetime.now(timezone.utc)
    items = []
    for i in range(COUNT):
        ts = (now - timedelta(minutes=i * 5)).strftime("%Y-%m-%dT%H:%M:%SZ")
        items.append(
            {
                "device_id": DEVICE_ID,
                "time": ts,
                "picture": SAMPLE_PNG_B64,
            }
        )

    payload = {"data": items}
    url = f"{BASE_URL}/picture/upload"
    resp = requests.post(url, json=payload, timeout=10)
    try:
        body = resp.json()
    except Exception:
        body = resp.text
    print(f"[POST] {url} -> {resp.status_code} {body}")
    resp.raise_for_status()

    print(f"Uploaded {len(items)} pictures for device {DEVICE_ID}")


if __name__ == "__main__":
    main()
