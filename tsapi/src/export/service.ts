import fs from "fs";
import path from "path";
import { ExportRecord } from "../types";
import {
    createExportRecord,
    deleteExportRecord,
    getExportById,
    getExpiredExports,
    getRestartableExports,
    markExportExpired,
} from "../db/export";
import { EXPORT_DIR, EXPORT_MAX_CONCURRENCY, EXPORT_TTL_HOURS } from "./config";
import { exportSensorDataToCsv, SensorExportParams } from "./sensor_data";
import { exportPictures, PictureExportParams } from "./pictures";
import { randomUUID } from "crypto";

type ExportTask = () => Promise<void>;

let running = 0;
const queue: ExportTask[] = [];

const runNext = () => {
    if (running >= EXPORT_MAX_CONCURRENCY) return;
    const task = queue.shift();
    if (!task) return;
    running += 1;
    task()
        .catch((err) => {
            console.error("[export] task failed:", err);
        })
        .finally(() => {
            running -= 1;
            runNext();
        });
};

const enqueue = (task: ExportTask) => {
    queue.push(task);
    runNext();
};

const ensureExportDir = async () => {
    await fs.promises.mkdir(EXPORT_DIR, { recursive: true });
};

const expiresAt = (): Date => new Date(Date.now() + EXPORT_TTL_HOURS * 60 * 60 * 1000);

export const createSensorExport = async (params: SensorExportParams): Promise<string> => {
    await ensureExportDir();
    const id = randomUUID();
    const filePath = path.join(EXPORT_DIR, `${id}.csv`);
    await createExportRecord(id, "sensor_csv", params, expiresAt(), filePath);
    enqueue(() => exportSensorDataToCsv(id, filePath, params));
    return id;
};

export const createPictureExport = async (params: PictureExportParams): Promise<string> => {
    await ensureExportDir();
    const id = randomUUID();
    const filePath = path.join(EXPORT_DIR, `${id}.zip`);
    await createExportRecord(id, "picture_zip", params, expiresAt(), filePath);
    enqueue(() => exportPictures(id, filePath, params));
    return id;
};

export const loadExport = async (id: string): Promise<ExportRecord | null> => {
    return getExportById(id);
};

export const removeExport = async (record: ExportRecord): Promise<void> => {
    if (record.file_path) {
        await fs.promises.rm(record.file_path, { force: true });
    }
    await deleteExportRecord(record.id);
};

export const resumePendingExports = async (): Promise<void> => {
    await ensureExportDir();
    const restartables = await getRestartableExports();
    for (const record of restartables) {
        if (record.type === "sensor_csv" && record.file_path) {
            enqueue(() =>
                exportSensorDataToCsv(record.id, record.file_path as string, (record.params ?? {}) as SensorExportParams)
            );
        } else if (record.type === "picture_zip" && record.file_path) {
            enqueue(() =>
                exportPictures(record.id, record.file_path as string, (record.params ?? {}) as PictureExportParams)
            );
        }
    }
};

export const cleanupExpiredExports = async (): Promise<void> => {
    const expired = await getExpiredExports();
    for (const record of expired) {
        try {
            if (record.file_path) {
                await fs.promises.rm(record.file_path, { force: true });
            }
            await markExportExpired(record.id);
        } catch (err) {
            console.error(`[export] failed to cleanup export ${record.id}:`, err);
        }
    }
};
