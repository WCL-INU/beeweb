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

export interface PictureExportRow extends PictureDataRow {}

export interface PictureDataCursor {
    deviceId: number;
    time: string | Date;
    id: number;
}

export const getPictureDataBatch = async (
    deviceIds: number[],
    sTime: string,
    eTime: string,
    limit: number,
    cursor?: PictureDataCursor
): Promise<PictureExportRow[]> => {
    if (deviceIds.length === 0) return [];
    const placeholders = deviceIds.map(() => "?").join(", ");
    const cursorClause = cursor
        ? `
          AND (
              p.device_id > ?
              OR (
                  p.device_id = ?
                  AND (
                      p.time > ?
                      OR (p.time = ? AND p.id > ?)
                  )
              )
          )
        `
        : "";
    const query = `
        SELECT
            p.id,
            p.device_id,
            p.time,
            p.path
        FROM picture_data p
        WHERE p.device_id IN (${placeholders})
          AND p.time BETWEEN ? AND ?
          ${cursorClause}
        ORDER BY p.device_id ASC, p.time ASC, p.id ASC
        LIMIT ?
    `;
    const params: (number | string | Date)[] = [...deviceIds, sTime, eTime];
    if (cursor) {
        params.push(cursor.deviceId, cursor.deviceId, cursor.time, cursor.time, cursor.id);
    }
    params.push(limit);
    const [rows] = await pool.execute(query, params);
    return rows as PictureExportRow[];
};
