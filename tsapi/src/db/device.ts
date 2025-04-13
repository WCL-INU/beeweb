import { pool } from './index';
import { Device, DeviceType } from '../types';
import { ResultSetHeader } from 'mysql2';

export const getDeviceTypes = async (): Promise<DeviceType[]> => {
    try {
        const query = 'SELECT * FROM device_types';
        const [rows] = await pool.execute(query);
        return rows as DeviceType[];
    } catch (error) {
        throw error;
    }
}

// Fetch a device by ID
export const getDeviceByDeviceId = async (deiceIdArray: number[]): Promise<Device[]> => {
    try {
        const placeholders = deiceIdArray.map(() => '?').join(',');
        const query = `SELECT * FROM devices WHERE id IN (${placeholders})`;
        const [rows] = await pool.execute(query, deiceIdArray);
        return rows as Device[];
    } catch (error) {
        throw error;
    }
}

// Fetch devices by hive ID
export const getDevicesByHiveId = async (hiveId: number): Promise<Device[]> => {
    try {
        const query = 'SELECT * FROM devices WHERE hive_id = ?';
        const [rows] = await pool.execute(query, [hiveId]);
        return rows as Device[];
    } catch (error) {
        throw error;
    }
}

export const addDevice = async (
    name: string,
    hiveId: number,
    typeId: number
): Promise<{ existing: boolean, deviceId: number }> => {
    try {
        // Check for existing device
        const checkQuery = 'SELECT id FROM devices WHERE name = ? AND hive_id = ? AND type_id = ?';
        const [checkResults] = await pool.execute(checkQuery, [name, hiveId, typeId]);
        
        const devices_check = checkResults as Device[];
        if (devices_check.length > 0) {
            console.log(`Device already exists: ${devices_check[0].id} (name: ${name}, hive: ${hiveId}, type: ${typeId})`);
            return { existing: true, deviceId: devices_check[0].id };
        }

        // Insert new device
        const insertQuery = 'INSERT INTO devices (name, hive_id, type_id) VALUES (?, ?, ?)';
        const [insertResults] = await pool.execute(insertQuery, [name, hiveId, typeId]);
        const affectedRows = (insertResults as ResultSetHeader).affectedRows;
        if (affectedRows != 1) {
            throw new Error('Failed to insert device');
        }
        const insertId = (insertResults as ResultSetHeader).insertId;
        console.log(`Inserted device: ${insertId} (name: ${name}, hive: ${hiveId}, type: ${typeId})`);
        return { existing: false, deviceId: insertId };
    } catch (error) {
        throw error;
    }
}

export const updateDevice = async (
    deviceId: number,
    name?: string,
    modemIp?: string
): Promise<{ updated: boolean, deviceId: number }> => {
    try {
        // Update device
        let updates = [];
        let params = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }

        if (modemIp !== undefined) {
            updates.push('modem_ip = ?');
            params.push(modemIp);
        }

        if (updates.length === 0) {
            return { updated: false, deviceId: deviceId };
        }

        params.push(deviceId);

        const query = `UPDATE devices SET ${updates.join(', ')} WHERE id = ?`;
        const [updateResults] = await pool.execute(query, params);
        const affectedRows = (updateResults as ResultSetHeader).affectedRows;
        if (affectedRows === 0) {
            console.log(`Device not found: ${deviceId}`);
            return { updated: false, deviceId: deviceId };
        }

        console.log(`Device ${deviceId} updated successfully: ${updates.join(', ')}, ${params.slice(0, -1).join(', ')}`);
        return { updated: true, deviceId: deviceId };
    } catch (error) {
        throw error;
    }
}

export const deleteDevice = async (deviceId: number): Promise<{ deleted: boolean, deviceId: number }> => {
    try {
        const checkQuery = 'SELECT id FROM devices WHERE id = ?';
        const [checkResults] = await pool.execute(checkQuery, [deviceId]);
        const devices_check = checkResults as Device[];
        if (devices_check.length === 0) {
            console.log(`Device not found: ${deviceId}`);
            return { deleted: false, deviceId: deviceId };
        }

        const query = 'DELETE FROM devices WHERE id = ?';
        const [deleteResults] = await pool.execute(query, [deviceId]);
        const affectedRows = (deleteResults as ResultSetHeader).affectedRows;
        if (affectedRows === 0) {
            console.log(`failed to delete device: ${deviceId}`);
            return { deleted: false, deviceId: deviceId };
        }

        console.log(`Deleted device: ${deviceId}`);
        return { deleted: true, deviceId: deviceId };
    } catch (error) {
        throw error;
    }
}


// 해당 type의 장치 id가 있는지 확인
export const checkDevce = async (deviceId: number, typeId: number): Promise<boolean> => {
    try {
        const query = 'SELECT id FROM devices WHERE id = ? AND type_id = ?';
        const [rows] = await pool.execute(query, [deviceId, typeId]);
        const devices_check = rows as Device[];
        if (devices_check.length === 0) {
            console.log(`Device not found: ${deviceId} (type: ${typeId})`);
            return false;
        }
        console.log(`Device found: ${deviceId} (type: ${typeId})`);
        return true;
    } catch (error) {
        throw error;
    }
}