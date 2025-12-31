import fs from "fs";
import path from "path";
import archiver from "archiver";
import { once } from "events";
import { EXPORT_BATCH_SIZE, PICTURE_DIR } from "./config";
import { getPictureDataBatch } from "../db/picture";
import { deleteExportRecord, markExportFailed, markExportReady, markExportRunning, updateExportProgress } from "../db/export";
import { getDevicesByIds, getHivesByIds } from "../db/lookup";

export interface PictureExportParams {
    deviceIds: number[];
    sTime: string;
    eTime: string;
}

const csvEscape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

const toCsvLine = (values: unknown[]): string => values.map(csvEscape).join(",") + "\n";

const toUtcIsoString = (value: string | Date): string => {
    if (value instanceof Date) return value.toISOString();
    const raw = String(value);
    if (raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw)) {
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) {
            throw new Error(`Invalid UTC date value: ${raw}`);
        }
        return date.toISOString();
    }
    if (raw.includes("T")) {
        const date = new Date(`${raw}Z`);
        if (Number.isNaN(date.getTime())) {
            throw new Error(`Invalid UTC date value: ${raw}`);
        }
        return date.toISOString();
    }
    if (raw.includes(" ")) {
        const date = new Date(`${raw.replace(" ", "T")}Z`);
        if (Number.isNaN(date.getTime())) {
            throw new Error(`Invalid UTC date value: ${raw}`);
        }
        return date.toISOString();
    }
    throw new Error(`Invalid UTC date value: ${raw}`);
};

class ExportCanceledError extends Error {
    constructor() {
        super("Export canceled");
        this.name = "ExportCanceledError";
    }
}

const throwIfAborted = (signal?: AbortSignal) => {
    if (signal?.aborted) {
        throw new ExportCanceledError();
    }
};

const ensureDir = async (dir: string) => {
    await fs.promises.mkdir(dir, { recursive: true });
};

const zipDirectory = async (sourceDir: string, outPath: string): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(outPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        output.on("close", resolve);
        output.on("error", reject);
        archive.on("error", reject);

        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize().catch(reject);
    });
};

export const exportPictures = async (
    exportId: string,
    outerZipPath: string,
    params: PictureExportParams,
    signal?: AbortSignal
): Promise<void> => {
    await markExportRunning(exportId);

    throwIfAborted(signal);
    const devices = await getDevicesByIds(params.deviceIds);
    const deviceMap = new Map(devices.map((d) => [d.id, d]));
    const hiveIds = Array.from(
        new Set(devices.map((d) => d.hive_id).filter((id): id is number => id !== null && id !== undefined))
    );
    const hives = await getHivesByIds(hiveIds);
    const hiveMap = new Map(hives.map((h) => [h.id, h]));

    const workDir = path.join(path.dirname(outerZipPath), exportId);
    const imagesDir = path.join(workDir, "images");
    await ensureDir(imagesDir);

    const csvPath = path.join(workDir, "picture_export.csv");
    const csvStream = fs.createWriteStream(csvPath);
    csvStream.write(toCsvLine(["id", "hive_id", "hive_name", "device_id", "device_name", "time_utc", "file_name", "relative_path"]));

    try {
        let cursor: { deviceId: number; time: string | Date; id: number } | undefined;
        let progress = 0;
        // For pictures, we don't have a cheap total count; we'll update progress as we go
        while (true) {
            throwIfAborted(signal);
            const batch = await getPictureDataBatch(
                params.deviceIds,
                params.sTime,
                params.eTime,
                EXPORT_BATCH_SIZE,
                cursor
            );
            if (batch.length === 0) break;

            let lines = "";
            for (const row of batch) {
                throwIfAborted(signal);
                const device = deviceMap.get(row.device_id);
                const hiveId = device?.hive_id ?? null;
                const hiveName = hiveId !== null ? hiveMap.get(hiveId)?.name ?? "" : "";
                const filename = path.basename(row.path);
                const relativePath = path.join("images", row.path);
                const src = path.join(PICTURE_DIR, row.path);
                const dst = path.join(imagesDir, row.path);

                await fs.promises.mkdir(path.dirname(dst), { recursive: true });
                await fs.promises.copyFile(src, dst);

                lines += toCsvLine([
                    row.id,
                    hiveId ?? "",
                    hiveName,
                    row.device_id,
                    device?.name ?? "",
                    toUtcIsoString((row as any).time as unknown as string | Date),
                    filename,
                    relativePath,
                ]);
                progress += 1;
            }
            if (lines) {
                csvStream.write(lines);
            }

            const last = batch[batch.length - 1] as any;
            cursor = {
                deviceId: last.device_id,
                time: last.time,
                id: last.id,
            };
            await updateExportProgress(exportId, progress, null);
        }

        csvStream.end();
        await once(csvStream, "finish");

        throwIfAborted(signal);
        await zipDirectory(workDir, outerZipPath);

        const stats = await fs.promises.stat(outerZipPath);
        await markExportReady(exportId, stats.size);
    } catch (err) {
        csvStream.destroy();
        await fs.promises.rm(outerZipPath, { force: true }).catch(() => undefined);
        await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
        if (err instanceof ExportCanceledError) {
            await deleteExportRecord(exportId);
            return;
        }
        await markExportFailed(exportId, err instanceof Error ? err.message : String(err));
        throw err;
    }
};
