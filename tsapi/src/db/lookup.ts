import { pool } from "./index";

export interface DeviceLookupRow {
    id: number;
    name: string | null;
    hive_id: number | null;
}

export interface HiveLookupRow {
    id: number;
    name: string | null;
}

export interface DataTypeLookupRow {
    id: number;
    name: string | null;
}

const makePlaceholders = (ids: number[]): string => ids.map(() => "?").join(", ");

export const getDevicesByIds = async (deviceIds: number[]): Promise<DeviceLookupRow[]> => {
    if (!deviceIds.length) return [];
    const placeholders = makePlaceholders(deviceIds);
    const query = `SELECT id, name, hive_id FROM devices WHERE id IN (${placeholders})`;
    const [rows] = await pool.execute(query, deviceIds);
    return rows as DeviceLookupRow[];
};

export const getHivesByIds = async (hiveIds: number[]): Promise<HiveLookupRow[]> => {
    if (!hiveIds.length) return [];
    const placeholders = makePlaceholders(hiveIds);
    const query = `SELECT id, name FROM hives WHERE id IN (${placeholders})`;
    const [rows] = await pool.execute(query, hiveIds);
    return rows as HiveLookupRow[];
};

export const getDataTypesByIds = async (dataTypeIds: number[]): Promise<DataTypeLookupRow[]> => {
    if (!dataTypeIds.length) return [];
    const placeholders = makePlaceholders(dataTypeIds);
    const query = `SELECT id, name FROM data_types WHERE id IN (${placeholders})`;
    const [rows] = await pool.execute(query, dataTypeIds);
    return rows as DataTypeLookupRow[];
};
