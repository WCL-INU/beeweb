import express, { Request, Response } from 'express';
import { getInOutData, getSensorData, getCameraData, insertCameraData, insertInOutData, insertSensorData } from '../db/data'; // Assuming you have a function to fetch inout data
import { InOutData, SensorData, CameraData } from '../types'; // Assuming you have a type definition for InOutData
import { getDeviceByDeviceId, updateDevice } from '../db/device'; // Assuming you have a function to check device existence
import e from 'express';
import multer from 'multer';

const upload = multer(); // 메모리 저장
const router = express.Router();
router.use(express.json());

router.get('/inout', async (req: Request, res: Response) => {
    console.log('inout comming');
    // #swagger.tags = ['Data']
    // #swagger.description = 'Endpoint to fetch inout data'
    try {
        const deviceId = req.query.deviceId as string;
        const sTime = req.query.sTime as string;
        const eTime = req.query.eTime as string;

        // 필수 필드 있는지 확인
        if ((deviceId === undefined || deviceId === null) && 
            (sTime === undefined || sTime === null) && 
            (eTime === undefined || eTime === null)) {
            // #swagger.responses[400] = { description: 'Missing required fields' }
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        let inoutData: InOutData[] = await getInOutData(parseInt(deviceId), sTime, eTime);
        if (inoutData.length !== 0) {
            // #swagger.responses[200] = { description: 'Inout data fetched successfully' }
            res.status(200).json(inoutData);
            return;
        }

        // #swagger.responses[404] = { description: 'No data found' }
        res.status(404).json({ error: 'No data found' });
        return;
    } catch (error) {
        console.error('Error fetching inout data:', error);
        // #swagger.responses[500] = { description: 'Failed to fetch inout data' }
        res.status(500).json({ error: 'Failed to fetch inout data' });
        return;
    }
});

router.get('/sensor', async (req: Request, res: Response) => {
    // #swagger.tags = ['Data']
    // #swagger.description = 'Endpoint to fetch sensor data'
    try {
        const deviceId = req.query.deviceId as string;
        const sTime = req.query.sTime as string;
        const eTime = req.query.eTime as string;

        // 필수 필드 있는지 확인
        if ((deviceId === undefined || deviceId === null) && 
            (sTime === undefined || sTime === null) && 
            (eTime === undefined || eTime === null)) {
            // #swagger.responses[400] = { description: 'Missing required fields' }
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        let sensorData: SensorData[] = await getSensorData(parseInt(deviceId), sTime, eTime);
        if (sensorData.length !== 0) {
            // #swagger.responses[200] = { description: 'Sensor data fetched successfully' }
            res.status(200).json(sensorData);
            return;
        }

        // #swagger.responses[404] = { description: 'No data found' }
        res.status(404).json({ error: 'No data found' });
        return;
    } catch (error) {
        console.error('Error fetching sensor data:', error);
        // #swagger.responses[500] = { description: 'Failed to fetch sensor data' }
        res.status(500).json({ error: 'Failed to fetch sensor data' });
        return;
    }
});

router.get('/camera', async (req: Request, res: Response) => {
    // #swagger.tags = ['Data']
    // #swagger.description = 'Endpoint to fetch camera data'
    try {
        const deviceId = req.query.deviceId as string;
        const sTime = req.query.sTime as string;
        const eTime = req.query.eTime as string;

        // 필수 필드 있는지 확인
        if ((deviceId === undefined || deviceId === null) && 
            (sTime === undefined || sTime === null) && 
            (eTime === undefined || eTime === null)) {
            // #swagger.responses[400] = { description: 'Missing required fields' }
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        let cameraData: CameraData[] = await getCameraData(parseInt(deviceId), sTime, eTime);
        if (cameraData.length !== 0) {
            // #swagger.responses[200] = { description: 'Camera data fetched successfully' }
            res.status(200).json(cameraData);
            return;
        }

        // #swagger.responses[404] = { description: 'No data found' }
        res.status(404).json({ error: 'No data found' });
        return;
    } catch (error) {
        console.error('Error fetching camera data:', error);
        // #swagger.responses[500] = { description: 'Failed to fetch camera data' }
        res.status(500).json({ error: 'Failed to fetch camera data' });
        return;
    }
});

const handleInOutData = async (data: InOutData[]) => {
    if (data.some(item =>
        item.in_field == null ||
        item.out_field == null)) {
        throw new Error('Missing required fields in InOutData');
    }
    await insertInOutData(data);
}

const handleSensorData = async (data: SensorData[]) => {
    if (data.some(item =>
        item.temp == null ||
        item.humi == null ||
        item.co2 == null ||
        item.weigh == null)) {
        throw new Error('Missing required fields in SensorData');
    }
    await insertSensorData(data);
}

const handleCameraData = async (data: CameraData[]) => {
    if (data.some(item =>
        item.picture == null)) {
        throw new Error('Missing required fields in CameraData');
    }
    await insertCameraData(data);
}

router.post('/uplink', async (req: Request, res: Response) => {
    // #swagger.tags = ['Data']
    // #swagger.description = 'Endpoint to upload data'

    try {
        const id = req.body.id as number;
        const type = req.body.type as number;

        if (id === undefined || id === null || 
            type === undefined || type === null) {
            // #swagger.responses[400] = { description: 'Missing required fields' }
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        // DB에 있는지 확인
        // id는 1개지만 함수 사용을 위해 배열로 변환
        const deviceId = [id];
        const device = await getDeviceByDeviceId(deviceId);
        // type이 같은지 확인
        if (device.length === 0 || device[0].type_id !== type) {
            // #swagger.responses[404] = { description: 'Device not found or type mismatch' }
            res.status(404).json({ error: 'Device not found or type mismatch' });
            return;
        }

        // IP 업데이트
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await updateDevice(id, undefined, ip as string);

        // timestamp를 mysql포맷으로 변환
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
        // DB에 저장
        // (1, 'CAMERA'),
        // (2, 'SENSOR'),
        // (3, 'INOUT')

        if (type == 3) {
            const inField = req.body.inField as number;
            const outField = req.body.outField as number;
            if (inField === undefined || inField === null || 
                outField === undefined || outField === null) {
                // #swagger.responses[400] = { description: 'Missing required fields' }
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }
            const inoutData: InOutData[] = [{
                id : 1, // autoIncrement 값이라 아무거나 입력
                device_id: id,
                time: timestamp,
                in_field: inField,
                out_field: outField
            }];
            await handleInOutData(inoutData);
            // #swagger.responses[200] = { description: 'Inout data uploaded successfully' }
            res.status(200).json({ message: 'Inout data uploaded successfully' });
            return;
        } else if (type == 2) {
            const temp = req.body.temp as number;
            const humi = req.body.humi as number;
            const co2 = req.body.co2 as number;
            const weigh = req.body.weigh as number;
            if (temp === undefined || temp === null || 
                humi === undefined || humi === null || 
                co2 === undefined || co2 === null || 
                weigh === undefined || weigh === null) {
                // #swagger.responses[400] = { description: 'Missing required fields' }
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }
            const sensorData: SensorData[] = [{
                id : 1, // autoIncrement 값이라 아무거나 입력
                device_id: id,
                time: timestamp,
                temp: temp,
                humi: humi,
                co2: co2,
                weigh: weigh
            }];
            await handleSensorData(sensorData);
            // #swagger.responses[200] = { description: 'Sensor data uploaded successfully' }
            res.status(200).json({ message: 'Sensor data uploaded successfully' });
            return;
        } else if (type == 1) {
            const picture = req.body.picture as string;
            if (picture === undefined || picture === null) {
                // #swagger.responses[400] = { description: 'Missing required fields' }
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }
            const cameraData: CameraData[] = [{
                id : 1, // autoIncrement 값이라 아무거나 입력
                device_id: id,
                time: timestamp,
                picture: picture
            }];
            await handleCameraData(cameraData);
            // #swagger.responses[200] = { description: 'Camera data uploaded successfully' }
            res.status(200).json({ message: 'Camera data uploaded successfully' });
            return;
        } else {
            // #swagger.responses[400] = { description: 'Invalid type' }
            res.status(400).json({ error: 'Invalid type' });
            return;
        }
    } catch (error) {
        console.error('Error uploading data:', error);
        // #swagger.responses[500] = { description: 'Failed to upload data' }
        res.status(500).json({ error: 'Failed to upload data' });
        return;
    }
});

router.post('/upload', upload.any(), async (req: Request, res: Response) => {
    // #swagger.tags = ['Data']
    // #swagger.description = 'Endpoint to upload files or sensor data'

    try {
        const type = req.body.type as number;

        if (type === undefined || type === null) {
            // #swagger.responses[400] = { description: 'Missing required fields' }
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        let data: any[] = [];

        if (req.is('multipart/form-data')) {
            const files = req.files as Express.Multer.File[];

            if (!files || files.length === 0) {
                // #swagger.responses[400] = { description: 'Missing file data' }
                res.status(400).json({ error: 'Missing file data' });
                return;
            }

            const metadata = files.map((file, index) => ({
                id: parseInt(req.body[`file${index + 1}_id`]),
                time: (req.body[`file${index + 1}_time`] as string)?.replace('T', ' ').replace('Z', ''),
                picture: file.buffer
            }));

            if (metadata.some(item => !item.id || !item.time || !item.picture)) {
                // #swagger.responses[400] = { description: 'Missing required metadata fields' }
                res.status(400).json({ error: 'Missing required metadata fields' });
                return;
            }

            data = metadata;
        } else if (req.is('application/json')) {
            const bodyData = req.body.data;

            if (!Array.isArray(bodyData) || bodyData.length === 0) {
                // #swagger.responses[400] = { description: 'Missing or invalid JSON data' }
                res.status(400).json({ error: 'Missing or invalid JSON data' });
                return;
            }

            data = bodyData.map((item: any) => ({
                ...item,
                time: item.time?.replace('T', ' ').replace('Z', '')
            }));
        } else {
            // #swagger.responses[400] = { description: 'Unsupported content type' }
            res.status(400).json({ error: 'Unsupported content type' });
            return;
        }

        // IP 업데이트
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const uniqueIds = [...new Set(data.map(d => d.id))];

        for (const id of uniqueIds) {
            await updateDevice(id, undefined, ip as string);
        }

        // DB에 저장
        // (1, 'CAMERA'),
        // (2, 'SENSOR'),
        // (3, 'INOUT')

        if (type === 3) {
            await handleInOutData(data);
            // #swagger.responses[200] = { description: 'Inout data uploaded successfully' }
            res.status(200).json({ message: 'Inout data uploaded successfully' });
            return;
        } else if (type === 2) {
            await handleSensorData(data);
            // #swagger.responses[200] = { description: 'Sensor data uploaded successfully' }
            res.status(200).json({ message: 'Sensor data uploaded successfully' });
            return;
        } else if (type === 1) {
            await handleCameraData(data);
            // #swagger.responses[200] = { description: 'Camera data uploaded successfully' }
            res.status(200).json({ message: 'Camera data uploaded successfully' });
            return;
        } else {
            // #swagger.responses[400] = { description: 'Invalid type' }
            res.status(400).json({ error: 'Invalid type' });
            return;
        }
    } catch (error) {
        console.error('Error uploading data:', error);
        // #swagger.responses[500] = { description: 'Failed to upload data' }
        res.status(500).json({ error: 'Failed to upload data' });
        return;
    }
});

export default router;