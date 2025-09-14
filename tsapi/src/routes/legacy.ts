import express, { Request, Response, NextFunction } from 'express';
import { getAreaHives } from '../db/legacy';
import userRoutes from './user';
import dataRoutes from './data';
import pictureRoutes from './picture';
import deviceRoutes from './device';
import { getDeviceTypes } from '../db/device';
import { getSensorData2 } from '../db/data';

const router = express.Router();
// JSON 바디 파서는 legacy JSON 엔드포인트용
router.use(express.json());

// ✅ GET /api/areahive
router.get('/areahive', async (req: Request, res: Response) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Fetch all area hives'
    try {
        const areaHives = await getAreaHives();
        res.status(200).json(areaHives);
        return;
    } catch (err) {
        console.error('Error fetching area hives:', err);
        res.status(500).json({ error: 'Failed to fetch area hives' });
        return;
    }
});

// ✅ GET /api/inout
router.get('/inout', async (req: Request, res: Response) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Fetch inout data in legacy format (from sensor_data2)'
    // #swagger.parameters['deviceId'] = { description: 'Device ID', required: true }
    // #swagger.parameters['sTime']    = { description: 'Start time ISO8601', required: true }
    // #swagger.parameters['eTime']    = { description: 'End time ISO8601', required: true }
    try {
        const deviceId = parseInt(req.query.deviceId as string);
        const sTime = req.query.sTime as string;
        const eTime = req.query.eTime as string;
        if (!deviceId || !sTime || !eTime) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        const rows = await getSensorData2(deviceId, sTime, eTime, [2, 3]);
        const map = new Map<string, any>();
        rows.forEach(row => {
            const key = `${row.device_id}-${row.time}`;
            const entry = map.get(key) || { device_id: row.device_id, time: row.time };
            if (row.data_type === 2) entry.in_field = Number(row.data_int ?? row.data_float ?? 0);
            if (row.data_type === 3) entry.out_field = Number(row.data_int ?? row.data_float ?? 0);
            map.set(key, entry);
        });
        const result = Array.from(map.values()).map((entry, idx) => ({
            id: idx + 1,
            device_id: entry.device_id,
            in_field: entry.in_field ?? 0,
            out_field: entry.out_field ?? 0,
            time: entry.time
        }));
        res.status(200).json(result);
        return;
    } catch (err) {
        console.error('Error fetching inout (legacy) data:', err);
        res.status(500).json({ error: 'Failed to fetch inout data' });
        return;
    }
});

// ✅ POST /api/login → userRoutes
router.post('/login', (req: Request, res: Response, next: NextFunction) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Forward login to user route'
    req.url = '/login';
    return (userRoutes as any).handle(req, res, next);
});

// ✅ GET /api/devicetypes → deviceRoutes
router.get('/devicetypes', (req: Request, res: Response, next: NextFunction) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Forward device types to device route'
    req.url = '/types';
    return (deviceRoutes as any).handle(req, res, next);
});

// ✅ GET /api/sensor
router.get('/sensor', async (req: Request, res: Response) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Fetch sensor data in legacy format (from sensor_data2)'
    // #swagger.parameters['deviceId'] = { description: 'Device ID', required: true }
    // #swagger.parameters['sTime']    = { description: 'Start time ISO8601', required: true }
    // #swagger.parameters['eTime']    = { description: 'End time ISO8601', required: true }
    try {
        const deviceId = parseInt(req.query.deviceId as string);
        const sTime = req.query.sTime as string;
        const eTime = req.query.eTime as string;
        if (!deviceId || !sTime || !eTime) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        const rows = await getSensorData2(deviceId, sTime, eTime, [4, 5, 6, 7]);
        const map = new Map<string, any>();
        rows.forEach(row => {
            const key = `${row.device_id}-${row.time}`;
            const entry = map.get(key) || { device_id: row.device_id, time: row.time };
            const value = Number(row.data_int ?? row.data_float ?? 0);
            switch (row.data_type) {
                case 4: entry.temp = value; break;
                case 5: entry.humi = value; break;
                case 6: entry.co2 = value; break;
                case 7: entry.weigh = value; break;
            }
            map.set(key, entry);
        });
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
        return;
    } catch (err) {
        console.error('Error fetching sensor (legacy) data:', err);
        res.status(500).json({ error: 'Failed to fetch sensor data' });
        return;
    }
});

// ✅ GET /api/camera → forward to picture
router.get('/camera', (req: Request, res: Response, next: NextFunction) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Forward camera requests to picture route'
    req.url = '/';
    return (pictureRoutes as any).handle(req, res, next);
});

// ✅ POST /api/uplink → sensor2 uplink adapter
router.post('/uplink', (req: Request, res: Response, next: NextFunction) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Legacy uplink adapter for sensor data'
    try {
        const { id, inField, outField, ...rest } = req.body;
        if (!id) {
            res.status(400).json({ error: 'Missing id' });
            return;
        }
        const values: Record<string, number> = {};
        if (inField != null) values['in_field'] = inField;
        if (outField != null) values['out_field'] = outField;
        Object.entries(rest).forEach(([k, v]) => { values[k] = v as number; });
        if (!Object.keys(values).length) {
            res.status(400).json({ error: 'No valid data fields' });
            return;
        }
        req.body = { id, values };
        req.url = '/uplink';
        return (dataRoutes as any).handle(req, res, next);
    } catch (err) {
        console.error('Error in uplink adapter:', err);
        res.status(500).json({ error: 'Failed to process uplink' });
        return;
    }
});
// ✅ POST /api/upload → legacy upload adapter
router.post('/upload', async (req: Request, res: Response, next: NextFunction) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Legacy upload adapter: forward to sensor2 or picture upload'
    // #swagger.parameters['type'] = { description: 'Device type ID', required: true }
    // #swagger.parameters['data'] = { description: 'Legacy data array or multipart fields', required: true }

    try {
        // 1) multipart/form-data 은 바로 pictureRoutes 로 넘김
        if (req.is('multipart/form-data')) {
            // 이 단계에선 multer 없이 raw req를 넘기기만!
            req.url = '/upload';
            return (pictureRoutes as any).handle(req, res, next);
        }

        // 2) JSON payload 분기
        const type = req.body.type;
        const data = req.body.data;
        if (!type || !Array.isArray(data) || data.length === 0) {
            res.status(400).json({ error: 'Missing type or data' })
            return;
        }

        const typesList = await getDeviceTypes();
        const t = typesList.find(t => t.id === parseInt(type, 10));
        if (!t) {
            res.status(400).json({ error: 'Unknown type' })
            return;
        }

        if (t.name === 'CAMERA') {
            // picture JSON
            const transformed = data.map((e: any) => ({
                device_id: e.id,
                time: e.time,
                picture: e.picture
            }));
            req.body = { data: transformed };
            req.url = '/upload';
            return (pictureRoutes as any).handle(req, res, next);

        } else {
            // sensor JSON
            const transformed = data.map((e: any) => {
                const { id, time, ...rest } = e;
                const values: Record<string, number> = {};
                if (e.inField != null) values['in_field'] = e.inField;
                if (e.outField != null) values['out_field'] = e.outField;
                Object.entries(rest).forEach(([k, v]) => {
                    if (k !== 'inField' && k !== 'outField') values[k] = v as number;
                });
                return {
                    device_id: id,
                    time: time?.replace('T', ' ').replace('Z', '')
                        ?? new Date().toISOString().slice(0, 19).replace('T', ' '),
                    values
                };
            });
            req.body = { data: transformed };
            req.url = '/upload';
            return (dataRoutes as any).handle(req, res, next);
        }

    } catch (err) {
        console.error('Error in legacy upload adapter:', err);
        res.status(500).json({ error: 'Failed to process legacy upload' })
        return;
    }
});

export default router;