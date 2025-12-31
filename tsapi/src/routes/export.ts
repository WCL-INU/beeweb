import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import {
    createSensorExport,
    createPictureExport,
    createMixedExport,
    loadExport,
    cancelExport,
    cleanupExpiredExports,
    cleanupOrphanExports,
    listExports,
} from "../export/service";

const router = express.Router();
router.use(express.json());

const ensureUtc = (label: string, value: unknown): string => {
    if (typeof value !== "string" || !value.endsWith("Z")) {
        throw new Error(`${label} must be an ISO string ending with 'Z' (UTC)`);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`${label} is not a valid date`);
    }
    // Convert to MySQL DATETIME string in UTC
    return date.toISOString().replace("T", " ").replace("Z", "").slice(0, 19);
};

// #swagger.tags = ['Export']
// #swagger.description = 'List export jobs (shared)'
router.get("/", async (req: Request, res: Response) => {
    try {
        const limit = Number(req.query.limit);
        const offset = Number(req.query.offset);
        const records = await listExports(limit, offset);
        const payload = records.map((record) => ({
            id: record.id,
            type: record.type,
            status: record.status,
            progress: record.progress,
            totalRows: record.total_rows,
            fileSize: record.file_size,
            createdAt: record.created_at,
            completedAt: record.completed_at,
            expiresAt: record.expires_at,
            params: record.params,
            error: record.error,
        }));
        res.json(payload);
    } catch (err) {
        console.error("[export] failed to list exports:", err);
        res.status(500).json({ error: "Failed to list exports" });
    }
});

// #swagger.tags = ['Export']
// #swagger.description = 'Create sensor_data2 CSV export'
router.post("/data", async (req: Request, res: Response) => {
    /* #swagger.requestBody = {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        deviceIds: [1,2],
                        dataTypes: [2,3,4],
                        sTime: "2025-01-01T00:00:00Z",
                        eTime: "2025-01-02T00:00:00Z"
                    }
                }
            }
       }
     */
    try {
        const deviceIdsRaw = req.body?.deviceIds ?? req.body?.deviceId;
        const sTimeRaw = req.body?.sTime as string;
        const eTimeRaw = req.body?.eTime as string;
        const dataTypesRaw = req.body?.dataTypes;

        const dataTypes: number[] = Array.isArray(dataTypesRaw)
            ? dataTypesRaw.map(Number).filter((n) => Number.isFinite(n))
            : typeof dataTypesRaw === "string"
            ? dataTypesRaw
                  .split(",")
                  .map((s) => Number(s.trim()))
                  .filter((n) => Number.isFinite(n))
            : [];

        const deviceIds: number[] = Array.isArray(deviceIdsRaw)
            ? deviceIdsRaw.map(Number).filter((n) => Number.isFinite(n))
            : typeof deviceIdsRaw === "string"
            ? deviceIdsRaw
                  .split(",")
                  .map((s) => Number(s.trim()))
                  .filter((n) => Number.isFinite(n))
            : [];

        if (deviceIds.length === 0 || !sTimeRaw || !eTimeRaw || dataTypes.length === 0) {
            res.status(400).json({ error: "deviceIds (or deviceId), dataTypes, sTime, eTime are required" });
            return;
        }

        const sTime = ensureUtc("sTime", sTimeRaw);
        const eTime = ensureUtc("eTime", eTimeRaw);

        const exportId = await createSensorExport({ deviceIds, dataTypes, sTime, eTime });
        res.status(202).json({ exportId });
    } catch (err) {
        console.error("[export] failed to create sensor export:", err);
        const message = err instanceof Error ? err.message : "Failed to create export";
        res.status(500).json({ error: message });
    }
});

// #swagger.tags = ['Export']
// #swagger.description = 'Create picture export (CSV + images zipped twice)'
router.post("/pictures", async (req: Request, res: Response) => {
    /* #swagger.requestBody = {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        deviceIds: [1,2],
                        sTime: "2025-01-01T00:00:00Z",
                        eTime: "2025-01-02T00:00:00Z"
                    }
                }
            }
       }
     */
    try {
        const deviceIdsRaw = req.body?.deviceIds ?? req.body?.deviceId;
        const sTimeRaw = req.body?.sTime as string;
        const eTimeRaw = req.body?.eTime as string;

        const deviceIds: number[] = Array.isArray(deviceIdsRaw)
            ? deviceIdsRaw.map(Number).filter((n) => Number.isFinite(n))
            : typeof deviceIdsRaw === "string"
            ? deviceIdsRaw
                  .split(",")
                  .map((s) => Number(s.trim()))
                  .filter((n) => Number.isFinite(n))
            : [];

        if (deviceIds.length === 0 || !sTimeRaw || !eTimeRaw) {
            res.status(400).json({ error: "deviceIds (or deviceId), sTime, eTime are required" });
            return;
        }

        const sTime = ensureUtc("sTime", sTimeRaw);
        const eTime = ensureUtc("eTime", eTimeRaw);

        const exportId = await createPictureExport({ deviceIds, sTime, eTime });
        res.status(202).json({ exportId });
    } catch (err) {
        console.error("[export] failed to create picture export:", err);
        const message = err instanceof Error ? err.message : "Failed to create export";
        res.status(500).json({ error: message });
    }
});

// #swagger.tags = ['Export']
// #swagger.description = 'Create mixed export (sensor CSV + picture CSV + images zip)'
router.post("/mixed", async (req: Request, res: Response) => {
    /* #swagger.requestBody = {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        deviceIds: [1,2],
                        dataTypes: [1,2,3,4], // 1=PICTURE, 2~7=sensor
                        sTime: "2025-01-01T00:00:00Z",
                        eTime: "2025-01-02T00:00:00Z"
                    }
                }
            }
       }
     */
    try {
        const deviceIdsRaw = req.body?.deviceIds ?? req.body?.deviceId;
        const sTimeRaw = req.body?.sTime as string;
        const eTimeRaw = req.body?.eTime as string;
        const dataTypesRaw = req.body?.dataTypes;

        const dataTypes: number[] = Array.isArray(dataTypesRaw)
            ? dataTypesRaw.map(Number).filter((n) => Number.isFinite(n))
            : typeof dataTypesRaw === "string"
            ? dataTypesRaw
                  .split(",")
                  .map((s) => Number(s.trim()))
                  .filter((n) => Number.isFinite(n))
            : [];

        const deviceIds: number[] = Array.isArray(deviceIdsRaw)
            ? deviceIdsRaw.map(Number).filter((n) => Number.isFinite(n))
            : typeof deviceIdsRaw === "string"
            ? deviceIdsRaw
                  .split(",")
                  .map((s) => Number(s.trim()))
                  .filter((n) => Number.isFinite(n))
            : [];

        const hasPicture = dataTypes.includes(1);
        const hasSensor = dataTypes.some((t) => t !== 1);

        if (deviceIds.length === 0 || !sTimeRaw || !eTimeRaw || (!hasPicture && !hasSensor)) {
            res.status(400).json({ error: "deviceIds (or deviceId), dataTypes(1=picture,2~7=sensor), sTime, eTime are required" });
            return;
        }

        const sTime = ensureUtc("sTime", sTimeRaw);
        const eTime = ensureUtc("eTime", eTimeRaw);

        const exportId = await createMixedExport({ deviceIds, dataTypes, sTime, eTime });
        res.status(202).json({ exportId });
    } catch (err) {
        console.error("[export] failed to create mixed export:", err);
        const message = err instanceof Error ? err.message : "Failed to create export";
        res.status(500).json({ error: message });
    }
});

// #swagger.tags = ['Export']
// #swagger.description = 'Get export status'
router.get("/:id/status", async (req: Request, res: Response) => {
    try {
        const record = await loadExport(req.params.id);
        if (!record) {
            res.status(404).json({ error: "Export not found" });
            return;
        }
        res.json({
            id: record.id,
            type: record.type,
            status: record.status,
            progress: record.progress,
            totalRows: record.total_rows,
            fileSize: record.file_size,
            createdAt: record.created_at,
            completedAt: record.completed_at,
            expiresAt: record.expires_at,
            params: record.params,
            error: record.error,
        });
    } catch (err) {
        console.error("[export] failed to fetch status:", err);
        res.status(500).json({ error: "Failed to fetch status" });
    }
});

// #swagger.tags = ['Export']
// #swagger.description = 'Download ready CSV export'
router.get("/:id/download", async (req: Request, res: Response) => {
    try {
        const record = await loadExport(req.params.id);
        if (!record || record.status !== "ready" || !record.file_path) {
            res.status(404).json({ error: "Export not ready" });
            return;
        }
        const exists = await fs.promises
            .access(record.file_path, fs.constants.R_OK)
            .then(() => true)
            .catch(() => false);
        if (!exists) {
            res.status(404).json({ error: "File not found" });
            return;
        }
        const filename = path.basename(record.file_path);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        fs.createReadStream(record.file_path).pipe(res);
    } catch (err) {
        console.error("[export] failed to download:", err);
        res.status(500).json({ error: "Failed to download export" });
    }
});

// #swagger.tags = ['Export']
// #swagger.description = 'Cancel running export or delete completed export'
router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const ok = await cancelExport(req.params.id);
        if (!ok) {
            res.status(404).json({ error: "Export not found" });
            return;
        }
        res.json({ message: "Export removed" });
    } catch (err) {
        console.error("[export] failed to delete:", err);
        res.status(500).json({ error: "Failed to delete export" });
    }
});

// Utility endpoint to trigger cleanup manually (optional)
// #swagger.tags = ['Export']
// #swagger.description = 'Run cleanup for expired exports (optional)'
router.post("/cleanup", async (_req: Request, res: Response) => {
    try {
        await cleanupExpiredExports();
        await cleanupOrphanExports();
        res.json({ message: "Cleanup started" });
    } catch (err) {
        console.error("[export] cleanup failed:", err);
        res.status(500).json({ error: "Failed to run cleanup" });
    }
});

export default router;
