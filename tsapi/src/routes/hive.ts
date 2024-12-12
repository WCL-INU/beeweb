import express, { Request, Response } from 'express';
import { getHiveByHiveId, getHivesByAreaId, addHive, updateHive, deleteHive } from '../db/hive';
import { Hive } from '../types';

const router = express.Router();
router.use(express.json());

router.get('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Hive']
    // #swagger.description = 'Endpoint to fetch all hives or hives by Hive ID or Area ID'
    try {
        // #swagger.parameters['areaId'] = { description: 'Area ID', required: false}
        const areaId = req.query.areaId as string;
        // #swagger.parameters['hiveId'] = { description: 'Hive ID like ( 13,21,33 or 22 )', required: false}
        const hiveId = req.query.hiveId as string;

        // 둘다 없으면
        if ((areaId === undefined || areaId === null) && (hiveId === undefined || hiveId === null)) {
            // #swagger.responses[400] = { description: 'Missing required fields' }
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        let hives: Hive[] = [];
        if (areaId != undefined && areaId != null) {
            hives.push(...await getHivesByAreaId(parseInt(areaId)));
        }
        if (hiveId != undefined && hiveId != null) {
            // hiveId는 ,로 구성된 배열일 수 있음
            let queryHiveId: number[] = [];
            if (hiveId.includes(',')) {
                queryHiveId = hiveId.split(',').map(Number);
            } else {
                queryHiveId = [parseInt(hiveId)];
            }
            
            const queryHives = await getHiveByHiveId(queryHiveId);
            // 중복되지 않는지 확인하고 추가
            for (const hive of queryHives) {
                const index = hives.findIndex((h) => h.id === hive.id);
                if (index === -1) {
                    hives.push(hive);
                }
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

router.post('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Hive']
    // #swagger.description = 'Endpoint to create a new hive'
    try {
        /*  #swagger.parameters['body'] = {
                in: 'body',
                required: true,
                schema: {
                    $name: "Hive 10",
                    $areaId: 1
                }
        } */
        const name = req.body.name as string;
        const areaId = req.body.areaId as number;


        if (!name || !areaId) {
            // #swagger.responses[400] = { description: 'Missing required fields' }
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        const { existing, hiveId } = await addHive(name, areaId);
        if (existing) {
            // #swagger.responses[409] = { description: 'Hive already exists' }
            res.status(409).json({ message: 'Hive already exists', hiveId });
            return;
        }

        // #swagger.responses[201] = { description: 'Hive created successfully' }
        res.status(201).json({ message: 'Hive created successfully', hiveId });
        return;
    } catch (error) {
        console.error('Error creating hive:', error);
        // #swagger.responses[500] = { description: 'Failed to create hive' }
        res.status(500).json({ error: 'Failed to create hive' });
    }
});

router.put('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Hive']
    // #swagger.description = 'Endpoint to update a hive'
    try {
        /*  #swagger.parameters['body'] = {
                in: 'body',
                required: true,
                schema: {
                    hiveId: 7,
                    name: "Hive 20",
                    areaId: 2
                }
        } */
        const hiveId = req.body.hiveId as number;
        const name = req.body.name as string;
        const areaId = req.body.areaId as number;

        if (hiveId === undefined || hiveId === null) {
            // #swagger.responses[400] = { description: 'Missing required fields' }
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        if ((name === undefined || name === null) && (areaId === undefined || areaId === null)) {
            // #swagger.responses[400] = { description: 'No fields to update' }
            res.status(400).json({ error: 'No fields to update' });
            return;
        }

        const { updated } = await updateHive(hiveId, name, areaId);
        if(updated) {
            // #swagger.responses[200] = { description: 'Hive updated successfully' }
            res.status(200).json({ message: 'Hive updated successfully', hiveId });
            return;
        }

        // #swagger.responses[404] = { description: 'Updateble Hive not found' }
        res.status(404).json({ error: 'Updateble Hive not found' });
        return;
    } catch (error) {
        console.error('Error updating hive:', error);
        // #swagger.responses[500] = { description: 'Failed to update hive' }
        res.status(500).json({ error: 'Failed to update hive' });
    }
});

router.delete('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Hive']
    // #swagger.description = 'Endpoint to delete a hive'
    try {
        // #swagger.parameters['hiveId'] = { description: 'Hive ID', required: true}
        const hiveId = req.query.hiveId as string;

        if (hiveId === undefined || hiveId === null) {
            // #swagger.responses[400] = { description: 'Missing required fields' }
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const { deleted } = await deleteHive(parseInt(hiveId));
        if(deleted) {
            // #swagger.responses[200] = { description: 'Hive deleted successfully' }
            res.status(200).json({ message: 'Hive deleted successfully', hiveId });
            return;
        }
        
        // #swagger.responses[404] = { description: 'Deletable hive not found' }
        res.status(404).json({ error: 'Deletable hive not found' });
        return;
    } catch (error) {
        console.error('Error deleting hive:', error);
        // #swagger.responses[500] = { description: 'Failed to delete hive' }
        res.status(500).json({ error: 'Failed to delete hive' });
    }
});

export default router;