# CSV export (server-side file, sensor data)

## Context
- Research-only service; no accounts.
- Current CSV download was in-memory; now we stream to server-side files.
- Target dataset: `sensor_data2` rows filtered by device, data types, time range.

## Goals
- Keep memory near-constant during export.
- Simple unauthenticated endpoints.
- Files cleaned up automatically after TTL.

## Non-goals
- No ownership/ACL; possession of `exportId` is enough.
- No rate limiting beyond light concurrency caps.

## High-level flow
1) Client requests export with `{ deviceId, dataTypes[], sTime, eTime }`.
2) API creates an export job record and returns `exportId`.
3) Worker streams matching `sensor_data2` rows to CSV on disk (batch read/write).
4) When done, status becomes `ready`; client downloads via `exportId`.
5) Files expire after TTL (e.g., 24h) and are deleted by a janitor job.

## API (draft)
- `POST /exports/data` → body: `{ deviceId: number, dataTypes: number[], sTime: string, eTime: string }`; response `{ exportId }`.
- `GET /exports/:id/status` → `{ status: pending|running|ready|failed|expired, progress, totalRows, fileSize, createdAt, completedAt, expiresAt, error? }`.
- `GET /exports/:id/download` → streams CSV (`Content-Disposition` attachment). 404 if not ready/expired/missing.
- `DELETE /exports/:id` → manual cleanup (metadata + file).
- `POST /exports/cleanup` → manual sweep (optional).

## Data model (table: `exports`)
- `id` (uuid, primary key)
- `type` (e.g., `sensor_csv`)
- `status` (`pending|running|ready|failed|expired`)
- `params` (json for filters/sort)
- `progress` (int, rows written)
- `total_rows` (int, nullable)
- `file_path` (varchar)
- `file_size` (int, nullable until ready)
- `created_at`, `updated_at`, `completed_at`, `expires_at`
- `error` (text)

## Worker behavior
- Pick jobs FIFO; cap concurrent workers (e.g., 1–2) to protect DB.
- For each job:
  - Mark `running`, compute `file_path = <exportDir>/<id>.csv`.
  - Create `fs.createWriteStream(file_path)`; write CSV headers.
  - Read DB in batches (e.g., 5k–20k rows) with `ORDER BY time` and filter by deviceId, dataTypes, time range.
  - After each batch: write rows to CSV, update `progress`/`total_rows`.
  - On completion: end stream, `stat` file for `file_size`, mark `ready`.
  - On error: mark `failed`, remove partial file if it exists.

## Storage and cleanup
- Export directory: `tmp/exports` (configurable via env, ensure dir exists on boot).
- File naming: `<exportId>.csv`; optional prefix per export type.
- TTL: default 24h (tune as needed); cron or interval job marks expired and deletes files.
- On startup, optionally sweep orphaned files/records older than TTL.

## Client notes
- Client polls `/status` until `ready`, then calls `/download`.
- If the client does not wait, `/download` returns 404 until ready.
- Since there is no auth, client must store `exportId`; losing it means re-requesting export.

## Edge cases
- Empty result set: still generate CSV with headers, zero rows; status `ready`.
- Large datasets: ensure DB pool timeouts are respected; consider small pauses between batches.
- Concurrent exports: apply lightweight limits per process (e.g., max queue length) to avoid memory/IO pressure.

## Implementation knobs (env)
- `EXPORT_DIR` (default `tmp/exports`)
- `EXPORT_TTL_HOURS` (default `24`)
- `EXPORT_BATCH_SIZE` (default `5000`)
- `EXPORT_MAX_CONCURRENCY` (default `1`)
