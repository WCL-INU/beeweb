import fs from 'fs/promises';
import path from 'path';
import { pool } from './index';

const RAW_DIR = path.join(__dirname, 'data/raw');
const CORRECTED_DIR = path.join(__dirname, 'data/corrected');

function sanitizeDeviceName(name: string, id: number): string {
    return `${name.replace(/[^a-zA-Z0-9_-]/g, '')}_${id}_corr`;
}

function correctIN(x: number): number {
    // y(x) = 1.880027 * log(0.046259 * (x + 0.000001) + 0.534841) * 47.955098 + 63.889908
    const K = 90.156879027646;
    const A = 0.046259;
    const B = 0.534841046259;
    return K * Math.log(A * x + B) + 63.889908;
}

function correctOUT(x: number): number {
    // y(x) = 1.507900 * log(0.080340 * (x + 0.000001) + 0.502012) * 31.350850 + 40.577982
    const K = 47.2724562165;
    const A = 0.080340;
    const B = 0.50201208034;
    return K * Math.log(A * x + B) + 40.577982;
}

export async function getDeviceIdsWithINorOUT(): Promise<number[]> {
    const [rows] = await pool.query(
        `SELECT DISTINCT device_id FROM sensor_data2 WHERE data_type IN (2, 3)`
    ) as [Array<{ device_id: number }>, any];

    return rows.map(row => row.device_id);
}

export async function ensureCorrectedDevices(deviceIds: number[]): Promise<Array<{ originalId: number, correctedId: number }>> {
    const result: Array<{ originalId: number, correctedId: number }> = [];

    for (const id of deviceIds) {
        const [devices] = await pool.query(
            `SELECT id, name, hive_id FROM devices WHERE id = ?`,
            [id]
        ) as [Array<{ id: number, name: string, hive_id: number }>, any];

        if (devices.length === 0) continue;
        const { name, hive_id } = devices[0];
        const corrName = sanitizeDeviceName(name, id);

        const [existing] = await pool.query(
            `SELECT id FROM devices WHERE hive_id = ? AND type_id = 3 AND name = ?`,
            [hive_id, corrName]
        ) as [Array<{ id: number }>, any];

        let correctedId: number;

        if (existing.length > 0) {
            correctedId = existing[0].id;
        } else {
            const [insertResult] = await pool.query(
                `INSERT INTO devices (hive_id, type_id, name) VALUES (?, 3, ?)`,
                [hive_id, corrName]
            ) as [any, any];

            correctedId = insertResult.insertId;
        }

        result.push({ originalId: id, correctedId });
    }

    return result;
}

export async function getUncorrectedRows(originalId: number, correctedId: number, dataType: 2 | 3): Promise<Array<{ data_int: number | null, data_float: number | null, time: string }>> {
    const [rows] = await pool.query(
        `SELECT o.data_int, o.data_float, o.time
         FROM sensor_data2 o
         LEFT JOIN sensor_data2 c
           ON o.time = c.time AND o.data_type = c.data_type AND c.device_id = ?
         WHERE o.device_id = ? AND o.data_type = ? AND c.id IS NULL`,
        [correctedId, originalId, dataType]
    ) as [Array<{ data_int: number | null, data_float: number | null, time: string }>, any];

    return rows;
}

export async function exportUncorrectedToFile(originalId: number, correctedId: number): Promise<void> {
    await fs.mkdir(RAW_DIR, { recursive: true });

    for (const dataType of [2, 3] as const) {
        const rows = await getUncorrectedRows(originalId, correctedId, dataType);
        if (rows.length === 0) continue;

        const typeStr = dataType === 2 ? 'in' : 'out';
        const filePath = path.join(RAW_DIR, `device_${originalId}_${typeStr}.json`);
        await fs.writeFile(filePath, JSON.stringify(rows, null, 2));
        console.log(`📦 Saved ${rows.length} rows → ${filePath}`);
    }
}

export async function correctRawFilesToCorrectedFiles(originalId: number, correctedId: number): Promise<void> {
    await fs.mkdir(CORRECTED_DIR, { recursive: true });

    for (const typeStr of ['in', 'out'] as const) {
        const rawPath = path.join(RAW_DIR, `device_${originalId}_${typeStr}.json`);
        const correctedPath = path.join(CORRECTED_DIR, `device_${correctedId}_${typeStr}.json`);

        try {
            const content = await fs.readFile(rawPath, 'utf-8');
            const rows: Array<{ data_int: number | null, data_float: number | null, time: string }> = JSON.parse(content);
            const dataType = typeStr === 'in' ? 2 : 3;

            const corrected = rows.map(row => {
                const val = row.data_int ?? row.data_float ?? 0;
                const correctedVal = dataType === 2 ? correctIN(val) : correctOUT(val);
                return {
                    device_id: correctedId,
                    data_float: correctedVal, // ✅ 실수값은 data_float에 저장
                    data_type: dataType,
                    time: row.time,
                };
            });

            await fs.writeFile(correctedPath, JSON.stringify(corrected, null, 2));
            console.log(`✅ 보정 완료 → ${correctedPath}`);
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                console.log(`⚠️ 파일 없음 (건너뜀): ${rawPath}`);
            } else {
                throw err;
            }
        }
    }
}

export async function importCorrectedDataToDB(): Promise<void> {
    const files = await fs.readdir(CORRECTED_DIR);

    for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(CORRECTED_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');

        const rows: Array<{ device_id: number, data_float: number, data_type: 2 | 3, time: string }> = JSON.parse(content);

        if (rows.length === 0) {
            console.log(`⚠️ 비어있는 파일 건너뜀: ${file}`);
            continue;
        }

        const values = rows.map(row => [
            row.device_id,
            row.data_float,
            row.data_type,
            row.time
        ]);

        await pool.query(
            `INSERT IGNORE INTO sensor_data2 (device_id, data_float, data_type, time) VALUES ?`,
            [values]
        );

        console.log(`✅ INSERT 완료: ${file} (${values.length} rows)`);
    }

    console.log('🎉 모든 보정 데이터 삽입 완료');
}

export async function runCorrectProcess(): Promise<void> {
    const deviceIds = await getDeviceIdsWithINorOUT();
    const pairs = await ensureCorrectedDevices(deviceIds);

    for (const { originalId, correctedId } of pairs) {
        await exportUncorrectedToFile(originalId, correctedId);
        await correctRawFilesToCorrectedFiles(originalId, correctedId);
    }

    await importCorrectedDataToDB();
    console.log('✅ 전체 보정 프로세스 완료');
}