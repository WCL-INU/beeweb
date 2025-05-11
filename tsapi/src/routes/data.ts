// ✅ sensor2 전용 라우터
import express, { Request, Response } from 'express';
import { getSensorData2, insertSensorData2 } from '../db/data';
import { DATA_TYPE, SensorData2Insert, SensorData2Value } from '../types';

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

// ✅ GET /sensor2 : 특정 data_type을 지정하여 조회
router.get('/sensor2', async (req: Request, res: Response) => {
    // #swagger.tags = ['Sensor2']
    // #swagger.description = 'Fetch sensor or inout data by type and time range'
    // #swagger.parameters['deviceId'] = { description: 'Device ID', required: true }
    // #swagger.parameters['sTime'] = { description: 'Start time (ISO 8601, e.g. 2025-05-04T14:13:00Z)', required: true }
    // #swagger.parameters['eTime'] = { description: 'End time (ISO 8601, e.g. 2025-05-11T14:13:00Z)', required: true }
    // #swagger.parameters['dataTypes'] = { description: 'Comma-separated data types (e.g. 2,3,4)', required: true }

    try {
        const deviceId = parseInt(req.query.deviceId as string);
        const sTime = req.query.sTime as string;
        const eTime = req.query.eTime as string;
        const dataTypes = req.query.dataTypes;

        if (!deviceId || !sTime || !eTime || !dataTypes) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const parsedTypes = Array.isArray(dataTypes)
            ? dataTypes.map(Number)
            : (dataTypes as string).split(',').map(Number);

        const rows = await getSensorData2(deviceId, sTime, eTime, parsedTypes);

        const result: SensorData2Value[] = rows.map(row => ({
            id: row.id,
            device_id: row.device_id,
            data_type: row.data_type,
            time: row.time,
            value: Number(row.data_int ?? row.data_float ?? 0)
        }));

        if (result.length === 0) {
            res.status(404).json({ error: 'No data found' });
        } else {
            res.status(200).json(result);
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
