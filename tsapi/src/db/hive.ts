
import { pool } from './index';
import { Hive } from '../types';
import { ResultSetHeader } from 'mysql2';

// Fetch a hive by ID
export const getHiveByHiveId = async (hiveIdArray: number[]): Promise<Hive[]> => {
    try {
        const placeholders = hiveIdArray.map(() => '?').join(',');
        const query = `SELECT * FROM hives WHERE id IN (${placeholders})`;
        const [rows] = await pool.execute(query, hiveIdArray);
        return rows as Hive[];
    } catch (error) {
        throw error;
    }
}
// Fetch hives by area ID
export const getHivesByAreaId = async (areaId: number): Promise<Hive[]> => {
    try {
        const query = 'SELECT * FROM hives WHERE area_id = ?';
        const [rows] = await pool.execute(query, [areaId]);
        return rows as Hive[];
    } catch (error) {
        throw error;
    }
}

export const addHive = async (
    name: string,
    areaId: number
): Promise<{ existing: boolean, hiveId: number }> => {
    try {
        // Check for existing hive
        const checkQuery = 'SELECT id FROM hives WHERE area_id = ? AND name = ?';
        const [checkResults] = await pool.execute(checkQuery, [areaId, name]);
        
        const hives_check = checkResults as Hive[];
        if (hives_check.length > 0) {
            console.log(`Hive already exists: ${hives_check[0].id} (name: ${name}, area: ${areaId})`);
            return { existing: true, hiveId: hives_check[0].id };
        }

        // Insert new hive
        const insertQuery = 'INSERT INTO hives (area_id, name) VALUES (?, ?)';
        const [insertResults] = await pool.execute(insertQuery, [areaId, name]);
        const affectedRows = (insertResults as ResultSetHeader).affectedRows;
        if (affectedRows != 1) {
            throw new Error('Failed to insert hive');
        }
        const insertId = (insertResults as ResultSetHeader).insertId;
        console.log(`Inserted hive: ${insertId} (name: ${name}, area: ${areaId})`);
        return { existing: false, hiveId: insertId };
    } catch (error) {
        throw error;
    }
}

export const updateHive = async (
    hiveId: number,
    name?: string,
    areaId?: number,
): Promise<{ updated: boolean, hiveId: number }> => {
    try {
        // Update hive
        let updates = [];
        let params = [];

        if (areaId !== undefined) {
            updates.push('area_id = ?');
            params.push(areaId);
        }

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }

        if (updates.length === 0) {
            return { updated: false, hiveId: hiveId };
        }

        params.push(hiveId);

        const query = `UPDATE hives SET ${updates.join(', ')} WHERE id = ?`;
        const [updateResults] = await pool.execute(query, params);
        const affectedRows = (updateResults as ResultSetHeader).affectedRows;
        if (affectedRows === 0) {
            console.log(`Hive not found: ${hiveId}`);
            return { updated: false, hiveId: hiveId };
        }

        console.log(`Hive ${hiveId} updated successfully: ${updates.join(', ')}, ${params.slice(0, -1).join(', ')}`);
        return { updated: true, hiveId: hiveId };
    } catch (error) {
        throw error;
    }
}

export const deleteHive = async (hiveId: number): Promise<{ deleted: boolean, hiveId: number }> => {
    try {
        const checkQuery = 'SELECT id FROM hives WHERE id = ?';
        const [checkResults] = await pool.execute(checkQuery, [hiveId]);
        const hives_check = checkResults as Hive[];
        if (hives_check.length === 0) {
            console.log(`Hive not found: ${hiveId}`);
            return { deleted: false, hiveId: hiveId };
        }

        const query = 'DELETE FROM hives WHERE id = ?';
        const [deleteResults] = await pool.execute(query, [hiveId]);
        const affectedRows = (deleteResults as ResultSetHeader).affectedRows;
        if (affectedRows === 0) {
            console.log(`failed to delete hive: ${hiveId}`);
            return { deleted: false, hiveId: hiveId };
        }

        console.log(`Hive ${hiveId} deleted successfully`);
        return { deleted: true, hiveId: hiveId };
    } catch (error) {
        throw error;
    }
}