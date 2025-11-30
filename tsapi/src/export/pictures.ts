import fs from "fs";
import path from "path";
import archiver from "archiver";
import { once } from "events";
import { EXPORT_BATCH_SIZE, PICTURE_DIR } from "./config";
import { getPictureDataBatch } from "../db/picture";
import { markExportFailed, markExportReady, markExportRunning, updateExportProgress } from "../db/export";

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
    params: PictureExportParams
): Promise<void> => {
    await markExportRunning(exportId);

    const workDir = path.join(path.dirname(outerZipPath), exportId);
    const imagesDir = path.join(workDir, "images");
    await ensureDir(imagesDir);

    const csvPath = path.join(workDir, "picture_export.csv");
    const csvStream = fs.createWriteStream(csvPath);
    csvStream.write(toCsvLine(["id", "hive_id", "hive_name", "device_id", "device_name", "time_utc", "file_name", "relative_path"]));

    try {
        let offset = 0;
        let progress = 0;
        // For pictures, we don't have a cheap total count; we'll update progress as we go
        while (true) {
            const batch = await getPictureDataBatch(
                params.deviceIds,
                params.sTime,
                params.eTime,
                EXPORT_BATCH_SIZE,
                offset
            );
            if (batch.length === 0) break;

            for (const row of batch) {
                const filename = path.basename(row.path);
                const relativePath = path.join("images", row.path);
                const src = path.join(PICTURE_DIR, row.path);
                const dst = path.join(imagesDir, row.path);

                await fs.promises.mkdir(path.dirname(dst), { recursive: true });
                await fs.promises.copyFile(src, dst);

                csvStream.write(
                    toCsvLine([
                        row.id,
                        row.hive_id ?? "",
                        row.hive_name ?? "",
                        row.device_id,
                        row.device_name ?? "",
                        row.time_utc,
                        filename,
                        relativePath,
                    ])
                );
                progress += 1;
            }

            offset += batch.length;
            await updateExportProgress(exportId, progress, null);
        }

        csvStream.end();
        await once(csvStream, "finish");

        await zipDirectory(workDir, outerZipPath);

        const stats = await fs.promises.stat(outerZipPath);
        await markExportReady(exportId, stats.size);
    } catch (err) {
        csvStream.destroy();
        await fs.promises.rm(outerZipPath, { force: true });
        await fs.promises.rm(workDir, { recursive: true, force: true });
        await markExportFailed(exportId, err instanceof Error ? err.message : String(err));
        throw err;
    }
};
