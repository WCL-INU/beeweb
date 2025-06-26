import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { pool } from '../db';
import { RowDataPacket } from 'mysql2';

const OUTPUT_DIR = '/app/db/picture'; // 썸네일 포함 저장될 경로

interface PictureRow extends RowDataPacket {
    id: number;
    device_id: number;
    time: string;
    picture: Buffer;
}

const migrate = async () => {
    const [rows] = await pool.execute<PictureRow[]>(
        `SELECT id, device_id, time, picture FROM picture_data WHERE path IS NULL`
    );

    for (const row of rows) {
        const timeObj = new Date(row.time);
        const formatted = timeObj.toISOString().replace(/[-:]/g, '').slice(0, 15); // YYYYMMDDTHHMMSS
        const filename = `${formatted}Z.jpg`; // ✅ Z 붙이기
        const thumbname = `${formatted}Z_thumb.jpg`; // ✅ 썸네일도 동일

        const deviceFolder = `device_${row.device_id}`;
        const devicePath = path.join(OUTPUT_DIR, deviceFolder);

        await fs.mkdir(devicePath, { recursive: true });

        const fullPath = path.join(devicePath, filename);
        const thumbPath = path.join(devicePath, thumbname);

        // 저장
        await fs.writeFile(fullPath, row.picture);
        await sharp(row.picture)
            .resize({ width: 320 })
            .jpeg({ quality: 80 })
            .toFile(thumbPath);

        // DB 경로 업데이트
        const relativePath = path.join(deviceFolder, filename);
        await pool.execute(`UPDATE picture_data SET path = ? WHERE id = ?`, [relativePath, row.id]);

        console.log(`Migrated picture #${row.id} → ${relativePath}`);
    }

    console.log(`✅ Migration completed: ${rows.length} rows`);
};

migrate().catch(err => {
    console.error('❌ Migration error:', err);
    process.exit(1);
});
