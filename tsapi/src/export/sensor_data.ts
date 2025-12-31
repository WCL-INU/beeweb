import fs from "fs";
import { once } from "events";
import path from "path";
import { EXPORT_BATCH_SIZE } from "./config";
import { countSensorData2Range, getSensorData2Batch } from "../db/data";
import { SensorData2Row } from "../types";
import { deleteExportRecord, markExportFailed, markExportReady, markExportRunning, updateExportProgress } from "../db/export";
import { getDataTypesByIds, getDevicesByIds, getHivesByIds } from "../db/lookup";

export interface SensorExportParams {
    deviceIds: number[];
    dataTypes: number[];
    sTime: string; // inclusive
    eTime: string; // inclusive
}

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

const csvEscape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

const toCsvLine = (values: unknown[]): string => values.map(csvEscape).join(",") + "\n";

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

export const exportSensorDataToCsv = async (
    exportId: string,
    filePath: string,
    params: SensorExportParams,
    signal?: AbortSignal
): Promise<void> => {
    await markExportRunning(exportId);

    const devices = await getDevicesByIds(params.deviceIds);
    const deviceMap = new Map(devices.map((d) => [d.id, d]));
    const hiveIds = Array.from(
        new Set(devices.map((d) => d.hive_id).filter((id): id is number => id !== null && id !== undefined))
    );
    const hives = await getHivesByIds(hiveIds);
    const hiveMap = new Map(hives.map((h) => [h.id, h]));
    const dataTypes = await getDataTypesByIds(params.dataTypes);
    const dataTypeMap = new Map(dataTypes.map((t) => [t.id, t]));

    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    const stream = fs.createWriteStream(filePath);
    stream.write(
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

    try {
        throwIfAborted(signal);
        const totalRows = await countSensorData2Range(params.deviceIds, params.sTime, params.eTime, params.dataTypes);
        await updateExportProgress(exportId, 0, totalRows);

        let exported = 0;
        let cursor: { deviceId: number; time: string | Date; id: number } | undefined;
        while (true) {
            throwIfAborted(signal);
            const rows: SensorData2Row[] = await getSensorData2Batch(
                params.deviceIds,
                params.sTime,
                params.eTime,
                params.dataTypes,
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
                stream.write(lines);
            }

            const last = rows[rows.length - 1] as any;
            cursor = {
                deviceId: last.device_id,
                time: last.time,
                id: last.id,
            };
            exported += rows.length;
            await updateExportProgress(exportId, exported, totalRows);
        }

        stream.end();
        await once(stream, "finish");
        throwIfAborted(signal);
        const stats = await fs.promises.stat(filePath);
        await markExportReady(exportId, stats.size);
    } catch (err) {
        stream.destroy();
        await fs.promises.rm(filePath, { force: true }).catch(() => undefined);
        if (err instanceof ExportCanceledError) {
            await deleteExportRecord(exportId);
            return;
        }
        await markExportFailed(exportId, err instanceof Error ? err.message : String(err));
        throw err;
    }
};
