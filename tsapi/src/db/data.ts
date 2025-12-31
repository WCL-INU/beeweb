import { pool } from './index';
import { SensorData2Insert, SensorData2Row } from '../types';

const processBatch = async (
    queryTemplate: string,
    data: SensorData2Insert[],
    batchSize: number
): Promise<number> => {
    let totalProcessed = 0;
    let batch: SensorData2Insert[] = [];

    const insertBatch = async () => {
        if (batch.length === 0) return;

        const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const fullQuery = queryTemplate.replace('VALUES (?, ?, ?, ?, ?)', `VALUES ${placeholders}`);

        const flatParams = batch.flatMap(row => [
            row.device_id,
            row.data_int,
            row.data_float,
            row.data_type,
            row.time
        ]);

        await pool.query(fullQuery, flatParams);
        totalProcessed += batch.length;
        batch = [];
    };

    for (const row of data) {
        batch.push(row);
        if (batch.length >= batchSize) {
            await insertBatch();
        }
    }

    if (batch.length > 0) {
        await insertBatch();
    }

    console.log(`Processed ${totalProcessed} records`);
    return totalProcessed;
};

// ✅ insert 함수는 순수 DB 포맷만 처리
export const insertSensorData2 = async (
    datas: SensorData2Insert[]
): Promise<void> => {
    const batchSize = 1000;
    const query = `
        INSERT INTO sensor_data2 (device_id, data_int, data_float, data_type, time)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            data_int = VALUES(data_int),
            data_float = VALUES(data_float),
            data_type = VALUES(data_type),
            time = VALUES(time)
    `;

    await processBatch(query, datas, batchSize);
};


export const countSensorData2Range = async (
    deviceIds: number[],
    sTime: string,
    eTime: string,
    dataTypes: number[]
): Promise<number> => {
    if (dataTypes.length === 0 || deviceIds.length === 0) return 0;
    const typePlaceholders = dataTypes.map(() => "?").join(", ");
    const devicePlaceholders = deviceIds.map(() => "?").join(", ");
    const query = `
        SELECT COUNT(*) as cnt
        FROM sensor_data2
        WHERE device_id IN (${devicePlaceholders})
          AND data_type IN (${typePlaceholders})
          AND time BETWEEN ? AND ?
    `;
    const params = [...deviceIds, ...dataTypes, sTime, eTime];
    const [rows] = await pool.execute(query, params);
    const result = rows as { cnt: number }[];
    return result[0]?.cnt ?? 0;
};

export interface SensorData2Cursor {
    deviceId: number;
    time: string | Date;
    id: number;
}

export const getSensorData2Batch = async (
    deviceIds: number[],
    sTime: string,
    eTime: string,
    dataTypes: number[],
    limit: number,
    cursor?: SensorData2Cursor
): Promise<SensorData2Row[]> => {
    if (dataTypes.length === 0 || deviceIds.length === 0) return [];
    const typePlaceholders = dataTypes.map(() => "?").join(", ");
    const devicePlaceholders = deviceIds.map(() => "?").join(", ");
    const cursorClause = cursor
        ? `
          AND (
              s2.device_id > ?
              OR (
                  s2.device_id = ?
                  AND (
                      s2.time > ?
                      OR (s2.time = ? AND s2.id > ?)
                  )
              )
          )
        `
        : "";
    const query = `
        SELECT
          s2.id,
          s2.device_id,
          s2.data_type,
          s2.data_int,
          s2.data_float,
          s2.time
        FROM sensor_data2 s2
        WHERE s2.device_id IN (${devicePlaceholders})
          AND s2.data_type IN (${typePlaceholders})
          AND s2.time BETWEEN ? AND ?
          ${cursorClause}
        ORDER BY s2.device_id ASC, s2.time ASC, s2.id ASC
        LIMIT ?
    `;
    const params: (number | string | Date)[] = [...deviceIds, ...dataTypes, sTime, eTime];
    if (cursor) {
        params.push(cursor.deviceId, cursor.deviceId, cursor.time, cursor.time, cursor.id);
    }
    params.push(limit);
    const [rows] = await pool.execute(query, params);
    return rows as SensorData2Row[];
};

// Legacy single-device fetch (kept for existing routes)
export const getSensorData2 = async (
    deviceId: number,
    sTime: string,
    eTime: string,
    dataTypes: number[]
): Promise<SensorData2Row[]> => {
    if (dataTypes.length === 0) return [];
    const placeholders = dataTypes.map(() => "?").join(", ");
    const query = `
        SELECT id, device_id, data_type, data_int, data_float, time
        FROM sensor_data2
        WHERE device_id = ?
          AND data_type IN (${placeholders})
          AND time BETWEEN ? AND ?
        ORDER BY time DESC
    `;
    const params = [deviceId, ...dataTypes, sTime, eTime];
    const [rows] = await pool.execute(query, params);
    return rows as SensorData2Row[];
};
