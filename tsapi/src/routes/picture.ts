import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

import { getPictureData, insertPictureData } from '../db/picture';
import { PictureDataInsert } from '../types';

const router = express.Router();
const upload = multer();
const PICTURE_DIR = '/app/db/picture';

router.use(express.json());

const parseToUTC = (time: string): Date => {
    return time.endsWith('Z')
        ? new Date(time) // UTC 입력
        : new Date(time + getLocalOffset()); // 로컬 입력 → UTC로 변환
};

function getLocalOffset(): string {
    const offset = new Date().getTimezoneOffset(); // 분 단위
    const abs = Math.abs(offset);
    const sign = offset <= 0 ? '+' : '-';
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `${sign}${hh}:${mm}`;
}

const saveImage = async (deviceId: number, time: string, buffer: Buffer): Promise<PictureDataInsert> => {
    const timeObj = parseToUTC(time); // ✅ 항상 UTC Date로 변환
    const formatted = timeObj.toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
    const filename = `${formatted}Z.jpg`;
    const thumbname = `${formatted}Z_thumb.jpg`;

    const deviceFolder = `device_${deviceId}`;
    const devicePath = path.join(PICTURE_DIR, deviceFolder);
    await fs.mkdir(devicePath, { recursive: true });

    await fs.writeFile(path.join(devicePath, filename), buffer);
    await sharp(buffer)
        .resize({ width: 320 })
        .jpeg({ quality: 80 })
        .toFile(path.join(devicePath, thumbname));

    return {
        device_id: deviceId,
        time: timeObj.toISOString().replace('T', ' ').replace('Z', ''), // DB 저장: UTC, Z 제거된 포맷
        path: path.join(deviceFolder, filename)
    };
};

/* GET /api/picture */
router.get('/', async (req: Request, res: Response) => {
    // #swagger.tags = ['Picture']
    // #swagger.description = 'Fetch pictures for a device within a time range'
    // #swagger.parameters['deviceId'] = { in: 'query', required: true, type: 'integer' }
    // #swagger.parameters['sTime'] = { in: 'query', required: true, type: 'string', format: 'date-time' }
    // #swagger.parameters['eTime'] = { in: 'query', required: true, type: 'string', format: 'date-time' }

    const deviceId = parseInt(req.query.deviceId as string, 10);
    const rawSTime = req.query.sTime as string;
    const rawETime = req.query.eTime as string;

    if (isNaN(deviceId) || !rawSTime || !rawETime) {
        res.status(400).json({ error: 'Invalid query parameters' });
        return;
    }

    const sTime = rawSTime.replace('T', ' ').replace('Z', '');
    const eTime = rawETime.replace('T', ' ').replace('Z', '');

    try {
        const rows = await getPictureData(deviceId, sTime, eTime);
        if (!rows.length) {
            res.status(404).json({ error: 'No picture data found' });
            return;
        }

        const result = rows.map(r => ({
            device_id: r.device_id,
            time: new Date(r.time + 'Z').toISOString(),
            path: r.path
        }));

        res.status(200).json(result);
    } catch (err) {
        console.error('GET /api/picture error:', err);
        res.status(500).json({ error: 'Failed to fetch picture data' });
    }
});

/* POST /api/picture/upload */
router.post('/upload', upload.any(), async (req: Request, res: Response) => {
    // #swagger.tags = ['Picture']
    // #swagger.description = 'Upload one or more pictures (JSON or multipart/form-data)'
    // #swagger.requestBody = {
    //   content: {
    //     "application/json": {
    //       schema: {
    //         type: "object",
    //         properties: {
    //           data: {
    //             type: "array",
    //             items: {
    //               type: "object",
    //               properties: {
    //                 device_id: { type: "integer" },
    //                 time: { type: "string", format: "date-time" },
    //                 picture: { type: "string", format: "base64" }
    //               }
    //             }
    //           }
    //         }
    //       }
    //     },
    //     "multipart/form-data": {
    //       schema: {
    //         type: "object",
    //         properties: {
    //           file1: { type: "string", format: "binary" },
    //           file1_id: { type: "integer" },
    //           file1_time: { type: "string", format: "date-time" }
    //         }
    //       }
    //     }
    //   }
    // }
    // #swagger.responses[201] = { description: 'Upload successful' }
    // #swagger.responses[400] = { description: 'Bad request' }

    try {
        const toInsert: PictureDataInsert[] = [];

        if (req.is('multipart/form-data')) {
            const files = req.files as Express.Multer.File[];
            for (let i = 0; i < files.length; i++) {
                const buffer = files[i].buffer;
                const idField = req.body[`file${i + 1}_id`];
                const timeField = req.body[`file${i + 1}_time`];

                if (!idField || !timeField) {
                    res.status(400).send('Missing metadata for file upload');
                    return;
                }

                const deviceId = parseInt(idField, 10);
                const meta = await saveImage(deviceId, timeField, buffer);
                toInsert.push(meta);
            }
        } else if (req.is('application/json')) {
            const body = req.body;
            if (!Array.isArray(body.data)) {
                res.status(400).send('Missing "data" array');
                return;
            }

            for (const item of body.data) {
                const deviceId = item.device_id;
                const time = item.time ?? new Date().toISOString();
                const buffer = Buffer.from(item.picture, 'base64');
                const meta = await saveImage(deviceId, time, buffer);
                toInsert.push(meta);
            }
        } else {
            res.status(400).send('Unsupported Content-Type');
            return;
        }

        await insertPictureData(toInsert);
        res.status(201).json({ message: 'Pictures uploaded successfully' });
    } catch (err) {
        console.error('POST /api/picture/upload error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
