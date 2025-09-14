// summary.ts
// ── MIGRATION (기존 DB 있을 때만 수동 적용) ─────────────────────────────
// 원본(sensor_data2) 기간 조회 최적화를 위해 인덱스 추가:
//   ALTER TABLE sensor_data2 ADD INDEX ix_dev_time (device_id, time);
// 요약(summary) 조회 최적화를 위해 인덱스 추가:
//   ALTER TABLE sensor_data2 ADD INDEX ix_time_devtype (time, device_id, data_type);
// ───────────────────────────────────────────────────────────────────

import { pool } from './index';
import { SensorData2Insert, SensorData2Row } from '../types';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// ── 상수 ──────────────────────────────────────────────────────────────
const SEC_5M  = 300;
const SEC_30M = 1800;
const SEC_2H  = 7200;

// 목표의 1/3 지연 버퍼: 5m→+2m, 30m→+10m, 2h→+40m
const BUF_5M  = 120;   // 정책상 120s로 명시
const BUF_30M = 600;
const BUF_2H  = 2400;

export type SummaryLevel = 'raw' | '5m' | '30m' | '2h';
enum DataType { PICTURE=1, IN=2, OUT=3, TEMP=4, HUMI=5, CO2=6, WEIGH=7 }
const INOUT_TYPES = new Set<number>([DataType.IN, DataType.OUT]);
const INOUT_LIST = `${DataType.IN},${DataType.OUT}`; // SQL에서 사용

// ── Row 타입 ─────────────────────────────────────────────────────────
interface TouchRow extends RowDataPacket {
  device_id: number;
  data_type: number;
  bucket_ts: Date | string;
}
interface AggRaw5mRow extends RowDataPacket {
  avg_v: number | null;
  v_sum: number | null;
  cnt: number;
}
interface AggSumRow extends RowDataPacket {
  v_sum: number | null;
  cnt: number;
}
interface AggAvgRow extends RowDataPacket {
  v_avg: number | null;
  cnt: number;
}
interface MaxTimeRow extends RowDataPacket {
  tmax: Date | string | null;
}

// ── 공통 유틸 ─────────────────────────────────────────────────────────
function asDate(x: Date | string | null | undefined): Date | null {
  if (x == null) return null;
  return x instanceof Date ? x : new Date(x);
}
/** 00:00:00 기준 seconds 간격 floor */
function floorToBucket(ts: Date, seconds: number): Date {
  const ms = ts.getTime();
  const bucketMs = Math.floor(ms / (seconds * 1000)) * seconds * 1000;
  return new Date(bucketMs);
}
function bucketEnd(b: Date, seconds: number): Date {
  return new Date(b.getTime() + seconds * 1000);
}
function matured(tmax: Date | null, end: Date, bufferSec: number): boolean {
  if (!tmax) return false;
  return tmax.getTime() >= end.getTime() + bufferSec * 1000;
}

async function getLatestRawTime(device_id: number, data_type: number): Promise<Date | null> {
  const [rows] = await pool.query<MaxTimeRow[]>(
    `SELECT MAX(time) AS tmax
       FROM sensor_data2
      WHERE device_id = ? AND data_type = ?`,
    [device_id, data_type]
  );
  return asDate(rows[0]?.tmax);
}

/** 배치 내 (device_id,data_type)별 tmax 캐시 */
function makeTmaxCache() {
  const m = new Map<string, Date | null>();
  return async (device_id: number, data_type: number) => {
    const k = `${device_id}:${data_type}`;
    if (m.has(k)) return m.get(k)!;
    const v = await getLatestRawTime(device_id, data_type);
    m.set(k, v);
    return v;
  };
}

// 원본의 전역 tmin/tmax 조회
async function getRawMinMaxTime(): Promise<{ tmin: Date | null; tmax: Date | null }> {
    const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT MIN(time) AS tmin, MAX(time) AS tmax FROM sensor_data2`
    );
    const r = rows[0] || {};
    return {
        tmin: asDate(r.tmin ?? null),
        tmax: asDate(r.tmax ?? null),
    };
}

// 구간에 데이터가 1건이라도 있는지 빠르게 확인 (ix_time_devtype로 매우 저렴)
async function hasRows(from: Date, to: Date): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT 1 FROM sensor_data2 WHERE time >= ? AND time < ? LIMIT 1`,
        [from, to]
    );
    return rows.length > 0;
}

// ── 초기화 ────────────────────────────────────────────────────────────
export async function initSummary() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS summary_sensor_data_5m (
      device_id  INT       NOT NULL,
      data_type  INT       NOT NULL,   -- data_types.id
      bucket_ts  DATETIME  NOT NULL,   -- 버킷 시작(UTC 권장)
      v_avg      DOUBLE,
      v_sum      DOUBLE,
      cnt        INT,
      PRIMARY KEY (device_id, data_type, bucket_ts),
      INDEX ix_summary_sensor_data_5m_ts (bucket_ts)
    ) ENGINE=InnoDB
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS summary_sensor_data_30m
    LIKE summary_sensor_data_5m
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS summary_sensor_data_2h
    LIKE summary_sensor_data_5m
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS summary_sensor_data_touch (
      level       ENUM('5m','30m','2h') NOT NULL,
      device_id   INT                   NOT NULL,
      data_type   INT                   NOT NULL,
      bucket_ts   DATETIME              NOT NULL,
      enqueued_at DATETIME              NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (level, device_id, data_type, bucket_ts),
      INDEX ix_summary_sensor_data_touch_level_ts (level, bucket_ts)
    ) ENGINE=InnoDB
  `);
}

// ── raw INSERT 시 5m 터치 기록(실시간용) ───────────────────────────────
export async function enqueueTouchesForRaw(
  device_id: number,
  data_type: number,
  ts: Date | string
) {
  const d  = asDate(ts)!;
  const b5 = floorToBucket(d, SEC_5M);
  await pool.execute(
    `INSERT IGNORE INTO summary_sensor_data_touch (level, device_id, data_type, bucket_ts)
     VALUES ('5m', ?, ?, ?)`,
    [device_id, data_type, b5]
  );
}

// ── 30m/2h 업서트(5m 소스, 실시간/백필 공용) ──────────────────────────
async function upsert30mFrom5m(device_id: number, data_type: number, parent30m: Date) {
  const end30m = bucketEnd(parent30m, SEC_30M);

  if (INOUT_TYPES.has(data_type)) {
    const [aggRows] = await pool.query<AggSumRow[]>(
      `SELECT SUM(v_sum) AS v_sum, SUM(cnt) AS cnt
         FROM summary_sensor_data_5m
        WHERE device_id=? AND data_type=? AND bucket_ts>=? AND bucket_ts<?`,
      [device_id, data_type, parent30m, end30m]
    );
    const { v_sum, cnt } = aggRows[0] || { v_sum: null, cnt: 0 };
    if (!cnt) return;

    await pool.execute(
      `INSERT INTO summary_sensor_data_30m
        (device_id, data_type, bucket_ts, v_avg, v_sum, cnt)
       VALUES (?, ?, ?, NULL, ?, ?)
       ON DUPLICATE KEY UPDATE
         v_avg=VALUES(v_avg), v_sum=VALUES(v_sum), cnt=VALUES(cnt)`,
      [device_id, data_type, parent30m, v_sum, cnt]
    );
  } else {
    const [aggRows] = await pool.query<AggAvgRow[]>(
      `SELECT
         CASE WHEN SUM(cnt) IS NULL OR SUM(cnt)=0
              THEN NULL ELSE SUM(v_avg*cnt)/SUM(cnt) END AS v_avg,
         SUM(cnt) AS cnt
       FROM summary_sensor_data_5m
      WHERE device_id=? AND data_type=? AND bucket_ts>=? AND bucket_ts<?`,
      [device_id, data_type, parent30m, end30m]
    );
    const { v_avg, cnt } = aggRows[0] || { v_avg: null, cnt: 0 };
    if (!cnt) return;

    await pool.execute(
      `INSERT INTO summary_sensor_data_30m
        (device_id, data_type, bucket_ts, v_avg, v_sum, cnt)
       VALUES (?, ?, ?, ?, NULL, ?)
       ON DUPLICATE KEY UPDATE
         v_avg=VALUES(v_avg), v_sum=VALUES(v_sum), cnt=VALUES(cnt)`,
      [device_id, data_type, parent30m, v_avg, cnt]
    );
  }
}

async function upsert2hFrom5m(device_id: number, data_type: number, parent2h: Date) {
  const end2h = bucketEnd(parent2h, SEC_2H);

  if (INOUT_TYPES.has(data_type)) {
    const [aggRows] = await pool.query<AggSumRow[]>(
      `SELECT SUM(v_sum) AS v_sum, SUM(cnt) AS cnt
         FROM summary_sensor_data_5m
        WHERE device_id=? AND data_type=? AND bucket_ts>=? AND bucket_ts<?`,
      [device_id, data_type, parent2h, end2h]
    );
    const { v_sum, cnt } = aggRows[0] || { v_sum: null, cnt: 0 };
    if (!cnt) return;

    await pool.execute(
      `INSERT INTO summary_sensor_data_2h
        (device_id, data_type, bucket_ts, v_avg, v_sum, cnt)
       VALUES (?, ?, ?, NULL, ?, ?)
       ON DUPLICATE KEY UPDATE
         v_avg=VALUES(v_avg), v_sum=VALUES(v_sum), cnt=VALUES(cnt)`,
      [device_id, data_type, parent2h, v_sum, cnt]
    );
  } else {
    const [aggRows] = await pool.query<AggAvgRow[]>(
      `SELECT
         CASE WHEN SUM(cnt) IS NULL OR SUM(cnt)=0
              THEN NULL ELSE SUM(v_avg*cnt)/SUM(cnt) END AS v_avg,
         SUM(cnt) AS cnt
       FROM summary_sensor_data_5m
      WHERE device_id=? AND data_type=? AND bucket_ts>=? AND bucket_ts<?`,
      [device_id, data_type, parent2h, end2h]
    );
    const { v_avg, cnt } = aggRows[0] || { v_avg: null, cnt: 0 };
    if (!cnt) return;

    await pool.execute(
      `INSERT INTO summary_sensor_data_2h
        (device_id, data_type, bucket_ts, v_avg, v_sum, cnt)
       VALUES (?, ?, ?, ?, NULL, ?)
       ON DUPLICATE KEY UPDATE
         v_avg=VALUES(v_avg), v_sum=VALUES(v_sum), cnt=VALUES(cnt)`,
      [device_id, data_type, parent2h, v_avg, cnt]
    );
  }
}

// ── 워커: 5m 처리 + (성숙 시) 30m/2h까지 ──────────────────────────────
export async function run5mBatch(limit = 500): Promise<number> {
  const [rows] = await pool.query<TouchRow[]>(
    `SELECT device_id, data_type, bucket_ts
       FROM summary_sensor_data_touch
      WHERE level='5m'
      ORDER BY bucket_ts ASC
      LIMIT ?`,
    [limit]
  );
  if (rows.length === 0) return 0;

  const getTmax = makeTmaxCache();
  let processed = 0;

  for (const r of rows) {
    const device_id = r.device_id;
    const data_type = r.data_type;
    const b = asDate(r.bucket_ts)!;

    // 5m 성숙(+버퍼) 판정
    const end5m = bucketEnd(b, SEC_5M);
    const tmax  = await getTmax(device_id, data_type);
    if (!matured(tmax, end5m, BUF_5M)) continue;

    // 5m 집계
    const [aggRows] = await pool.query<AggRaw5mRow[]>(
      `SELECT AVG(val) AS avg_v, SUM(val) AS v_sum, COUNT(val) AS cnt
         FROM (
           SELECT COALESCE(data_float, data_int + 0.0) AS val
             FROM sensor_data2
            WHERE device_id=? AND data_type=? AND time>=? AND time<?
         ) x`,
      [device_id, data_type, b, end5m]
    );
    const { avg_v, v_sum, cnt } = aggRows[0] || { avg_v: null, v_sum: null, cnt: 0 };
    const isInOut = INOUT_TYPES.has(data_type);

    if (cnt > 0) {
      await pool.execute(
        `INSERT INTO summary_sensor_data_5m
          (device_id, data_type, bucket_ts, v_avg, v_sum, cnt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           v_avg=VALUES(v_avg), v_sum=VALUES(v_sum), cnt=VALUES(cnt)`,
        [device_id, data_type, b, isInOut ? null : avg_v, isInOut ? v_sum : null, cnt]
      );
    }

    // 부모 30m/2h도 성숙(+버퍼) 시 5m 소스에서 즉시 롤업
    const parent30m = floorToBucket(b, SEC_30M);
    const end30m    = bucketEnd(parent30m, SEC_30M);
    if (matured(tmax, end30m, BUF_30M)) {
      await upsert30mFrom5m(device_id, data_type, parent30m);
    }
    const parent2h = floorToBucket(b, SEC_2H);
    const end2h    = bucketEnd(parent2h, SEC_2H);
    if (matured(tmax, end2h, BUF_2H)) {
      await upsert2hFrom5m(device_id, data_type, parent2h);
    }

    await pool.execute(
      `DELETE FROM summary_sensor_data_touch
        WHERE level='5m' AND device_id=? AND data_type=? AND bucket_ts=? LIMIT 1`,
      [device_id, data_type, b]
    );
    processed++;
  }
  return processed;
}

// ── 큐 드레인(벽시계 무관) ────────────────────────────────────────────
let _busy = false;
let _pending = false;

export async function drainSummaryOnce(limitPerRun = 500): Promise<void> {
  if (_busy) { _pending = true; return; }
  _busy = true;
  try {
    while (await run5mBatch(limitPerRun)) { /* 계속 */ }
  } catch (e) {
    console.error('[summary] drain error', e);
  } finally {
    _busy = false;
    if (_pending) { _pending = false; drainSummaryOnce(limitPerRun).catch(console.error); }
  }
}

// ─────────────────────────────────────────────────────────────────────
// ▶▶ 고속 백필(지난 1년 등): 터치 무시, 세트 기반 INSERT…SELECT ◀◀
//   - 5m: raw → 5m (GROUP BY floor(time/300))
//   - 30m/2h: 5m → 30m/2h (GROUP BY floor(bucket_ts/1800, 7200))
//   - 윈도우 단위로 나눠 수행 + 경계 누락 방지를 위해 오버랩 추가
//   - ON DUPLICATE KEY UPDATE 로 멱등하게 반복 가능
// ─────────────────────────────────────────────────────────────────────

/** 내부: [from, to) 범위를 5m로 백필 (세트 기반) */
async function backfill5mWindow(from: Date, to: Date): Promise<number> {
    if (!(await hasRows(from, to))) return 0;

    const [ret] = await pool.execute<ResultSetHeader>(
        `
        INSERT INTO summary_sensor_data_5m (device_id, data_type, bucket_ts, v_avg, v_sum, cnt)
        SELECT
          device_id,
          data_type,
          bucket_ts,
          CASE WHEN data_type IN (${INOUT_LIST}) THEN NULL ELSE AVG(val) END AS v_avg,
          CASE WHEN data_type IN (${INOUT_LIST}) THEN SUM(val) ELSE NULL END AS v_sum,
          COUNT(val) AS cnt
        FROM (
          SELECT
            device_id,
            data_type,
            FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(time)/?)*?) AS bucket_ts,
            COALESCE(data_float, data_int + 0.0) AS val
          FROM sensor_data2
          WHERE time >= ? AND time < ?
        ) s
        GROUP BY device_id, data_type, bucket_ts
        ON DUPLICATE KEY UPDATE
          v_avg = VALUES(v_avg),
          v_sum = VALUES(v_sum),
          cnt   = VALUES(cnt)
        `,
        [SEC_5M, SEC_5M, from, to]
    );
    return ret.affectedRows ?? 0;
}

async function backfill30mFrom5mWindow(from: Date, to: Date): Promise<number> {
    if (!(await hasRows(from, to))) return 0; // 5m에 없을 확률 높지만, 가볍게 동기화

    const [ret] = await pool.execute<ResultSetHeader>(
        `
        INSERT INTO summary_sensor_data_30m (device_id, data_type, bucket_ts, v_avg, v_sum, cnt)
        SELECT
          device_id,
          data_type,
          bucket30,
          CASE WHEN data_type IN (${INOUT_LIST})
               THEN NULL
               ELSE CASE WHEN SUM(cnt)=0 THEN NULL ELSE SUM(v_avg*cnt)/SUM(cnt) END
          END AS v_avg,
          CASE WHEN data_type IN (${INOUT_LIST}) THEN SUM(v_sum) ELSE NULL END AS v_sum,
          SUM(cnt) AS cnt
        FROM (
          SELECT
            device_id,
            data_type,
            FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(bucket_ts)/?)*?) AS bucket30,
            v_avg, v_sum, cnt
          FROM summary_sensor_data_5m
          WHERE bucket_ts >= ? AND bucket_ts < ?
        ) m
        GROUP BY device_id, data_type, bucket30
        ON DUPLICATE KEY UPDATE
          v_avg = VALUES(v_avg),
          v_sum = VALUES(v_sum),
          cnt   = VALUES(cnt)
        `,
        [SEC_30M, SEC_30M, from, to]
    );
    return ret.affectedRows ?? 0;
}

async function backfill2hFrom5mWindow(from: Date, to: Date): Promise<number> {
    if (!(await hasRows(from, to))) return 0;

    const [ret] = await pool.execute<ResultSetHeader>(
        `
        INSERT INTO summary_sensor_data_2h (device_id, data_type, bucket_ts, v_avg, v_sum, cnt)
        SELECT
          device_id,
          data_type,
          bucket2h,
          CASE WHEN data_type IN (${INOUT_LIST})
               THEN NULL
               ELSE CASE WHEN SUM(cnt)=0 THEN NULL ELSE SUM(v_avg*cnt)/SUM(cnt) END
          END AS v_avg,
          CASE WHEN data_type IN (${INOUT_LIST}) THEN SUM(v_sum) ELSE NULL END AS v_sum,
          SUM(cnt) AS cnt
        FROM (
          SELECT
            device_id,
            data_type,
            FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(bucket_ts)/?)*?) AS bucket2h,
            v_avg, v_sum, cnt
          FROM summary_sensor_data_5m
          WHERE bucket_ts >= ? AND bucket_ts < ?
        ) m
        GROUP BY device_id, data_type, bucket2h
        ON DUPLICATE KEY UPDATE
          v_avg = VALUES(v_avg),
          v_sum = VALUES(v_sum),
          cnt   = VALUES(cnt)
        `,
        [SEC_2H, SEC_2H, from, to]
    );
    return ret.affectedRows ?? 0;
}

// 창 생성 유틸(가독성용)
function* iterateWindows(from: Date, to: Date, stepDays: number) {
  const dayMs = 24 * 3600 * 1000;
  let s = from;
  while (s < to) {
    const e = new Date(Math.min(s.getTime() + stepDays * dayMs, to.getTime()));
    yield [s, e] as const;
    s = e;
  }
}

/**
 * 대량 백필(예: 지난 1년)
 * - 입력 범위를 sensor_data2의 실제 tmin~tmax와 교집합으로 자동 보정
 * - 빈 윈도우는 즉시 스킵
 * - (옵션) 빈 윈도우 다수 시 stepDays를 점진적으로 키워 호출 횟수↓
 */
export async function backfillRange(
    from: Date | string,
    to: Date | string,
    stepDays = 7,
    opts?: {
        autoGrowStep?: boolean;       // 빈 창이 연속으로 나오면 stepDays 증가
        growFactor?: number;          // 증가 배수 (기본 2)
        growThreshold?: number;       // 연속 빈 창 개수 기준 (기본 3)
        maxStepDays?: number;         // stepDays 상한 (기본 60)
    }
) {
    const cfg = {
        autoGrowStep: opts?.autoGrowStep ?? true,
        growFactor: opts?.growFactor ?? 2,
        growThreshold: opts?.growThreshold ?? 3,
        maxStepDays: opts?.maxStepDays ?? 60,
    };

    // 0) 원본 전체 범위 확인
    const { tmin, tmax } = await getRawMinMaxTime();
    if (!tmin || !tmax || tmin >= tmax) {
        console.log('[backfill] SKIP: sensor_data2 is empty');
        return;
    }

    // 1) 요청 범위를 원본 범위와 교집합으로 자동 보정
    const reqFrom = floorToBucket(asDate(from)!, SEC_5M);
    const reqTo   = asDate(to)!;
    const F = new Date(Math.max(reqFrom.getTime(), tmin.getTime()));
    const T = new Date(Math.min(reqTo.getTime(),   tmax.getTime()));
    if (F >= T) {
        console.log('[backfill] SKIP: requested range has no overlap with source data', {
            requested: { from: reqFrom.toISOString(), to: reqTo.toISOString() },
            source:    { tmin: tmin.toISOString(),     tmax: tmax.toISOString() },
        });
        return;
    }

    const fmt = (d: Date) => d.toISOString();
    console.log(`[backfill] START ${fmt(F)} ~ ${fmt(T)}, step=${stepDays}d (adjusted)`);

    // 내부 이터레이터: 현재 stepDays로 창 생성
    function* windows(step: number) {
        yield* iterateWindows(F, T, step);
    }

    // 연속 빈 창 카운트로 stepDays 동적 증가
    let currentStep = stepDays;
    let emptyRun = 0;

    // ── 1) 5m
    console.time('[backfill] 5m total');
    for (const [s, e] of windows(currentStep)) {
        const to5 = new Date(e.getTime() + SEC_5M * 1000);

        // 빠른 스킵
        if (!(await hasRows(s, to5))) {
            emptyRun++;
            if (cfg.autoGrowStep && emptyRun >= cfg.growThreshold) {
                const next = Math.min(cfg.maxStepDays, Math.ceil(currentStep * cfg.growFactor));
                if (next > currentStep) {
                    console.log(`[5m] many empty windows → grow stepDays ${currentStep} -> ${next}`);
                    currentStep = next;
                }
            }
            continue;
        }
        emptyRun = 0;

        console.time(`[5m] ${fmt(s)} ~ ${fmt(to5)} window`);
        const n = await backfill5mWindow(s, to5);
        console.timeEnd(`[5m] ${fmt(s)} ~ ${fmt(to5)} window`);
        console.log(`[5m] affectedRows=${n}`);
    }
    console.timeEnd('[backfill] 5m total');

    // ── 2) 30m
    currentStep = stepDays; // 단계별로 초기화(원하면 유지해도 됨)
    emptyRun = 0;
    console.time('[backfill] 30m total');
    for (const [s, e] of windows(currentStep)) {
        const to30 = new Date(e.getTime() + SEC_30M * 1000);

        if (!(await hasRows(s, to30))) {
            emptyRun++;
            if (cfg.autoGrowStep && emptyRun >= cfg.growThreshold) {
                const next = Math.min(cfg.maxStepDays, Math.ceil(currentStep * cfg.growFactor));
                if (next > currentStep) {
                    console.log(`[30m] many empty windows → grow stepDays ${currentStep} -> ${next}`);
                    currentStep = next;
                }
            }
            continue;
        }
        emptyRun = 0;

        console.time(`[30m] ${fmt(s)} ~ ${fmt(to30)} window`);
        const n = await backfill30mFrom5mWindow(s, to30);
        console.timeEnd(`[30m] ${fmt(s)} ~ ${fmt(to30)} window`);
        console.log(`[30m] affectedRows=${n}`);
    }
    console.timeEnd('[backfill] 30m total');

    // ── 3) 2h
    currentStep = stepDays;
    emptyRun = 0;
    console.time('[backfill] 2h total');
    for (const [s, e] of windows(currentStep)) {
        const to2h = new Date(e.getTime() + SEC_2H * 1000);

        if (!(await hasRows(s, to2h))) {
            emptyRun++;
            if (cfg.autoGrowStep && emptyRun >= cfg.growThreshold) {
                const next = Math.min(cfg.maxStepDays, Math.ceil(currentStep * cfg.growFactor));
                if (next > currentStep) {
                    console.log(`[2h] many empty windows → grow stepDays ${currentStep} -> ${next}`);
                    currentStep = next;
                }
            }
            continue;
        }
        emptyRun = 0;

        console.time(`[2h] ${fmt(s)} ~ ${fmt(to2h)} window`);
        const n = await backfill2hFrom5mWindow(s, to2h);
        console.timeEnd(`[2h] ${fmt(s)} ~ ${fmt(to2h)} window`);
        console.log(`[2h] affectedRows=${n}`);
    }
    console.timeEnd('[backfill] 2h total');

    console.log('[backfill] DONE');
}

/**
 * 공통 조회: raw 또는 summary(5m/30m/2h)를 SensorData2Row 포맷으로 리턴
 *
 * - raw: sensor_data2 그대로 반환
 * - summary:
 *    - time  ← bucket_ts
 *    - data_float ← CASE(IN/OUT → v_sum, 기타 → v_avg)
 *    - data_int   ← NULL
 *    - id ← CRC32(device_id-data_type-UNIX_TIMESTAMP(bucket_ts))로 합성 (안정적)
 */
export async function getSensorDataUnified(
  deviceId: number,
  sTime: string,           // 'YYYY-MM-DD HH:MM:SS'
  eTime: string,           // 'YYYY-MM-DD HH:MM:SS'
  dataTypes: number[],
  level: SummaryLevel
): Promise<SensorData2Row[]> {
  if (dataTypes.length === 0) return [];

  if (level === 'raw') {
    // 원본 그대로 (기존 getSensorData2와 동일한 결과 포맷)
    const placeholders = dataTypes.map(() => '?').join(', ');
    const q = `
      SELECT id, device_id, data_type, data_int, data_float, time
        FROM sensor_data2
       WHERE device_id = ?
         AND data_type IN (${placeholders})
         AND time BETWEEN ? AND ?
       ORDER BY time DESC
    `;
    const params = [deviceId, ...dataTypes, sTime, eTime];
    const [rows] = await pool.execute(q, params);
    return rows as SensorData2Row[];
  }

  // summary 테이블 선택
  const table =
    level === '5m'  ? 'summary_sensor_data_5m' :
    level === '30m' ? 'summary_sensor_data_30m' :
    /* '2h' */        'summary_sensor_data_2h';

  const placeholders = dataTypes.map(() => '?').join(', ');

  // id 합성: (device_id, data_type, bucket_ts) → 안정적인 숫자 키
  //  - CRC32(CONCAT(...)) 는 UNSIGNED INT 범위. 충분히 안정적인 프론트 키로 사용 가능
  // data_float 매핑: IN/OUT → v_sum, 기타 → v_avg
  const q = `
    SELECT
      CAST(CRC32(CONCAT(device_id, '-', data_type, '-', UNIX_TIMESTAMP(bucket_ts))) AS UNSIGNED) AS id,
      device_id,
      data_type,
      NULL AS data_int,
      CASE
        WHEN data_type IN (2, 3) THEN v_sum
        ELSE v_avg
      END AS data_float,
      bucket_ts AS time
    FROM ${table}
    WHERE device_id = ?
      AND data_type IN (${placeholders})
      AND bucket_ts BETWEEN ? AND ?
    ORDER BY time DESC
  `;

  const params = [deviceId, ...dataTypes, sTime, eTime];
  const [rows] = await pool.execute(q, params);
  return rows as SensorData2Row[];
}
