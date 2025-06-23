import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

const BACKUP_DIR = __dirname;
const HOST = process.env.DB_HOST || 'mariadb';
const USER = process.env.DB_USER || 'user';
const PASSWORD = process.env.DB_PASSWORD || 'password';
const DATABASE = process.env.DB_NAME || 'mydb';

const MAX_BACKUPS = 14;

export function backupDatabase() {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const backupFile = path.join(BACKUP_DIR, `backup-${today}.sql`);

    // 이미 오늘 백업이 있으면 스킵
    if (fs.existsSync(backupFile)) {
        console.log(`[Backup] Backup already exists for ${today}, skipping.`);
        return;
    }

    const dumpCmd = `sh -c "mariadb-dump -h ${HOST} -u ${USER} -p${PASSWORD} ${DATABASE} > ${backupFile}"`;

    exec(dumpCmd, (error, stdout, stderr) => {
        if (error) {
            console.error('[Backup] Backup failed:', stderr);
            return;
        }

        console.log('[Backup] Backup completed:', backupFile);
        cleanupOldBackups();
    });
}

function cleanupOldBackups() {
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(name => name.startsWith('backup-') && name.endsWith('.sql'))
        .map(name => ({ name, time: fs.statSync(path.join(BACKUP_DIR, name)).mtime.getTime() }))
        .sort((a, b) => a.time - b.time); // 오래된 순

    if (files.length > MAX_BACKUPS) {
        const toDelete = files.slice(0, files.length - MAX_BACKUPS);
        for (const file of toDelete) {
            const filePath = path.join(BACKUP_DIR, file.name);
            fs.unlinkSync(filePath);
            console.log('[Backup] Old backup deleted:', file.name);
        }
    }
}
