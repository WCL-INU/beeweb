import { pool } from '../db';
import { RowDataPacket } from 'mysql2';

interface PictureRow extends RowDataPacket {
    id: number;
    time: string;
}

const migrate = async () => {
    const [rows] = await pool.execute<PictureRow[]>(
        `SELECT id, time FROM picture_data`
    );

    let updated = 0;

    for (const row of rows) {
        const originalTime = new Date(row.time);
        const correctedTime = new Date(originalTime.getTime() - 9 * 60 * 60 * 1000); // 9시간 당기기
        const formatted = correctedTime.toISOString().slice(0, 19).replace('T', ' '); // MySQL DATETIME 형식

        await pool.execute(
            `UPDATE picture_data SET time = ? WHERE id = ?`,
            [formatted, row.id]
        );

        console.log(`✅ Time corrected for #${row.id}: ${formatted}`);
        updated++;
    }

    console.log(`🎯 All times corrected. Total updated: ${updated}`);
};

migrate().catch(err => {
    console.error('❌ Migration error:', err);
    process.exit(1);
});
