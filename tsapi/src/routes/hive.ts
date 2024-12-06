import express, { Request, Response } from 'express';
import { getHiveByHiveId, getHivesByAreaId } from '../db/hive';
// import { Hive } from '../types';

const router = express.Router();
router.use(express.json());

router.get('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Hive']
    // #swagger.description = 'Endpoint to fetch all hives or hives by Hive ID or Area ID'
    try {
        // areaId와 hiveId 쿼리 파라미터를 가져옴
        const areaId = req.query.areaId as string;
        const hiveId = req.query.hiveId as string;

        let hives: any[] = [];
        if (areaId != undefined && areaId != null) {
            hives.push(...await getHivesByAreaId(parseInt(areaId)));
        }
        if (hiveId != undefined && hiveId != null) {
            // 중복되지 않는지 확인하고 추가
            const index = hives.findIndex((hive) => hive.id === parseInt(hiveId));
            if (index === -1) {
                hives.push(...await getHiveByHiveId(parseInt(hiveId)));
            }
        }



        if (hives.length !== 0) {
            // #swagger.responses[200] = { description: 'Hives fetched successfully' }
            res.status(200).json(hives);
            return;
        }

        // #swagger.responses[404] = { description: 'No hives found' }
        res.status(404).json({ error: 'No hives found' });
        return;
    } catch (error) {
        console.error('Error fetching hives:', error);
        // #swagger.responses[500] = { description: 'Failed to fetch hives' }
        res.status(500).json({ error: 'Failed to fetch hives' });
        return;
    }
});


export default router;

// import express, { Request, Response } from 'express';
// import { getDeviceByDeviceId, getDevicesByHiveId, addDevice, updateDevice, deleteDevice } from '../db/device';
// import { Device } from '../types';

// const router = express.Router();
// router.use(express.json());

// router.get('/', async (req: Request, res: Response) => {
//     // #swagger.tags = ['Devices']
//     // #swagger.description = 'Endpoint to fetch all devices or devices by Hive ID or Device ID'
//     try {
//         // hiveId와 deviceId 쿼리 파라미터를 가져옴
//         const hiveId = req.query.hiveId as string;
//         const deviceId = req.query.deviceId as string;

//         let devices: Device[] = [];
//         if (hiveId != undefined && hiveId != null) {
//             devices.push(...await getDevicesByHiveId(parseInt(hiveId)));
//         }
//         if (deviceId != undefined && deviceId != null) {
//             // deviceId ,로 구성된 배열일 수 있음
//             let queryDeviceId: number[] = [];
//             if (deviceId.includes(',')) {
//                 queryDeviceId = deviceId.split(',').map(Number);
//             } else {
//                 queryDeviceId = [parseInt(deviceId)];
//             }
//             // 중복되지 않는지 확인하고 추가
//             const index = devices.findIndex((device) => queryDeviceId.includes(device.id));
//             if (index === -1) {
//                 devices.push(...await getDeviceByDeviceId(queryDeviceId));
//             }
//         }

//         if (devices.length !== 0) {
//             // #swagger.responses[200] = { description: 'Devices fetched successfully' }
//             res.status(200).json(devices);
//             return;
//         }

//         // #swagger.responses[404] = { description: 'No devices found' }
//         res.status(404).json({ error: 'No devices found' });
//         return;
//     } catch (error) {
//         console.error('Error fetching devices:', error);
//         // #swagger.responses[500] = { description: 'Failed to fetch devices' }
//         res.status(500).json({ error: 'Failed to fetch devices' });
//         return;
//     }
// });

// router.post('/', async (req: Request, res: Response) => {
//     // #swagger.tags = ['Devices']
//     // #swagger.description = 'Endpoint to create a new device'
//     try {
//         const name = req.body.name as string;
//         const hiveId = req.body.hive_id as number;
//         const typeId = req.body.type_id as number;

//         if (!name || !hiveId || !typeId) {
//             // #swagger.responses[400] = { description: 'Missing required fields' }
//             res.status(400).json({ error: 'Missing required fields' });
//             return;
//         }
//         const { existing, deviceId } = await addDevice(name, hiveId, typeId);
//         if (existing) {
//             // #swagger.responses[200] = { description: 'Device already exists' }
//             res.status(200).json({ message: 'Device already exists', deviceId });
//             return;
//         } else {
//             // #swagger.responses[201] = { description: 'Device created successfully' }
//             res.status(201).json({ message: 'Device created successfully', deviceId });
//             return;
//         }
//     } catch (error) {
//         console.error('Error creating device:', error);
//         // #swagger.responses[500] = { description: 'Failed to create device' }
//         res.status(500).json({ error: 'Failed to create device' });
//     }
// });

// router.put('/', async (req: Request, res: Response) => {
//     // #swagger.tags = ['Devices']
//     // #swagger.description = 'Endpoint to update a device'
//     try {
//         const deviceId = req.body.deviceId as number;
//         const name = req.body.name as string;

//         if (deviceId === undefined || deviceId === null) {
//             // #swagger.responses[400] = { description: 'Missing required fields' }
//             res.status(400).json({ error: 'Missing required fields' });
//             return;
//         }

//         if (name === undefined || name === null) {
//             // #swagger.responses[400] = { description: 'No fields to update' }
//             res.status(400).json({ error: 'No fields to update' });
//             return;
//         }

//         const { updated } = await updateDevice(deviceId, name);
//         if(updated) {
//             // #swagger.responses[200] = { description: 'Device updated successfully' }
//             res.status(200).json({ message: 'Device updated successfully', deviceId });
//             return;
//         }

//         // #swagger.responses[404] = { description: 'Updateble Device not found' }
//         res.status(404).json({ error: 'Updateble Device not found' });
//         return;
//     } catch (error) {
//         console.error('Error updating device:', error);
//         // #swagger.responses[500] = { description: 'Failed to update device' }
//         res.status(500).json({ error: 'Failed to update device' });
//     }
// });

// router.delete('/', async (req: Request, res: Response) => {
//     // #swagger.tags = ['Devices']
//     // #swagger.description = 'Endpoint to delete a device'
//     try {
//         const deviceId = req.body.deviceId as number;

//         if (deviceId === undefined || deviceId === null) {
//             // #swagger.responses[400] = { description: 'Missing required fields' }
//             res.status(400).json({ error: 'Missing required fields' });
//             return;
//         }

//         const { deleted } = await deleteDevice(deviceId);
//         if(deleted) {
//             // #swagger.responses[200] = { description: 'Device deleted successfully' }
//             res.status(200).json({ message: 'Device deleted successfully', deviceId });
//             return;
//         }
        
//         // #swagger.responses[404] = { description: 'Deletable device not found' }
//         res.status(404).json({ error: 'Deletable device not found' });
//         return;
//     } catch (error) {
//         console.error('Error deleting device:', error);
//         // #swagger.responses[500] = { description: 'Failed to delete device' }
//         res.status(500).json({ error: 'Failed to delete device' });
//     }
// });

// export default router;


// // =============================
// // HIVE
// // =============================
// app.get('/api/hive', async (req, res) => {
//     const { areaId, hiveId } = req.query;
  
//     // areaId와 hiveId가 모두 없을 때 에러 처리
//     if (!areaId && !hiveId) {
//       return res.status(400).send('Bad Request: Missing areaId or hiveId');
//     }
  
//     try {
//       let hives;
  
//       // hiveId가 있으면 해당 hiveId로 검색
//       if (hiveId) {
//         hives = await database.getHiveByHiveId(dbConnection, hiveId.split(','));
//       } else {
//         // hiveId가 없으면 areaId로 검색
//         hives = await database.getHivesByAreaId(dbConnection, areaId);
//       }
  
//       return res.status(200).json(hives);
//     } catch (error) {
//       console.error('Error fetching hives:', error);
//       return res.status(500).send('Internal Server Error');
//     }
//   });
  