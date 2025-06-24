// routes/picture.ts
import express, { Request, Response } from 'express';
import multer from 'multer';
import { getPictureData, insertPictureData } from '../db/picture';
import { PictureDataInsert } from '../types';

const router = express.Router();
const upload = multer();

// 모든 JSON 바디 파싱
router.use(express.json());

router.get('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Picture']
    // #swagger.description = 'Fetch picture data by device and time range'
    // #swagger.parameters['deviceId'] = { description: 'Device ID', required: true }
    // #swagger.parameters['sTime'] = { description: 'Start time (ISO 8601, e.g. 2025-05-04T14:13:00Z)', required: true }
    // #swagger.parameters['eTime'] = { description: 'End time (ISO 8601, e.g. 2025-05-11T14:13:00Z)', required: true }
    const deviceId = parseInt(req.query.deviceId as string);
    const sTime = req.query.sTime as string;
    const eTime = req.query.eTime as string;
    
    console.log(req.query);

    if (!deviceId || !sTime || !eTime) {
        res.status(400).json({ error: 'Missing required query parameters' });
        return;
    }

    try {
        const rows = await getPictureData(deviceId, sTime, eTime);
        console.log(rows);
        const result = rows.map(r => {
        const utcDate = new Date(r.time + 'Z'); // 문자열을 UTC로 인식
        return {
                device_id: r.device_id,
                time: utcDate.toISOString(), // ISO 8601 형식 (e.g. 2025-06-24T04:00:00.000Z)
                picture: r.picture.toString('base64')
            };
        });

        if (!result.length) {
            res.status(404).json({ error: 'No picture data found' });
            return;
        }
        res.status(200).json(result);
    } catch (err) {
        console.error('GET /api/picture error:', err);
        res.status(500).json({ error: 'Failed to fetch picture data' });
    }
});

/**
 * POST /api/picture/upload
 * Supports:
 *   • multipart/form-data:
 *       fields: file1, file2, … (binary)
 *       metadata: file1_id, file1_time, …
 *   • application/json:
 *       { data: [ { device_id, time?, picture: base64 }, … ] }
 *
 * #swagger.tags = ['Picture']
 * #swagger.description = 'Upload one or more pictures (multipart or JSON)' 
 */
router.post('/upload', upload.any(), async (req: Request, res: Response) => {
    try {
        let rows = [] as {
            device_id: number;
            time: string;
            picture: Buffer;
        }[];

        // 1) multipart/form-data 처리
        if (req.is('multipart/form-data')) {
            const files = req.files as Express.Multer.File[];
            const pics = files.filter(f => f.fieldname.startsWith('file'));

            const meta = pics.map((file, i) => ({
                id: req.body[`file${i + 1}_id`],
                time: req.body[`file${i + 1}_time`],
                buf: file.buffer
            }));
            if (!meta.length || meta.some(m => !m.id || !m.time)) {
                res.status(400).send('Bad Request: Missing required fields or data');
                return;
            }

            rows = meta.map(m => ({
                device_id: parseInt(m.id, 10),
                time: m.time.replace('T', ' ').replace('Z', ''),
                picture: m.buf
            }));
        }
        // 2) JSON payload 처리
        else if (req.is('application/json')) {
            const body = req.body;
            if (!Array.isArray(body.data) || !body.data.length) {
                res.status(400).send('Bad Request: Missing required fields or data');
                return;
            }
            rows = body.data.map((item: any) => ({
                device_id: item.device_id,
                time: (item.time as string)?.replace('T', ' ').replace('Z', '')
                    ?? new Date().toISOString().slice(0, 19).replace('T', ' '),
                picture: Buffer.from(item.picture, 'base64')
            }));
        }
        else {
            res.status(400).send('Bad Request: Unsupported content type');
            return;
        }

        // DB에 삽입
        const toInsert: PictureDataInsert[] = rows;
        await insertPictureData(toInsert);

        res.status(201).json({ message: 'Picture data uploaded successfully' });
    } catch (err) {
        console.error('POST /api/picture/upload error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
