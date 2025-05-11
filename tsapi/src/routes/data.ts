// ✅ sensor2 전용 라우터
import express, { Request, Response } from 'express';
import { getSensorData2, insertSensorData2 } from '../db/data';
import { DATA_TYPE } from '../types';

const router = express.Router();
router.use(express.json());

// ✅ GET /sensor2 : 특정 data_type을 지정하여 조회
router.get('/sensor2', async (req: Request, res: Response) => {
    // #swagger.tags = ['Sensor2']
    // #swagger.description = 'Fetch sensor or inout data by type and time range'
    // #swagger.parameters['deviceId'] = { description: 'Device ID', required: true }
    // #swagger.parameters['sTime'] = { description: 'Start time (YYYY-MM-DD HH:mm:ss)', required: true }
    // #swagger.parameters['eTime'] = { description: 'End time (YYYY-MM-DD HH:mm:ss)', required: true }
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

        const data = await getSensorData2(deviceId, sTime, eTime, parsedTypes);
        if (data.length === 0) {
            res.status(404).json({ error: 'No data found' });
        } else {
            res.status(200).json(data);
        }
    } catch (error) {
        console.error('Error in /sensor2 GET:', error);
        res.status(500).json({ error: 'Failed to fetch sensor data' });
    }
});

// ✅ upload 단건 입력용
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

        await insertSensorData2([{ device_id: id, time, values }]);
        res.status(200).json({ message: 'Sensor data uplinked successfully' });
    } catch (error) {
        console.error('Error in /uplink POST:', error);
        res.status(500).json({ error: 'Failed to uplink sensor data' });
    }
});

// ✅ upload 다건 입력용
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
                time: '2025-05-11 13:30:00',
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

        for (const item of data) {
            item.time = item.time?.replace('T', ' ').replace('Z', '') ?? new Date().toISOString().slice(0, 19).replace('T', ' ');
        }

        await insertSensorData2(data);
        res.status(200).json({ message: 'Sensor data uploaded successfully' });
    } catch (error) {
        console.error('Error in /upload POST:', error);
        res.status(500).json({ error: 'Failed to upload sensor data' });
    }
});

export default router;