import express, { Request, Response } from 'express';
import { getDeviceByDeviceId, getDevicesByHiveId, addDevice, updateDevice, deleteDevice } from '../db/device';
import { Device } from '../types';

const router = express.Router();
router.use(express.json());

router.get('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Device']
    // #swagger.description = 'Endpoint to fetch all devices or devices by Hive ID or Device ID'
    try {
        // #swagger.parameters['hiveId'] = { description: 'Hive ID', required: false}
        const hiveId = req.query.hiveId as string;
        // #swagger.parameters['deviceId'] = { description: 'Device ID like ( 13,21,33 or 22 )', required: false}
        const deviceId = req.query.deviceId as string;

        // 둘다 없으면
        if ((hiveId === undefined || hiveId === null) && (deviceId === undefined || deviceId === null)) {
            // #swagger.responses[400] = { description: 'Missing required fields' }
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        let devices: Device[] = [];
        if (hiveId != undefined && hiveId != null) {
            devices.push(...await getDevicesByHiveId(parseInt(hiveId)));
        }
        if (deviceId != undefined && deviceId != null) {
            // deviceId ,로 구성된 배열일 수 있음
            let queryDeviceId: number[] = [];
            if (deviceId.includes(',')) {
                queryDeviceId = deviceId.split(',').map(Number);
            } else {
                queryDeviceId = [parseInt(deviceId)];
            }

            const queryDevices = await getDeviceByDeviceId(queryDeviceId);
            // 중복되지 않는지 확인하고 추가
            for (const device of queryDevices) {
                const index = devices.findIndex((d) => d.id === device.id);
                if (index === -1) {
                    devices.push(device);
                }
            }
        }

        if (devices.length !== 0) {
            // #swagger.responses[200] = { description: 'Devices fetched successfully' }
            res.status(200).json(devices);
            return;
        }

        // #swagger.responses[404] = { description: 'No devices found' }
        res.status(404).json({ error: 'No devices found' });
        return;
    } catch (error) {
        console.error('Error fetching devices:', error);
        // #swagger.responses[500] = { description: 'Failed to fetch devices' }
        res.status(500).json({ error: 'Failed to fetch devices' });
        return;
    }
});

router.post('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Device']
    // #swagger.description = 'Endpoint to create a new device'
    try {
        /*  #swagger.parameters['body'] = {
                in: 'body',
                required: true,
                schema: {
                    name: "Device 1",
                    hiveId: 1,
                    typeId: 3
                }
        } */
        const name = req.body.name as string;
        const hiveId = req.body.hiveId as number;
        const typeId = req.body.typeId as number;

        // body application/json로 설정하고 필수 필드 있는지 확인

        if (!name || !hiveId || !typeId) {
            // #swagger.responses[400] = { description: 'Missing required fields' }
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        const { existing, deviceId } = await addDevice(name, hiveId, typeId);
        if (existing) {
            // #swagger.responses[200] = { description: 'Device already exists' }
            res.status(200).json({ message: 'Device already exists', deviceId });
            return;
        }

        // #swagger.responses[201] = { description: 'Device created successfully' }
        res.status(201).json({ message: 'Device created successfully', deviceId });
        return;
    } catch (error) {
        console.error('Error creating device:', error);
        // #swagger.responses[500] = { description: 'Failed to create device' }
        res.status(500).json({ error: 'Failed to create device' });
    }
});

router.put('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Device']
    // #swagger.description = 'Endpoint to update a device'
    try {
        /*  #swagger.parameters['body'] = {
                in: 'body',
                required: true,
                schema: {
                    deviceId: 7,
                    name: "Device 2"
                }
        } */
        const deviceId = req.body.deviceId as number;
        const name = req.body.name as string;

        if (deviceId === undefined || deviceId === null) {
            // #swagger.responses[400] = { description: 'Missing required fields' }
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        if (name === undefined || name === null) {
            // #swagger.responses[400] = { description: 'No fields to update' }
            res.status(400).json({ error: 'No fields to update' });
            return;
        }

        const { updated } = await updateDevice(deviceId, name);
        if(updated) {
            // #swagger.responses[200] = { description: 'Device updated successfully' }
            res.status(200).json({ message: 'Device updated successfully', deviceId });
            return;
        }

        // #swagger.responses[404] = { description: 'Updateble Device not found' }
        res.status(404).json({ error: 'Updateble Device not found' });
        return;
    } catch (error) {
        console.error('Error updating device:', error);
        // #swagger.responses[500] = { description: 'Failed to update device' }
        res.status(500).json({ error: 'Failed to update device' });
    }
});

router.delete('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Device']
    // #swagger.description = 'Endpoint to delete a device'
    try {
        // #swagger.parameters['deviceId'] = { description: 'Device ID', required: true}
        const deviceId = req.query.deviceId as string;

        if (deviceId === undefined || deviceId === null) {
            // #swagger.responses[400] = { description: 'Missing required fields' }
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const { deleted } = await deleteDevice(parseInt(deviceId));
        if(deleted) {
            // #swagger.responses[200] = { description: 'Device deleted successfully' }
            res.status(200).json({ message: 'Device deleted successfully', deviceId });
            return;
        }
        
        // #swagger.responses[404] = { description: 'Deletable device not found' }
        res.status(404).json({ error: 'Deletable device not found' });
        return;
    } catch (error) {
        console.error('Error deleting device:', error);
        // #swagger.responses[500] = { description: 'Failed to delete device' }
        res.status(500).json({ error: 'Failed to delete device' });
    }
});

export default router;
