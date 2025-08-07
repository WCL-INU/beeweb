import { pool } from './index';

async function addIndexIfNotExists(table: string, indexName: string, sql: string) {
    const [rows] = await pool.query(
        `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, indexName]
    );
    if ((rows as any[]).length === 0) {
        await pool.execute(sql);
        console.log(`✅ 인덱스 추가됨: ${indexName} ON ${table}`);
    } else {
        console.log(`ℹ️ 인덱스 이미 존재함: ${indexName} ON ${table}`);
    }
}

// ✅ 보정 수식 정의
function specificCalcIN(val: number): number {
    return Math.round(val * 1.1); // 예시
}

function specificCalcOUT(val: number): number {
    return Math.round(val + 3); // 예시
}

// ✅ _CORR 디바이스 생성 또는 가져오기
async function createOrGetCorrectedDevice(deviceId: number): Promise<number> {
    const [rows] = await pool.query(`SELECT * FROM devices WHERE id = ?`, [deviceId]) as [any[], any];
    if (rows.length === 0) throw new Error('Original device not found');

    const original = rows[0];
    const correctedName = original.name + '_CORR';

    const [existing] = await pool.query(
        `SELECT * FROM devices WHERE hive_id = ? AND name = ?`,
        [original.hive_id, correctedName]
    );
    if ((existing as any[]).length > 0) return (existing as any)[0].id;

    const [result]: any = await pool.execute(
        `INSERT INTO devices (hive_id, type_id, name) VALUES (?, ?, ?)`,
        [original.hive_id, original.type_id, correctedName]
    );
    return result.insertId;
}

// ✅ 보정값 삽입 (data_type은 그대로 유지)
async function insertCorrectedData(originalId: number, correctedId: number) {
    const [rows] = await pool.query(`
        SELECT data_type, data_int, data_float, time
        FROM sensor_data2
        WHERE device_id = ? AND data_type IN (2, 3)
    `, [originalId]);

    for (const row of rows as any[]) {
        const value = row.data_int ?? row.data_float;
        const correctedType = row.data_type;

        let correctedVal: number;
        if (correctedType === 2) {
            correctedVal = specificCalcIN(value);
        } else if (correctedType === 3) {
            correctedVal = specificCalcOUT(value);
        } else {
            continue;
        }

        await pool.execute(
            `INSERT IGNORE INTO sensor_data2 (device_id, data_int, data_type, time)
             VALUES (?, ?, ?, ?)`,
            [correctedId, correctedVal, correctedType, row.time]
        );
    }
}

// ✅ 배치 단위로 device_id 조회
async function getDeviceIdsBatch(afterId: number, limit: number): Promise<number[]> {
    const [rows] = await pool.query(`
        SELECT DISTINCT device_id
        FROM sensor_data2
        WHERE data_type IN (2, 3) AND device_id > ?
        ORDER BY device_id
        LIMIT ?
    `, [afterId, limit]);

    return (rows as any[]).map(row => row.device_id);
}

// ✅ 전체 루프
export async function processAllDevicesInBatches(batchSize: number = 100) {
    await addIndexIfNotExists(
        'sensor_data2',
        'idx_sensor_device_type_time',
        'CREATE INDEX idx_sensor_device_type_time ON sensor_data2(device_id, data_type, time)'
    );

    let lastId = 0;
    let processedCount = 0;
    let batchNumber = 1;
    const startedAt = Date.now();

    while (true) {
        const deviceIds = await getDeviceIdsBatch(lastId, batchSize);
        if (deviceIds.length === 0) break;

        const batchStart = deviceIds[0];
        const batchEnd = deviceIds[deviceIds.length - 1];
        console.log(`📦 [배치 ${batchNumber}] 디바이스 ID ${batchStart} ~ ${batchEnd} (${deviceIds.length}개) 처리 시작`);

        let batchSuccess = 0;

        for (const deviceId of deviceIds) {
            try {
                const correctedId = await createOrGetCorrectedDevice(deviceId);
                await insertCorrectedData(deviceId, correctedId);
                lastId = deviceId;
                processedCount++;
                batchSuccess++;
                console.log(`   ✅ 디바이스 ${deviceId} → 보정 디바이스 ${correctedId} 데이터 추가 완료`);
            } catch (err) {
                console.error(`   ❌ 디바이스 ${deviceId} 처리 실패:`, (err as Error).message);
            }
        }

        console.log(`🟢 [배치 ${batchNumber}] 완료: ${batchSuccess}/${deviceIds.length}개 성공`);
        batchNumber++;
    }

    const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`\n🎉 전체 보정 작업 완료`);
    console.log(`   👉 총 처리 디바이스 수: ${processedCount}개`);
    console.log(`   ⏱️ 소요 시간: ${duration}초`);
}
