import { pool } from './index';
import { PictureDataInsert, PictureDataRow } from '../types';

const processPictureBatch = async (
    queryTemplate: string,
    data: PictureDataInsert[],
    batchSize: number
): Promise<number> => {
    let total = 0;
    let batch: PictureDataInsert[] = [];

    const insertBatch = async () => {
        if (!batch.length) return;

        const placeholders = batch.map(() => '(?, ?, ?)').join(', ');
        const fullQuery = queryTemplate.replace('VALUES (?, ?, ?)', `VALUES ${placeholders}`);
        const params = batch.flatMap(row => [row.device_id, row.time, row.path]);

        await pool.query(fullQuery, params);
        total += batch.length;
        batch = [];
    };

    for (const row of data) {
        batch.push(row);
        if (batch.length >= batchSize) {
            await insertBatch();
        }
    }

    if (batch.length) {
        await insertBatch();
    }

    return total;
};

export const insertPictureData = async (datas: PictureDataInsert[]): Promise<void> => {
    const batchSize = 1000;
    const query = `
        INSERT INTO picture_data (device_id, time, path)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          path = VALUES(path)
    `;

    const count = await processPictureBatch(query, datas, batchSize);
    console.log(`Inserted/Updated ${count} picture records`);
};

export const getPictureData = async (
    deviceId: number,
    sTime: string,
    eTime: string
): Promise<PictureDataRow[]> => {
    const query = `
        SELECT id, device_id, time, path
        FROM picture_data
        WHERE device_id = ?
          AND time BETWEEN ? AND ?
        ORDER BY time DESC
    `;
    const [rows] = await pool.execute(query, [deviceId, sTime, eTime]);
    return rows as PictureDataRow[];
};

export interface PictureExportRow extends PictureDataRow {
    device_name: string | null;
    hive_id: number | null;
    hive_name: string | null;
    time_utc: string;
}

export const getPictureDataBatch = async (
    deviceId: number,
    sTime: string,
    eTime: string,
    limit: number,
    offset: number
): Promise<PictureExportRow[]> => {
    const query = `
        SELECT
            p.id,
            p.device_id,
            d.name AS device_name,
            d.hive_id,
            h.name AS hive_name,
            p.time,
            DATE_FORMAT(CONVERT_TZ(p.time, '+00:00', '+00:00'), '%Y-%m-%dT%H:%i:%sZ') as time_utc,
            p.path
        FROM picture_data p
        JOIN devices d ON d.id = p.device_id
        LEFT JOIN hives h ON h.id = d.hive_id
        WHERE p.device_id = ?
          AND p.time BETWEEN ? AND ?
        ORDER BY p.time ASC
        LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.execute(query, [deviceId, sTime, eTime, limit, offset]);
    return rows as PictureExportRow[];
};
