import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

import { getPictureData, insertPictureData } from '../db/picture';
import { PictureDataInsert } from '../types';

// EXIF reader
const ExifTool = require('node-exiftool');
const exiftoolBin = require('dist-exiftool');
const ep = new ExifTool.ExiftoolProcess(exiftoolBin);

const router = express.Router();
const upload = multer();
const PICTURE_DIR = '/app/db/picture';
const EXIF_TZ = process.env.EXIF_TZ || '+09:00'; // Asia/Seoul default

router.use(express.json());
ep.open();

const parseUploadTime = (raw: string): Date => {
    let d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
    if (!raw.endsWith('Z')) {
        d = new Date(`${raw}Z`);
        if (!Number.isNaN(d.getTime())) return d;
    }
    throw new Error(`Invalid time value: ${raw}`);
};

const parseExifTime = (exifRaw: string): Date | null => {
    // exifRaw example: "2025:11:30 09:00:00"
    try {
        const datePart = exifRaw.slice(0, 10).replace(/:/g, '-');
        const timePart = exifRaw.slice(11);
        const iso = `${datePart}T${timePart}${EXIF_TZ}`;
        const d = new Date(iso);
        if (!Number.isNaN(d.getTime())) return d;
    } catch {
        // ignore
    }
    return null;
};

const extractExifTime = async (filePath: string): Promise<string | null> => {
    try {
        const { data } = await ep.readMetadata(filePath);
        const meta = data[0] || {};
        const exifRaw = meta.DateTimeOriginal;
        if (typeof exifRaw === 'string') {
            return exifRaw;
        }
    } catch (e) {
        console.warn('EXIF read failed:', e);
    }
    return null;
};

const saveImage = async (deviceId: number, uploadTime: string | undefined, buffer: Buffer): Promise<PictureDataInsert> => {
    const deviceFolder = `device_${deviceId}`;
    const deviceDir = path.join(PICTURE_DIR, deviceFolder);
    await fs.mkdir(deviceDir, { recursive: true });

    const timestamp = Date.now();
    const tempFilename = `temp_${timestamp}.jpg`;
    const tempPath = path.join(deviceDir, tempFilename);
    await fs.writeFile(tempPath, buffer);

    const exifRaw = await extractExifTime(tempPath);

    let timeObj: Date;
    if (exifRaw) {
        const exifParsed = parseExifTime(exifRaw);
        if (!exifParsed) {
            throw new Error(`Invalid EXIF time: ${exifRaw}`);
        }
        timeObj = exifParsed;
    } else if (uploadTime) {
        timeObj = parseUploadTime(uploadTime);
    } else {
        throw new Error("Missing time and EXIF metadata");
    }

    const formatted = timeObj.toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
    const finalFilename = `${formatted}Z.jpg`;
    const finalThumb = `${formatted}Z_thumb.jpg`;

    const finalPath = path.join(deviceDir, finalFilename);
    const thumbPath = path.join(deviceDir, finalThumb);

    await fs.rename(tempPath, finalPath);

    await sharp(buffer)
        .resize({ width: 320 })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);

    return {
        device_id: deviceId,
        time: timeObj.toISOString().replace('T', ' ').replace('Z', ''),
        path: path.join(deviceFolder, finalFilename),
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
            path: r.path,
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
            if (body.data.length === 0) {
                res.status(400).send('Empty "data" array');
                return;
            }

            for (const item of body.data) {
                const deviceId = item.device_id;
                const time = item.time as string | undefined;
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
