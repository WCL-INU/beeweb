import { pool } from './index';
import { ResultSetHeader } from 'mysql2';
import { InOutData, SensorData, CameraData } from '../types';

// deviceID, sTime, eTime 받아서 inout_data가져오기
export const getInOutData = async (deviceId: number, sTime: string, eTime: string): Promise<InOutData[]> => {
    try {
        const query = `
        SELECT * FROM inout_data 
        WHERE device_id = ? AND time BETWEEN ? AND ?
        ORDER BY time DESC`;
        const [rows] = await pool.execute(query, [deviceId, sTime, eTime]);
        return rows as InOutData[];
    } catch (error) {
        throw error;
    }
}    

// deviceID, sTime, eTime 받아서 sensor_data 가져오기
export const getSensorData = async (deviceId: number, sTime: string, eTime: string): Promise<SensorData[]> => {
    try {
        const query = `
        SELECT * FROM sensor_data 
        WHERE device_id = ? AND time BETWEEN ? AND ?
        ORDER BY time DESC`;
        const [rows] = await pool.execute(query, [deviceId, sTime, eTime]);
        return rows as SensorData[];
    } catch (error) {
        throw error;
    }
}

// deviceID, sTime, eTime 받아서 camera_data 가져오기
export const getCameraData = async (deviceId: number, sTime: string, eTime: string): Promise<CameraData[]> => {
    try {
        const query = `
        SELECT * FROM camera_data 
        WHERE device_id = ? AND time BETWEEN ? AND ?
        ORDER BY time DESC`;
        const [rows] = await pool.execute(query, [deviceId, sTime, eTime]);
        return rows as CameraData[];
    } catch (error) {
        throw error;
    }
}


const processBatch = async (query: string, data: any[], batchSize: number) => {
    let totalProcessed = 0;
    let batch = [];

    const insertBatch = async (batch: any[]) => {
        if (batch.length === 0) return;
        const [result] = await pool.execute(query, batch);
        totalProcessed += batch.length;
    };

    for (let i = 0; i < data.length; i++) {
        batch.push(...data[i]);
        if (batch.length >= batchSize) {
            await insertBatch(batch);
            batch = [];
        }
    }
    if (batch.length > 0) {
        await insertBatch(batch);
    }
    console.log(`Processed ${totalProcessed} records`);
    return totalProcessed;
};


export const insertInOutData = async (datas : InOutData[]): Promise<void> => {
    try {
        const batchSize = 1000; // Number of records to insert at once
        const query = `
        INSERT INTO inout_data (device_id, in_field, out_field, time)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            in_field = VALUES(in_field),
            out_field = VALUES(out_field),
            time = VALUES(time)
        `;

        const formattedData = datas.map(data => [
            data.device_id,
            data.in_field,
            data.out_field,
            data.time
        ]);
        const totalProcessedCount = await processBatch(query, formattedData, batchSize);
        console.log(`Inserted ${totalProcessedCount} records into inout_data`);
    }
    catch (error) {
        throw error;
    }
};

export const insertSensorData = async (datas : SensorData[]): Promise<void> => {
    try {
        const batchSize = 1000; // Number of records to insert at once
        const query = `
        INSERT INTO sensor_data (device_id, temp, humi, co2, weigh, time)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            temp = VALUES(temp),
            humi = VALUES(humi),
            co2 = VALUES(co2),
            weigh = VALUES(weigh),
            time = VALUES(time)
        `;

        const formattedData = datas.map(data => [
            data.device_id,
            data.temp,
            data.humi,
            data.co2,
            data.weigh,
            data.time
        ]);
        const totalProcessedCount = await processBatch(query, formattedData, batchSize);
        console.log(`Inserted ${totalProcessedCount} records into sensor_data`);
    } catch (error) {
        throw error;
    }
};

export const insertCameraData = async (datas : CameraData[]): Promise<void> => {
    try {
        const batchSize = 1000; // Number of records to insert at once
        const query = `
        INSERT INTO camera_data (device_id, picture, time)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
            picture = VALUES(picture),
            time = VALUES(time)
        `;

        const formattedData = datas.map(data => [
            data.device_id,
            data.picture,
            data.time
        ]);
        const totalProcessedCount = await processBatch(query, formattedData, batchSize);
        console.log(`Inserted ${totalProcessedCount} records into camera_data`);
    } catch (error) {
        throw error;
    }
};