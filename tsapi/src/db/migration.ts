import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { RowDataPacket } from 'mysql2';
import { pool } from './index'; // DB 연결

const PICTURE_DIR = '/app/db/picture';

const ExifTool = require('node-exiftool');
const exiftoolBin = require('dist-exiftool');
const ep = new ExifTool.ExiftoolProcess(exiftoolBin);

async function clearDirectory(dir: string): Promise<void> {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await clearDirectory(fullPath);
                await fs.rmdir(fullPath);
            } else {
                await fs.unlink(fullPath);
            }
        }

        console.log(`✅ '${dir}' 내부 파일 삭제 완료`);
    } catch (err) {
        console.error(`❌ '${dir}' 내부 파일 삭제 실패:`, err);
        throw err;
    }
}

export async function migratePictureData() {
    console.log('📦 picture_data 테이블 마이그레이션 시작');

    // 1. path 컬럼 존재 확인 및 추가
    const [columns] = await pool.query<RowDataPacket[]>(
        `SHOW COLUMNS FROM picture_data LIKE 'path'`
    );
    if (columns.length === 0) {
        console.log('🛠 path 컬럼이 없어 추가 중...');
        await pool.execute(`ALTER TABLE picture_data ADD COLUMN path VARCHAR(255)`);
    }

    // 2. 기존 path 컬럼 초기화 + 파일 디렉토리 삭제
    try {
        console.log('🧹 기존 path 초기화 및 파일 삭제 중...');
        await pool.execute(`UPDATE picture_data SET path = NULL`);
        await clearDirectory(PICTURE_DIR);
        await fs.mkdir(PICTURE_DIR, { recursive: true });
        console.log('✅ 초기화 완료');
    } catch (err) {
        console.error('❌ 초기화 중 오류 발생:', err);
        return;
    }

    const BATCH_SIZE = 50;
    let lastId = 0;
    let total = 0;
    const noExifList: { id: number; device_id: number; rawExif?: any }[] = [];

    await ep.open();

    while (true) {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, device_id, picture, time
             FROM picture_data
             WHERE id > ? AND picture IS NOT NULL
             ORDER BY id ASC
             LIMIT ?`,
            [lastId, BATCH_SIZE]
        );

        if (rows.length === 0) break;

        for (const row of rows) {
            const { id, device_id, time, picture } = row;
            lastId = id;
            if (!picture) continue;

            try {
                const deviceFolder = `device_${device_id}`;
                const deviceDir = path.join(PICTURE_DIR, deviceFolder);
                await fs.mkdir(deviceDir, { recursive: true });

                const tempFilename = `${id}_temp.jpg`;
                const tempPath = path.join(deviceDir, tempFilename);
                await fs.writeFile(tempPath, picture);

                const { data } = await ep.readMetadata(tempPath);
                const meta = data[0] || {};
                const exifTimeRaw = meta.DateTimeOriginal;

                // EXIF 없음
                if (!exifTimeRaw) {
                    console.warn(`⚠️ ID ${id}: EXIF 시간 없음`);
                    console.warn(`📄 EXIF 메타데이터:\n`, meta);
                    noExifList.push({ id, device_id, rawExif: meta });
                    await fs.unlink(tempPath);
                    continue;
                }

                // "2025:07:07 14:41:10" → "2025-07-07T14:41:10+09:00"
                const datePart = exifTimeRaw.slice(0, 10).replace(/:/g, '-');
                const timePart = exifTimeRaw.slice(11);
                const parsedDateStr = `${datePart}T${timePart}+09:00`;

                const utcDate = new Date(parsedDateStr);
                const formatted = utcDate.toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
                const finalFilename = `${formatted}Z.jpg`;
                const finalThumb = `${formatted}Z_thumb.jpg`;

                const finalPath = path.join(deviceDir, finalFilename);
                const thumbPath = path.join(deviceDir, finalThumb);

                await fs.rename(tempPath, finalPath);

                await sharp(picture)
                    .resize({ width: 320 })
                    .jpeg({ quality: 80 })
                    .toFile(thumbPath);

                const relativePath = path.join(deviceFolder, finalFilename);
                await pool.execute(`UPDATE picture_data SET path = ? WHERE id = ?`, [
                    relativePath,
                    id,
                ]);

                const dbDate = new Date(time);
                if (Math.abs(dbDate.getTime() - utcDate.getTime()) > 1000) {
                    await pool.execute(
                        `UPDATE picture_data SET time = ? WHERE id = ?`,
                        [utcDate.toISOString().replace('T', ' ').replace('Z', ''), id]
                    );
                    console.log(`🕒 ID ${id}: time 갱신됨`);
                }

                total++;
                console.log(`✅ ID ${id}: 저장 완료 → ${relativePath}`);
            } catch (err) {
                console.error(`❌ ID ${id} 처리 실패:`, err);
            }
        }
    }

    await ep.close();

    if (noExifList.length > 0) {
        console.log('\n⚠️ EXIF 없는 이미지 목록:');
        for (const item of noExifList) {
            console.log(`- ID ${item.id} (device ${item.device_id})`);
        }
        console.log(`총 ${noExifList.length}개의 이미지에 EXIF 정보가 없습니다.`);
    }

    console.log(`\n🎉 마이그레이션 완료 (총 ${total}건 처리됨)`);
}
