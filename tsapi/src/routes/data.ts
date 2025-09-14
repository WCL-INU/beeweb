// ✅ sensor2 전용 라우터
import express, { Request, Response } from 'express';
import { getSensorData2, insertSensorData2 } from '../db/data';
import { DATA_TYPE, SensorData2Insert, SensorData2Value } from '../types';
import { getSensorDataUnified, type SummaryLevel } from '../db/summary'; // 앞서 만든 함수/타입

const FIELD_TO_TYPE_MAP: Record<string, number> = {
    in_field: DATA_TYPE.IN,
    out_field: DATA_TYPE.OUT,
    temp: DATA_TYPE.TEMP,
    humi: DATA_TYPE.HUMI,
    co2: DATA_TYPE.CO2,
    weigh: DATA_TYPE.WEIGH
};

const router = express.Router();
router.use(express.json());


// 기간 기반 자동 선택 규칙(원하면 조정)
// - ≤ 1일: raw
// - ≤ 7일: 5m
// - ≤ 30일: 30m
// -  그 이상: 2h
function chooseSummaryLevel(sISO: string, eISO: string): SummaryLevel {
  const s = new Date(sISO).getTime();
  const e = new Date(eISO).getTime();
  const span = Math.max(0, e - s);

  const day = 24 * 3600 * 1000;
  if (span <= 1 * day) return 'raw';
  if (span <= 7 * day) return '5m';
  if (span <= 30 * day) return '30m';
  return '2h';
}

function parseLevel(q: unknown, s: string, e: string): SummaryLevel {
  const lv = (typeof q === 'string' ? q.toLowerCase() : 'auto') as
    | 'auto' | SummaryLevel;
  if (lv === 'auto' || !lv) return chooseSummaryLevel(s, e);
  if (lv === 'raw' || lv === '5m' || lv === '30m' || lv === '2h') return lv;
  return chooseSummaryLevel(s, e); // 잘못된 값이면 auto로
}

// ✅ GET /sensor2 : 특정 data_type을 지정하여 조회 (raw/summary 공통)
router.get('/sensor2', async (req: Request, res: Response) => {
  // #swagger.tags = ['Sensor2']
  // #swagger.description = 'Fetch sensor or inout data by type and time range'
  // #swagger.parameters['deviceId'] = { description: 'Device ID', required: true }
  // #swagger.parameters['sTime'] = { description: 'Start time (ISO 8601, e.g. 2025-05-04T14:13:00Z)', required: true }
  // #swagger.parameters['eTime'] = { description: 'End time (ISO 8601, e.g. 2025-05-11T14:13:00Z)', required: true }
  // #swagger.parameters['dataTypes'] = { description: 'Comma-separated data types (e.g. 2,3,4)', required: true }
  // #swagger.parameters['level'] = { description: 'raw | 5m | 30m | 2h | auto(default)', required: false }

  try {
    const deviceId = Number(req.query.deviceId);
    const sTime = String(req.query.sTime || '');
    const eTime = String(req.query.eTime || '');
    const dataTypesQ = req.query.dataTypes;

    if (!deviceId || !sTime || !eTime || !dataTypesQ) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // dataTypes 파싱/정제
    const parsedTypes = (Array.isArray(dataTypesQ)
      ? dataTypesQ.join(',')
      : String(dataTypesQ)
    )
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => Number.isFinite(n));
    if (parsedTypes.length === 0) {
      res.status(400).json({ error: 'Invalid dataTypes' });
      return;
    }

    // level 결정(명시 or auto)
    const level = parseLevel(req.query.level, sTime, eTime);

    // 공통 조회 (raw/summary 동일 포맷)
    const rows = await getSensorDataUnified(deviceId, sTime, eTime, parsedTypes, level);

    // 기존 응답 포맷 유지
    const result: SensorData2Value[] = rows.map(row => ({
      id: row.id,
      device_id: row.device_id,
      data_type: row.data_type,
      time: row.time,
      value: Number(row.data_int ?? row.data_float ?? 0),
    }));

    if (result.length === 0) {
      res.status(404).json({ error: 'No data found', level });
    } else {
      res.status(200).json({ level, data: result });
    }
  } catch (error) {
    console.error('Error in /sensor2 GET:', error);
    res.status(500).json({ error: 'Failed to fetch sensor data' });
  }
});

// ✅ 단건 입력
router.post('/uplink', async (req: Request, res: Response) => {
    // #swagger.tags = ['Sensor2']
    // #swagger.description = 'Upload a single data record from device'
    /* #swagger.parameters['body'] = {
          in: 'body',
          required: true,
          schema: {
            $id: 1,
            values: {
              $co2: 450,
              $out_field: 3
            }
          }
    } */

    try {
        const id = req.body.id as number;
        const values = req.body.values as Record<string, number>;
        if (!id || !values) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const time = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const rows: SensorData2Insert[] = [];

        for (const key in values) {
            const type = FIELD_TO_TYPE_MAP[key];
            if (!type) continue;

            const value = values[key];
            if (value == null) continue;

            rows.push({
                device_id: id,
                time,
                data_type: type,
                data_int: ['in_field', 'out_field'].includes(key) ? value : null,
                data_float: ['temp', 'humi', 'co2', 'weigh'].includes(key) ? value : null
            });
        }

        await insertSensorData2(rows);
        res.status(200).json({ message: 'Sensor data uplinked successfully' });
    } catch (error) {
        console.error('Error in /uplink POST:', error);
        res.status(500).json({ error: 'Failed to uplink sensor data' });
    }
});

// ✅ 다건 입력
router.post('/upload', async (req: Request, res: Response) => {
    // #swagger.tags = ['Sensor2']
    // #swagger.description = 'Upload a batch of sensor/inout data with timestamps'
    /* #swagger.parameters['body'] = {
          in: 'body',
          required: true,
          schema: {
            data: [
              {
                $device_id: 1,
                time: '2025-05-11T13:30:00Z',
                values: {
                  $temp: 25.5,
                  $humi: 60
                }
              }
            ]
          }
    } */

    try {
        const data = req.body.data;
        if (!Array.isArray(data) || data.length === 0) {
            res.status(400).json({ error: 'Missing or invalid data array' });
            return;
        }

        const rows: SensorData2Insert[] = [];

        for (const item of data) {
            const device_id = item.device_id;
            const time = item.time?.replace('T', ' ').replace('Z', '') ?? new Date().toISOString().slice(0, 19).replace('T', ' ');
            const values = item.values as Record<string, number>;

            for (const key in values) {
                const type = FIELD_TO_TYPE_MAP[key];
                if (!type) continue;

                const value = values[key];
                if (value == null) continue;

                rows.push({
                    device_id,
                    time,
                    data_type: type,
                    data_int: ['in_field', 'out_field'].includes(key) ? value : null,
                    data_float: ['temp', 'humi', 'co2', 'weigh'].includes(key) ? value : null
                });
            }
        }

        await insertSensorData2(rows);
        res.status(200).json({ message: 'Sensor data uploaded successfully' });
    } catch (error) {
        console.error('Error in /upload POST:', error);
        res.status(500).json({ error: 'Failed to upload sensor data' });
    }
});

export default router;
