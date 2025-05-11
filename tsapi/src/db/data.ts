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


export const getSensorData2 = async (
    deviceId: number,
    sTime: string,
    eTime: string,
    dataTypes: number[]
): Promise<SensorData2Row[]> => {
    if (dataTypes.length === 0) return [];

    const placeholders = dataTypes.map(() => '?').join(', ');
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