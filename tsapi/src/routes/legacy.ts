// legacy.ts
import express, { Request, Response, NextFunction } from 'express';
import { getAreaHives } from '../db/legacy';
import userRoutes from './user';
import dataRoutes from './data';
import { getSensorData2 } from '../db/data';
import deviceRoutes from './device';

const router = express.Router();
router.use(express.json());

router.get('/areahive', async (req: Request, res: Response) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Endpoint to fetch all area hives'
    try {
        const areaHives = await getAreaHives();
        res.status(200).json(areaHives);
    } catch (error) {
        console.error('Error fetching area hives:', error);
        res.status(500).json({ error: 'Failed to fetch area hives' });
    }
});

router.get('/inout', async (req: Request, res: Response) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Fetch inout data in legacy format (from sensor_data2)'
    // #swagger.parameters['deviceId'] = { description: 'Device ID', required: true }
    // #swagger.parameters['sTime'] = { description: 'Start time (ISO 8601, e.g. 2025-05-04T14:13:00Z)', required: true }
    // #swagger.parameters['eTime'] = { description: 'End time (ISO 8601, e.g. 2025-05-11T14:13:00Z)', required: true }

    try {
        const deviceId = parseInt(req.query.deviceId as string);
        const sTime = req.query.sTime as string;
        const eTime = req.query.eTime as string;

        if (!deviceId || !sTime || !eTime) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        // Fetch rows with data_type 2 (IN) and 3 (OUT)
        const rows = await getSensorData2(deviceId, sTime, eTime, [2, 3]);

        const map = new Map<string, { device_id: number; time: string; in_field?: number; out_field?: number }>();

        for (const row of rows) {
            const key = `${row.device_id}-${row.time}`;
            const existing = map.get(key) ?? { device_id: row.device_id, time: row.time };

            if (row.data_type === 2) {
                existing.in_field = Number(row.data_int ?? row.data_float ?? 0);
            } else if (row.data_type === 3) {
                existing.out_field = Number(row.data_int ?? row.data_float ?? 0);
            }

            map.set(key, existing);
        }

        const result = Array.from(map.values()).map((entry, idx) => ({
            id: idx + 1,
            device_id: entry.device_id,
            in_field: entry.in_field ?? 0,
            out_field: entry.out_field ?? 0,
            time: entry.time,
        }));

        res.status(200).json(result);
    } catch (err) {
        console.error('Error fetching inout (legacy) data:', err);
        res.status(500).json({ error: 'Failed to fetch inout data' });
    }
});


router.post('/login', (req: Request, res: Response, next: NextFunction) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Login forwarding to user route'
    req.url = '/login';
    (userRoutes as any).handle(req, res, next);
});

router.get('/devicetypes', (req: Request, res: Response, next: NextFunction) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Forward device types requests to device route'
    req.url = '/types';
    (deviceRoutes as any).handle(req, res, next);
});

router.get('/sensor', async (req: Request, res: Response) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Fetch sensor data in legacy format (from sensor_data2)'
    // #swagger.parameters['deviceId'] = { description: 'Device ID', required: true }
    // #swagger.parameters['sTime'] = { description: 'Start time (ISO 8601, e.g. 2025-05-04T14:13:00Z)', required: true }
    // #swagger.parameters['eTime'] = { description: 'End time (ISO 8601, e.g. 2025-05-11T14:13:00Z)', required: true }

    try {
        const deviceId = parseInt(req.query.deviceId as string);
        const sTime = req.query.sTime as string;
        const eTime = req.query.eTime as string;

        if (!deviceId || !sTime || !eTime) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const rows = await getSensorData2(deviceId, sTime, eTime, [4, 5, 6, 7]);

        const map = new Map<string, {
            device_id: number;
            time: string;
            temp?: number;
            humi?: number;
            co2?: number;
            weigh?: number;
        }>();

        for (const row of rows) {
            const key = `${row.device_id}-${row.time}`;
            const existing = map.get(key) ?? { device_id: row.device_id, time: row.time };
            const value = Number(row.data_int ?? row.data_float ?? 0);

            switch (row.data_type) {
                case 4: existing.temp = value; break;
                case 5: existing.humi = value; break;
                case 6: existing.co2 = value; break;
                case 7: existing.weigh = value; break;
            }

            map.set(key, existing);
        }

        const result = Array.from(map.values()).map((entry, idx) => ({
            id: idx + 1,
            device_id: entry.device_id,
            temp: entry.temp ?? 0,
            humi: entry.humi ?? 0,
            co2: entry.co2 ?? 0,
            weigh: entry.weigh ?? 0,
            time: entry.time
        }));

        res.status(200).json(result);
    } catch (err) {
        console.error('Error fetching sensor (legacy) data:', err);
        res.status(500).json({ error: 'Failed to fetch sensor data' });
    }
});

router.get('/camera', (req: Request, res: Response, next: NextFunction) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Forward camera requests to data route'
    req.url = '/camera';
    (dataRoutes as any).handle(req, res, next);
});

router.post('/uplink', (req: Request, res: Response, next: NextFunction) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Uplink adapter for legacy to sensor2 format'
    try {
        const body = req.body;
        const id = body.id;

        if (!id) {
            console.error('Missing id in body');
            res.status(400).json({ error: 'Missing id in body' });
            return;
        }

        const values: Record<string, number> = {};

        for (const key in body) {
            if (key === 'id') continue;
            if (key === 'inField') {
                values['in_field'] = body[key];
            } else if (key === 'outField') {
                values['out_field'] = body[key];
            } else {
                values[key] = body[key];
            }
        }

        if (Object.keys(values).length === 0) {
            console.error('No valid data fields found');
            res.status(400).json({ error: 'No valid data fields found' });
            return;
        }

        req.body = {
            id,
            values,
        };

        req.url = '/uplink';
        (dataRoutes as any).handle(req, res, next);
    } catch (err) {
        console.error('Error in uplink adapter:', err);
        res.status(500).json({ error: 'Failed to process uplink data' });
        return;
    }
});

router.post('/upload', (req: Request, res: Response, next: NextFunction) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Upload adapter for legacy format to sensor2 format'
    try {
        const type = req.body.type;
        const data = req.body.data;

        if (!Array.isArray(data) || data.length === 0) {
            console.error('Invalid or missing data array');
            console.log(req.body);
            return;
        }

        const transformed = data.map((entry: any) => {
            const { id, time, ...rest } = entry;

            const values: Record<string, number> = {};
            for (const key in rest) {
                if (key === 'inField') {
                    values['in_field'] = rest[key];
                } else if (key === 'outField') {
                    values['out_field'] = rest[key];
                } else {
                    values[key] = rest[key];
                }
            }

            return {
                device_id: id,
                time: time?.replace('T', ' ').replace('Z', '') ?? new Date().toISOString().slice(0, 19).replace('T', ' '),
                values,
            };
        });

        req.body = { data: transformed };
        req.url = '/upload';
        (dataRoutes as any).handle(req, res, next);
    } catch (err) {
        console.error('Error in upload adapter:', err);
        return;
    }
});

export default router;
