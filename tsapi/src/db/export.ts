import { RowDataPacket } from "mysql2";
import { pool } from "./index";
import { ExportRecord, ExportStatus } from "../types";

interface ExportRow extends RowDataPacket {
    id: string;
    type: string;
    status: ExportStatus;
    params: string | null;
    progress: number;
    total_rows: number | null;
    file_path: string | null;
    file_size: number | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
    expires_at: string | null;
    error: string | null;
}

const deserialize = (row: ExportRow): ExportRecord => ({
    id: row.id,
    type: row.type,
    status: row.status,
    params: row.params ? JSON.parse(row.params) : null,
    progress: row.progress,
    total_rows: row.total_rows,
    file_path: row.file_path,
    file_size: row.file_size,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
    expires_at: row.expires_at,
    error: row.error,
});

export const createExportRecord = async (
    id: string,
    type: string,
    params: unknown,
    expiresAt: Date | null,
    filePath: string
): Promise<string> => {
    await pool.execute(
        `INSERT INTO exports (id, type, status, params, progress, total_rows, file_path, created_at, updated_at, expires_at)
         VALUES (?, ?, 'pending', ?, 0, NULL, ?, NOW(), NOW(), ?)`,
        [id, type, JSON.stringify(params ?? {}), filePath, expiresAt ? expiresAt : null]
    );
    return id;
};

export const updateExportProgress = async (
    id: string,
    progress: number,
    totalRows?: number | null
): Promise<void> => {
    await pool.execute(
        `UPDATE exports SET progress = ?, total_rows = COALESCE(?, total_rows), updated_at = NOW() WHERE id = ?`,
        [progress, totalRows ?? null, id]
    );
};

export const markExportRunning = async (id: string): Promise<void> => {
    await pool.execute(
        `UPDATE exports SET status = 'running', updated_at = NOW(), error = NULL WHERE id = ?`,
        [id]
    );
};

export const markExportReady = async (id: string, fileSize: number): Promise<void> => {
    await pool.execute(
        `UPDATE exports
         SET status = 'ready', file_size = ?, completed_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [fileSize, id]
    );
};

export const markExportFailed = async (id: string, error: string): Promise<void> => {
    await pool.execute(
        `UPDATE exports SET status = 'failed', error = ?, updated_at = NOW() WHERE id = ?`,
        [error.slice(0, 2000), id]
    );
};

export const markExportExpired = async (id: string): Promise<void> => {
    await pool.execute(
        `UPDATE exports SET status = 'expired', updated_at = NOW() WHERE id = ?`,
        [id]
    );
};

export const getExportById = async (id: string): Promise<ExportRecord | null> => {
    const [rows] = await pool.execute<ExportRow[]>(
        `SELECT * FROM exports WHERE id = ? LIMIT 1`,
        [id]
    );
    if (rows.length === 0) return null;
    return deserialize(rows[0]);
};

export const getRestartableExports = async (): Promise<ExportRecord[]> => {
    const [rows] = await pool.execute<ExportRow[]>(
        `SELECT * FROM exports WHERE status IN ('pending', 'running')`
    );
    return rows.map(deserialize);
};

export const getExpiredExports = async (): Promise<ExportRecord[]> => {
    const [rows] = await pool.execute<ExportRow[]>(
        `SELECT * FROM exports WHERE expires_at IS NOT NULL AND expires_at <= NOW() AND status IN ('pending','running','ready','failed')`
    );
    return rows.map(deserialize);
};

export const deleteExportRecord = async (id: string): Promise<void> => {
    await pool.execute(`DELETE FROM exports WHERE id = ?`, [id]);
};
