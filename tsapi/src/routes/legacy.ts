import express, { Request, Response } from 'express';
import { getAreaHives } from '../db/legacy';

const router = express.Router();
router.use(express.json());

router.get('/areahive', async (req: Request, res: Response) => {
    // #swagger.tags = ['Legacy']
    // #swagger.description = 'Endpoint to fetch all area hives'
    try {
        const areaHives = await getAreaHives();
        // #swagger.responses[200] = { description: 'Area hives fetched successfully' }
        res.status(200).json(areaHives);
    } catch (error) {
        console.error('Error fetching area hives:', error);
        // #swagger.responses[500] = { description: 'Failed to fetch area hives' }
        res.status(500).json({ error: 'Failed to fetch area hives' });
    }
});

// router.get('/inout', async (req: Request, res: Response) => {
//     // #swagger.tags = ['Legacy']
//     // #swagger.description = 'Endpoint to fetch inout data'
//     try {


export default router;