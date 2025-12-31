import fs from "fs";
import path from "path";
import { ExportRecord } from "../types";
import {
    createExportRecord,
    deleteExportRecord,
    getExportById,
    getExports,
    getExportFileRefs,
    getExpiredExports,
    getRestartableExports,
    markExportExpired,
} from "../db/export";
import { EXPORT_DIR, EXPORT_MAX_CONCURRENCY, EXPORT_TTL_HOURS } from "./config";
import { exportSensorDataToCsv, SensorExportParams } from "./sensor_data";
import { exportPictures, PictureExportParams } from "./pictures";
import { exportMixed, MixedExportParams } from "./mixed";
import { randomUUID } from "crypto";

type ExportTask = () => Promise<void>;
type QueuedExport = { id: string; controller: AbortController; task: ExportTask };

let running = 0;
const queue: QueuedExport[] = [];
const runningControllers = new Map<string, AbortController>();

const runNext = () => {
    if (running >= EXPORT_MAX_CONCURRENCY) return;
    const item = queue.shift();
    if (!item) return;
    if (item.controller.signal.aborted) {
        runNext();
        return;
    }
    running += 1;
    runningControllers.set(item.id, item.controller);
    item
        .task()
        .catch((err) => {
            console.error("[export] task failed:", err);
        })
        .finally(() => {
            running -= 1;
            runningControllers.delete(item.id);
            runNext();
        });
};

const enqueue = (id: string, controller: AbortController, task: ExportTask) => {
    queue.push({ id, controller, task });
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
    const controller = new AbortController();
    await createExportRecord(id, "sensor_csv", params, expiresAt(), filePath);
    enqueue(id, controller, () => exportSensorDataToCsv(id, filePath, params, controller.signal));
    return id;
};

export const createPictureExport = async (params: PictureExportParams): Promise<string> => {
    await ensureExportDir();
    const id = randomUUID();
    const filePath = path.join(EXPORT_DIR, `${id}.zip`);
    const controller = new AbortController();
    await createExportRecord(id, "picture_zip", params, expiresAt(), filePath);
    enqueue(id, controller, () => exportPictures(id, filePath, params, controller.signal));
    return id;
};

export const createMixedExport = async (params: MixedExportParams): Promise<string> => {
    await ensureExportDir();
    const id = randomUUID();
    const filePath = path.join(EXPORT_DIR, `${id}.zip`);
    const controller = new AbortController();
    await createExportRecord(id, "mixed_zip", params, expiresAt(), filePath);
    enqueue(id, controller, () => exportMixed(id, filePath, params, controller.signal));
    return id;
};

export const loadExport = async (id: string): Promise<ExportRecord | null> => {
    return getExportById(id);
};

export const removeExport = async (record: ExportRecord, ignoreFileErrors = false): Promise<void> => {
    if (record.file_path) {
        try {
            await fs.promises.rm(record.file_path, { force: true });
        } catch (err) {
            if (!ignoreFileErrors) throw err;
            console.warn(`[export] failed to remove file for ${record.id}:`, err);
        }
    }
    await deleteExportRecord(record.id);
};

export const cancelExport = async (id: string): Promise<boolean> => {
    const record = await getExportById(id);
    if (!record) return false;

    const queuedIndex = queue.findIndex((item) => item.id === id);
    if (queuedIndex !== -1) {
        const [item] = queue.splice(queuedIndex, 1);
        item.controller.abort();
        await removeExport(record, true);
        return true;
    }

    const controller = runningControllers.get(id);
    if (controller) {
        controller.abort();
        await removeExport(record, true);
        return true;
    }

    await removeExport(record, true);
    return true;
};

export const resumePendingExports = async (): Promise<void> => {
    await ensureExportDir();
    const restartables = await getRestartableExports();
    for (const record of restartables) {
        if (record.type === "sensor_csv" && record.file_path) {
            const controller = new AbortController();
            enqueue(record.id, controller, () =>
                exportSensorDataToCsv(
                    record.id,
                    record.file_path as string,
                    (record.params ?? {}) as SensorExportParams,
                    controller.signal
                )
            );
        } else if (record.type === "picture_zip" && record.file_path) {
            const controller = new AbortController();
            enqueue(record.id, controller, () =>
                exportPictures(
                    record.id,
                    record.file_path as string,
                    (record.params ?? {}) as PictureExportParams,
                    controller.signal
                )
            );
        } else if (record.type === "mixed_zip" && record.file_path) {
            const controller = new AbortController();
            enqueue(record.id, controller, () =>
                exportMixed(
                    record.id,
                    record.file_path as string,
                    (record.params ?? {}) as MixedExportParams,
                    controller.signal
                )
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

export const cleanupOrphanExports = async (): Promise<void> => {
    await ensureExportDir();
    const refs = await getExportFileRefs();
    const filePaths = new Set(
        refs
            .map((ref) => (ref.file_path ? path.resolve(ref.file_path) : null))
            .filter((value): value is string => Boolean(value))
    );
    const ids = new Set(refs.map((ref) => ref.id));

    const entries = await fs.promises.readdir(EXPORT_DIR, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.resolve(EXPORT_DIR, entry.name);
        if (entry.isFile()) {
            if (!filePaths.has(fullPath)) {
                await fs.promises.rm(fullPath, { force: true });
            }
        } else if (entry.isDirectory()) {
            if (!ids.has(entry.name)) {
                await fs.promises.rm(fullPath, { recursive: true, force: true });
            }
        }
    }
};

export const listExports = async (limit = 100, offset = 0): Promise<ExportRecord[]> => {
    return getExports(limit, offset);
};
