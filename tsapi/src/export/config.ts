import path from "path";

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const EXPORT_DIR = process.env.EXPORT_DIR || path.join(process.cwd(), "tmp", "exports");
export const EXPORT_TTL_HOURS = parsePositiveInt(process.env.EXPORT_TTL_HOURS, 24);
export const EXPORT_BATCH_SIZE = parsePositiveInt(process.env.EXPORT_BATCH_SIZE, 5000);
export const EXPORT_MAX_CONCURRENCY = parsePositiveInt(process.env.EXPORT_MAX_CONCURRENCY, 1);
export const PICTURE_DIR = process.env.PICTURE_DIR || "/app/db/picture";
export const EXIF_TZ = process.env.EXIF_TZ || "+09:00"; // Asia/Seoul default
