import express, { Request, Response } from 'express';
import { getAreaByAreaId, getAreas, addArea } from '../db/area';
import { Area } from '../types';

const router = express.Router();
router.use(express.json());

router.get('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Area']
    // #swagger.description = 'Endpoint to fetch all areas or areas by Area ID'
    try {
        // #swagger.parameters['areaId'] = { description: 'Area ID like ( 13,21,33 or 22 )', required: false}
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
    // #swagger.description = 'Endpoint to add an area'
    try {
        /* #swagger.parameters['body'] = {
                id: 'body',
                required: true,
                scheme:   {
                    "id": 5,
                    "area_id": 1,
                    "name": "Hive 5"
                }
    }
}
    

export default router;


// export const addHive = async (
//     name: string,
//     areaId: number
// ): Promise<{ existing: boolean, hiveId: number }> => {
//     try {
//         // Check for existing hive
//         const checkQuery = 'SELECT id FROM hives WHERE area_id = ? AND name = ?';
//         const [checkResults] = await pool.execute(checkQuery, [areaId, name]);
        
//         const hives_check = checkResults as Hive[];
//         if (hives_check.length > 0) {
//             console.log(`Hive already exists: ${hives_check[0].id} (name: ${name}, area: ${areaId})`);
//             return { existing: true, hiveId: hives_check[0].id };
//         }

//         // Insert new hive
//         const insertQuery = 'INSERT INTO hives (area_id, name) VALUES (?, ?)';
//         const [insertResults] = await pool.execute(insertQuery, [areaId, name]);
//         const affectedRows = (insertResults as ResultSetHeader).affectedRows;
//         if (affectedRows != 1) {
//             throw new Error('Failed to insert hive');
//         }
//         const insertId = (insertResults as ResultSetHeader).insertId;
//         console.log(`Inserted hive: ${insertId} (name: ${name}, area: ${areaId})`);
//         return { existing: false, hiveId: insertId };
//     } catch (error) {
//         throw error;
//     }
// }


// app.post('/api/area', async (req, res) => {
//     const { name, location } = req.body;
//     if (!name) {
//       return res.status(400).send('Bad Request: Missing required fields');
//     }
  
//     try {
//       const result = await database.addArea(dbConnection, name, location);
//       if(result.existing) {
//         return res.status(409).json({message: 'Area already exists', areaId: result.areaId});
//       } else {
//         return res.status(201).json({message: 'Area added successfully', areaId: result.areaId});
//       }
//     } catch (error) {
//       console.error('Error adding area:', error);
//       return res.status(500).send('Internal Server Error');
//     }
//   });
  