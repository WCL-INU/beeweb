import fs from "fs";
import path from "path";
import archiver from "archiver";
import { once } from "events";
import { EXPORT_BATCH_SIZE, PICTURE_DIR } from "./config";
import { countSensorData2Range, getSensorData2Batch } from "../db/data";
import { getPictureDataBatch } from "../db/picture";
import { SensorData2Row } from "../types";
import { deleteExportRecord, markExportFailed, markExportReady, markExportRunning, updateExportProgress } from "../db/export";
import { getDataTypesByIds, getDevicesByIds, getHivesByIds } from "../db/lookup";

export interface MixedExportParams {
    deviceIds: number[];
    dataTypes: number[]; // data_type 1 == PICTURE, 2~7 == sensor
    sTime: string; // inclusive, 'YYYY-MM-DD HH:MM:SS'
    eTime: string; // inclusive
}

const SENSOR_TYPES = new Set([2, 3, 4, 5, 6, 7]);
const PICTURE_TYPE = 1;

const csvEscape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

const toCsvLine = (values: unknown[]): string => values.map(csvEscape).join(",") + "\n";

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

const valueFromRow = (row: SensorData2Row): number | string | null => {
    if ((row as any).data_int !== null && (row as any).data_int !== undefined) return (row as any).data_int;
    if ((row as any).data_float !== null && (row as any).data_float !== undefined) return (row as any).data_float;
    return null;
};

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

export const exportMixed = async (
    exportId: string,
    outZipPath: string,
    params: MixedExportParams,
    signal?: AbortSignal
): Promise<void> => {
    await markExportRunning(exportId);

    const workDir = path.join(path.dirname(outZipPath), exportId);
    const sensorTypes = (params.dataTypes || []).filter((t) => SENSOR_TYPES.has(Number(t))).map(Number);
    const includePictures = (params.dataTypes || []).some((t) => Number(t) === PICTURE_TYPE);

    let progress = 0;
    let totalRows: number | null = null;

    try {
        await ensureDir(workDir);
        throwIfAborted(signal);
        const devices = await getDevicesByIds(params.deviceIds);
        const deviceMap = new Map(devices.map((d) => [d.id, d]));
        const hiveIds = Array.from(
            new Set(devices.map((d) => d.hive_id).filter((id): id is number => id !== null && id !== undefined))
        );
        const hives = await getHivesByIds(hiveIds);
        const hiveMap = new Map(hives.map((h) => [h.id, h]));
        const dataTypes = sensorTypes.length ? await getDataTypesByIds(sensorTypes) : [];
        const dataTypeMap = new Map(dataTypes.map((t) => [t.id, t]));


        // 1) 센서 CSV
        if (sensorTypes.length > 0) {
            const sensorCsvPath = path.join(workDir, "sensor_export.csv");
            const sensorStream = fs.createWriteStream(sensorCsvPath);
            sensorStream.write(
                toCsvLine([
                    "id",
                    "hive_id",
                    "hive_name",
                    "device_id",
                    "device_name",
                    "data_type_name",
                    "data_type",
                    "time_utc",
                    "value",
                ])
            );

            const total = await countSensorData2Range(params.deviceIds, params.sTime, params.eTime, sensorTypes);
            totalRows = total;
            await updateExportProgress(exportId, progress, totalRows);

            let cursor: { deviceId: number; time: string | Date; id: number } | undefined;
            while (true) {
                throwIfAborted(signal);
                const rows: SensorData2Row[] = await getSensorData2Batch(
                    params.deviceIds,
                    params.sTime,
                    params.eTime,
                    sensorTypes,
                    EXPORT_BATCH_SIZE,
                    cursor
                );
                if (rows.length === 0) break;

                const lines = rows
                    .map((row) => {
                        const device = deviceMap.get(row.device_id);
                        const hiveId = device?.hive_id ?? null;
                        const hiveName = hiveId !== null ? hiveMap.get(hiveId)?.name ?? "" : "";
                        return toCsvLine([
                            row.id,
                            hiveId ?? "",
                            hiveName,
                            row.device_id,
                            device?.name ?? "",
                            dataTypeMap.get((row as any).data_type)?.name ?? "",
                            (row as any).data_type,
                            toUtcIsoString((row as any).time as unknown as string | Date),
                            valueFromRow(row),
                        ]);
                    })
                    .join("");
                if (lines) {
                    sensorStream.write(lines);
                }

                const last = rows[rows.length - 1] as any;
                cursor = {
                    deviceId: last.device_id,
                    time: last.time,
                    id: last.id,
                };
                progress += rows.length;
                await updateExportProgress(exportId, progress, totalRows);
            }

            sensorStream.end();
            await once(sensorStream, "finish");
        }

        // 2) 사진 CSV + 이미지 복사
        if (includePictures) {
            const imagesDir = path.join(workDir, "images");
            await ensureDir(imagesDir);

            const pictureCsvPath = path.join(workDir, "picture_export.csv");
            const pictureStream = fs.createWriteStream(pictureCsvPath);
            pictureStream.write(
                toCsvLine(["id", "hive_id", "hive_name", "device_id", "device_name", "time_utc", "file_name", "relative_path"])
            );

            let cursor: { deviceId: number; time: string | Date; id: number } | undefined;
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
                    pictureStream.write(lines);
                }
                await updateExportProgress(exportId, progress, totalRows);

                const last = batch[batch.length - 1] as any;
                cursor = {
                    deviceId: last.device_id,
                    time: last.time,
                    id: last.id,
                };
            }

            pictureStream.end();
            await once(pictureStream, "finish");
        }

        // 3) ZIP 생성
        throwIfAborted(signal);
        await zipDirectory(workDir, outZipPath);
        const stats = await fs.promises.stat(outZipPath);
        await markExportReady(exportId, stats.size);
    } catch (err) {
        await fs.promises.rm(outZipPath, { force: true }).catch(() => undefined);
        await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
        if (err instanceof ExportCanceledError) {
            await deleteExportRecord(exportId);
            return;
        }
        await markExportFailed(exportId, err instanceof Error ? err.message : String(err));
        throw err;
    } finally {
        // 작업 디렉터리는 정리 (ZIP 성공/실패와 무관)
        await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
};
