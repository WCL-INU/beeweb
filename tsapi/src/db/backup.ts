import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

const BACKUP_DIR = '/app/db/backup';
const PICTURE_DIR = '/app/db/picture';
const HOST = process.env.DB_HOST || 'mariadb';
const USER = process.env.DB_USER || 'user';
const PASSWORD = process.env.DB_PASSWORD || 'password';
const DATABASE = process.env.DB_NAME || 'mydb';

const MAX_BACKUPS = 3; // 보관할 최대 백업 개수

export function backupDatabase() {
    const today = new Date().toISOString().slice(0, 10);
    const sqlFile = path.join(BACKUP_DIR, `backup-${today}.sql`);
    const pictureArchive = path.join(BACKUP_DIR, `backup-${today}-picture.tar.gz`);
    const finalArchive = path.join(BACKUP_DIR, `backup-${today}.tar.gz`);

    // 최종 통합 백업 파일이 이미 존재하면 스킵
    if (fs.existsSync(finalArchive)) {
        console.log(`[Backup] Archive already exists for ${today}, skipping.`);
        return;
    }

    // 1. DB 덤프 수행
    const dumpCmd = `mariadb-dump -h ${HOST} -u ${USER} -p${PASSWORD} ${DATABASE} > ${sqlFile}`;
    exec(dumpCmd, (err1, stdout1, stderr1) => {
        if (err1) {
            console.error('[Backup] DB backup failed:', stderr1);
            return;
        }

        console.log('[Backup] DB dump completed:', sqlFile);

        // 2. picture 디렉토리 전체 구조 보존 압축
        const tarPictureCmd = `tar -czf ${pictureArchive} -P ${PICTURE_DIR}`;
        exec(tarPictureCmd, (err2, stdout2, stderr2) => {
            if (err2) {
                console.error('[Backup] Picture compression failed:', stderr2);
                return;
            }

            console.log('[Backup] Picture archive created:', pictureArchive);

            // 3. 최종 통합 압축 (SQL + picture 압축 파일)
            const finalTarCmd = `tar -czf ${finalArchive} -C ${BACKUP_DIR} ${path.basename(sqlFile)} ${path.basename(pictureArchive)}`;
            exec(finalTarCmd, (err3, stdout3, stderr3) => {
                if (err3) {
                    console.error('[Backup] Final archive failed:', stderr3);
                    return;
                }

                console.log('[Backup] Final backup archive created:', finalArchive);

                // 4. 중간 파일 삭제
                fs.unlinkSync(sqlFile);
                fs.unlinkSync(pictureArchive);
                console.log('[Backup] Temp files removed.');

                cleanupOldBackups();
            });
        });
    });
}

function cleanupOldBackups() {
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(name => name.endsWith('.tar.gz') && name.startsWith('backup-'))
        .map(name => ({ name, time: fs.statSync(path.join(BACKUP_DIR, name)).mtime.getTime() }))
        .sort((a, b) => a.time - b.time);

    if (files.length > MAX_BACKUPS) {
        const toDelete = files.slice(0, files.length - MAX_BACKUPS);
        for (const file of toDelete) {
            const filePath = path.join(BACKUP_DIR, file.name);
            fs.unlinkSync(filePath);
            console.log('[Backup] Old backup deleted:', file.name);
        }
    }
}
