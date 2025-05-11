import { pool } from './index';
import { SensorData2, DATA_TYPE } from '../types';

export interface InsertSensorPayload {
    device_id: number;
    time: string;
    values: {
        [key: string]: number | null;  // 예: temp: 22.5, humi: 60
    };
}

const FIELD_TO_TYPE_MAP: Record<string, number> = {
    in_field: DATA_TYPE.IN,
    out_field: DATA_TYPE.OUT,
    temp: DATA_TYPE.TEMP,
    humi: DATA_TYPE.HUMI,
    co2: DATA_TYPE.CO2,
    weigh: DATA_TYPE.WEIGH
};

const TYPE_TO_FIELD_MAP: Record<number, string> = {
    [DATA_TYPE.IN]: 'in_field',
    [DATA_TYPE.OUT]: 'out_field',
    [DATA_TYPE.TEMP]: 'temp',
    [DATA_TYPE.HUMI]: 'humi',
    [DATA_TYPE.CO2]: 'co2',
    [DATA_TYPE.WEIGH]: 'weigh'
};

const processBatch = async (queryTemplate: string, data: any[][], batchSize: number) => {
    let totalProcessed = 0;
    let batch: any[][] = [];

    const insertBatch = async () => {
        if (batch.length === 0) return;

        const valuesPerRow = batch[0].length;
        const placeholders = batch.map(() => `(${new Array(valuesPerRow).fill('?').join(', ')})`).join(', ');

        const fullQuery = queryTemplate.replace('VALUES (?, ?, ?, ?, ?)', `VALUES ${placeholders}`);
        const flatParams = batch.flat();

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

// ✅ INSERT 함수
export const insertSensorData2 = async (
    datas: InsertSensorPayload[]
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

    const rows: any[][] = [];

    for (const data of datas) {
        const { device_id, time, values } = data;

        for (const key in values) {
            const type = FIELD_TO_TYPE_MAP[key];
            if (!type) continue;

            const value = values[key];
            if (value === null || value === undefined) continue;

            const floatFields = ['temp', 'humi', 'co2', 'weigh'];
            const intFields = ['in_field', 'out_field'];
            const isFloat = floatFields.includes(key);
            const isInt = intFields.includes(key);
            const row: any[] = [
                device_id,
                isInt ? value : null,
                isFloat ? value : null,
                type,
                time
            ];

            rows.push(row);
        }
    }

    console.log("query");
    console.log(query);
    console.log("rows");
    console.log(rows);
    console.log("batchSize");
    console.log(batchSize);
    await processBatch(query, rows, batchSize);
};

// ✅ SELECT 함수
export const getSensorData2 = async (
    deviceId: number,
    sTime: string,
    eTime: string,
    dataTypes: number[]
): Promise<Array<{ device_id: number; time: string } & Record<string, number>>> => {
    if (dataTypes.length === 0) return [];

    const placeholders = dataTypes.map(() => '?').join(', ');
    const query = `
    SELECT * FROM sensor_data2 
    WHERE device_id = ? 
      AND data_type IN (${placeholders})
      AND time BETWEEN ? AND ?
    ORDER BY time DESC`;

    const params = [deviceId, ...dataTypes, sTime, eTime];
    const [rows] = await pool.execute(query, params);

    const results = (rows as SensorData2[]).map(row => {
        const fieldName = TYPE_TO_FIELD_MAP[row.data_type];
        const value = Number(row.data_int ?? row.data_float ?? 0); // 👈 명확하게 number 보장

        return {
            device_id: row.device_id,
            time: row.time,
            [fieldName]: value
        } as { device_id: number; time: string } & Record<string, number>;
    });

    return results;
};

// import { pool } from './index';
// import { ResultSetHeader } from 'mysql2';
// import { InOutData, SensorData, CameraData } from '../types';
// import { SensorData2, DATA_TYPE } from '../types';

// // deviceID, sTime, eTime 받아서 inout_data가져오기
// export const getInOutData = async (deviceId: number, sTime: string, eTime: string): Promise<InOutData[]> => {
//     try {
//         const query = `
//         SELECT * FROM inout_data 
//         WHERE device_id = ? AND time BETWEEN ? AND ?
//         ORDER BY time DESC`;
//         const [rows] = await pool.execute(query, [deviceId, sTime, eTime]);
//         return rows as InOutData[];
//     } catch (error) {
//         throw error;
//     }
// }    

// // deviceID, sTime, eTime 받아서 sensor_data 가져오기
// export const getSensorData = async (deviceId: number, sTime: string, eTime: string): Promise<SensorData[]> => {
//     try {
//         const query = `
//         SELECT * FROM sensor_data 
//         WHERE device_id = ? AND time BETWEEN ? AND ?
//         ORDER BY time DESC`;
//         const [rows] = await pool.execute(query, [deviceId, sTime, eTime]);
//         return rows as SensorData[];
//     } catch (error) {
//         throw error;
//     }
// }

// // deviceID, sTime, eTime 받아서 camera_data 가져오기
// export const getCameraData = async (deviceId: number, sTime: string, eTime: string): Promise<CameraData[]> => {
//     try {
//         const query = `
//         SELECT * FROM camera_data 
//         WHERE device_id = ? AND time BETWEEN ? AND ?
//         ORDER BY time DESC`;
//         const [rows] = await pool.execute(query, [deviceId, sTime, eTime]);
//         return rows as CameraData[];
//     } catch (error) {
//         throw error;
//     }
// }


// const processBatch = async (query: string, data: any[], batchSize: number) => {
//     let totalProcessed = 0;
//     let batch = [];

//     const insertBatch = async (batch: any[]) => {
//         if (batch.length === 0) return;
//         const [result] = await pool.execute(query, batch);
//         totalProcessed += batch.length;
//     };

//     for (let i = 0; i < data.length; i++) {
//         batch.push(...data[i]);
//         if (batch.length >= batchSize) {
//             await insertBatch(batch);
//             batch = [];
//         }
//     }
//     if (batch.length > 0) {
//         await insertBatch(batch);
//     }
//     console.log(`Processed ${totalProcessed} records`);
//     return totalProcessed;
// };


// export const insertInOutData = async (datas : InOutData[]): Promise<void> => {
//     try {
//         const batchSize = 1000; // Number of records to insert at once
//         const query = `
//         INSERT INTO inout_data (device_id, in_field, out_field, time)
//         VALUES (?, ?, ?, ?)
//         ON DUPLICATE KEY UPDATE
//             in_field = VALUES(in_field),
//             out_field = VALUES(out_field),
//             time = VALUES(time)
//         `;

//         const formattedData = datas.map(data => [
//             data.device_id,
//             data.in_field,
//             data.out_field,
//             data.time
//         ]);
//         const totalProcessedCount = await processBatch(query, formattedData, batchSize);
//         console.log(`Inserted ${totalProcessedCount} records into inout_data`);
//     }
//     catch (error) {
//         throw error;
//     }
// };

// export const insertSensorData = async (datas : SensorData[]): Promise<void> => {
//     try {
//         const batchSize = 1000; // Number of records to insert at once
//         const query = `
//         INSERT INTO sensor_data (device_id, temp, humi, co2, weigh, time)
//         VALUES (?, ?, ?, ?, ?, ?)
//         ON DUPLICATE KEY UPDATE
//             temp = VALUES(temp),
//             humi = VALUES(humi),
//             co2 = VALUES(co2),
//             weigh = VALUES(weigh),
//             time = VALUES(time)
//         `;

//         const formattedData = datas.map(data => [
//             data.device_id,
//             data.temp,
//             data.humi,
//             data.co2,
//             data.weigh,
//             data.time
//         ]);
//         const totalProcessedCount = await processBatch(query, formattedData, batchSize);
//         console.log(`Inserted ${totalProcessedCount} records into sensor_data`);
//     } catch (error) {
//         throw error;
//     }
// };

// export const insertCameraData = async (datas : CameraData[]): Promise<void> => {
//     try {
//         const batchSize = 1000; // Number of records to insert at once
//         const query = `
//         INSERT INTO camera_data (device_id, picture, time)
//         VALUES (?, ?, ?)
//         ON DUPLICATE KEY UPDATE
//             picture = VALUES(picture),
//             time = VALUES(time)
//         `;

//         const formattedData = datas.map(data => [
//             data.device_id,
//             data.picture,
//             data.time
//         ]);
//         const totalProcessedCount = await processBatch(query, formattedData, batchSize);
//         console.log(`Inserted ${totalProcessedCount} records into camera_data`);
//     } catch (error) {
//         throw error;
//     }
// };