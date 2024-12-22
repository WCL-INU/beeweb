import express, { Request, Response } from 'express';
import { getAreaByAreaId, getAreas, addArea, updateArea, deleteArea } from '../db/area';
import { Area } from '../types';

const router = express.Router();
router.use(express.json());

router.get('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Area']
    // #swagger.description = 'Endpoint to fetch all areas or areas by Area ID'
    try {
        // #swagger.parameters['areaId'] = { description: 'Area ID like ( 13,21,33 or 22 or Undefined)', required: false}
        const areaId = req.query.areaId as string;

        // Area ID가 없으면 전체 검색
        let areas: Area[] = [];
        if (areaId === undefined || areaId === null) {
            areas = await getAreas();
        } else { // 있으면 해당 ID로 검색
            // areaId는 ,로 구성된 배열일 수 있음
            let queryAreaId: number[] = [];
            if (areaId.includes(',')) {
                queryAreaId = areaId.split(',').map(Number);
            } else {
                queryAreaId = [parseInt(areaId)];
            }
            areas = await getAreaByAreaId(queryAreaId);
        }

        if (areas.length !== 0) {
            // #swagger.responses[200] = { description: 'Areas fetched successfully' }
            res.status(200).json(areas);
            return;
        }

        // #swagger.responses[404] = { description: 'No areas found' }
        res.status(404).json({ error: 'No areas found' });
        return;
    } catch (error) {
        console.error('Error fetching areas:', error);
        // #swagger.responses[500] = { description: 'Failed to fetch areas' }
        res.status(500).json({ error: 'Failed to fetch areas' });
        return;
    }
});

router.post('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Area']
    // #swagger.description = 'Endpoint to add a new area'
    try {
        /* #swagger.parameters['body'] = {
            in: 'body',
            required: true,
            schema: {
                $name: '테스트',
                $location: '37.375, 126.633'
            }
        }*/
        const name = req.body.name as string;
        const location = req.body.location as string;

        if (!name) {
            // #swagger.responses[400] = { description: 'Bad Request: Missing required fields' }
            res.status(400).json({ error: 'Bad Request: Missing required fields' });
            return;
        }
        const { existing, areaId } = await addArea(name, location);
        if (existing) {
            // #swagger.responses[409] = { description: 'Area already exists' }
            res.status(409).json({ message: 'Area already exists', areaId });
        }
        // #swagger.responses[201] = { description: 'Area added successfully' }
        res.status(201).json({ message: 'Area added successfully', areaId });
        return;
    } catch (error) {
        console.error('Error adding area:', error);
        // #swagger.responses[500] = { description: 'Failed to add area' }
        res.status(500).json({ error: 'Failed to add area' });
        return;
    }
});

router.put('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Area']
    // #swagger.description = 'Endpoint to update an area'
    try {
        /* #swagger.parameters['body'] = {
            in: 'body',
            required: true,
            schema: {
                $areaId: 4,
                $name: '테스트2',
                $location: '99.375, 999.633'
            }
        }*/
        const areaId = req.body.areaId as number;
        const name = req.body.name as string;
        const location = req.body.location as string;

        if (!areaId) {
            // #swagger.responses[400] = { description: 'Bad Request: Missing required fields' }
            res.status(400).json({ error: 'Bad Request: Missing required fields' });
            return;
        }

        const updated = await updateArea(areaId, name, location);
        if (updated) {
            // #swagger.responses[200] = { description: 'Area updated successfully' }
            res.status(200).json({ message: 'Area updated successfully', areaId });
            return;
        }

        // #swagger.responses[404] = { description: 'Area not found' }
        res.status(404).json({ error: 'Area not found' });
        return;
    } catch (error) {
        console.error('Error updating area:', error);
        // #swagger.responses[500] = { description: 'Failed to update area' }
        res.status(500).json({ error: 'Failed to update area' });
        return;
    }
});

router.delete('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Area']
    // #swagger.description = 'Endpoint to delete an area'
    try {
        // #swagger.parameters['areaId'] = { description: 'Area ID', required: true}
        const areaId = req.query.areaId as string;

        if (areaId === undefined || areaId === null) {
            // #swagger.responses[400] = { description: 'Bad Request: Missing required fields' }
            res.status(400).json({ error: 'Bad Request: Missing required fields' });
            return;
        }

        const { deleted } = await deleteArea(parseInt(areaId));
        if (deleted) {
            // #swagger.responses[200] = { description: 'Area deleted successfully' }
            res.status(200).json({ message: 'Area deleted successfully', areaId });
            return;
        }

        // #swagger.responses[404] = { description: 'Area not found' }
        res.status(404).json({ error: 'Area not found' });
        return;
    } catch (error) {
        console.error('Error deleting area:', error);
        // #swagger.responses[500] = { description: 'Failed to delete area' }
        res.status(500).json({ error: 'Failed to delete area' });
        return;
    }
});

export default router;