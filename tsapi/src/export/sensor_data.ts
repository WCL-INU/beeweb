import fs from "fs";
import { once } from "events";
import path from "path";
import { EXPORT_BATCH_SIZE } from "./config";
import { countSensorData2Range, getSensorData2Batch } from "../db/data";
import { SensorData2Row } from "../types";
import { markExportFailed, markExportReady, markExportRunning, updateExportProgress } from "../db/export";

export interface SensorExportParams {
    deviceId: number;
    dataTypes: number[];
    sTime: string; // inclusive
    eTime: string; // inclusive
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

const valueFromRow = (row: SensorData2Row): number | string | null => {
    if ((row as any).data_int !== null && (row as any).data_int !== undefined) return (row as any).data_int;
    if ((row as any).data_float !== null && (row as any).data_float !== undefined) return (row as any).data_float;
    return null;
};

const toUtcIsoString = (utcString: string): string => {
    if (!utcString.endsWith("Z")) {
        throw new Error("time must be a UTC string ending with 'Z'");
    }
    const date = new Date(utcString);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid UTC date value: ${utcString}`);
    }
    return date.toISOString();
};

export const exportSensorDataToCsv = async (
    exportId: string,
    filePath: string,
    params: SensorExportParams
): Promise<void> => {
    await markExportRunning(exportId);

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
        const totalRows = await countSensorData2Range(params.deviceId, params.sTime, params.eTime, params.dataTypes);
        await updateExportProgress(exportId, 0, totalRows);

        let offset = 0;
        while (true) {
            const rows: SensorData2Row[] = await getSensorData2Batch(
                params.deviceId,
                params.sTime,
                params.eTime,
                params.dataTypes,
                EXPORT_BATCH_SIZE,
                offset
            );
            if (rows.length === 0) break;

            for (const row of rows) {
                stream.write(
                    toCsvLine([
                        row.id,
                        (row as any).hive_id ?? "",
                        (row as any).hive_name ?? "",
                        row.device_id,
                        (row as any).device_name ?? "",
                        (row as any).data_type_name ?? "",
                        (row as any).data_type,
                        toUtcIsoString(row.time as unknown as string),
                        valueFromRow(row),
                    ])
                );
            }

            offset += rows.length;
            await updateExportProgress(exportId, offset, totalRows);
        }

        stream.end();
        await once(stream, "finish");
        const stats = await fs.promises.stat(filePath);
        await markExportReady(exportId, stats.size);
    } catch (err) {
        stream.destroy();
        await fs.promises.rm(filePath, { force: true });
        await markExportFailed(exportId, err instanceof Error ? err.message : String(err));
        throw err;
    }
};
