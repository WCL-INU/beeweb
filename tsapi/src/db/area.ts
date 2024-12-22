import { pool } from './index';
import { Area } from '../types';
import { ResultSetHeader } from 'mysql2';

// Fetch all areas
export const getAreas = async (): Promise<Area[]> => {
    try {
        const query = 'SELECT * FROM areas';
        const [rows] = await pool.execute(query);
        return rows as Area[];
    } catch (error) {
        throw error;
    }
}

// Fetch an area by ID
export const getAreaByAreaId = async (areaIdArray: number[]): Promise<Area[]> => {
    try {
        const placeholders = areaIdArray.map(() => '?').join(',');
        const query = `SELECT * FROM areas WHERE id IN (${placeholders})`;
        const [rows] = await pool.execute(query, areaIdArray);
        return rows as Area[];
    } catch (error) {
        throw error;
    }
}

export const addArea = async (
    name: string,
    location: string
): Promise<{ existing: boolean, areaId: number }> => {
    try {
        // Check for existing area
        const checkQuery = 'SELECT id FROM areas WHERE name = ?';
        const [checkResults] = await pool.execute(checkQuery, [name]);
        
        const areas_check = checkResults as Area[];
        if (areas_check.length > 0) {
            console.log(`Area already exists: ${areas_check[0].id} (name: ${name})`);
            return { existing: true, areaId: areas_check[0].id };
        }

        // Insert new area
        const insertQuery = 'INSERT INTO areas (name, location) VALUES (?, ?)';
        const [insertResults] = await pool.execute(insertQuery, [name, location]);
        const affectedRows = (insertResults as ResultSetHeader).affectedRows;
        if (affectedRows != 1) {
            throw new Error('Failed to insert area');
        }
        const insertId = (insertResults as ResultSetHeader).insertId;
        console.log(`Inserted area: ${insertId} (name: ${name})`);
        return { existing: false, areaId: insertId };
    } catch (error) {
        throw error;
    }
}

export const updateArea = async (
    areaId: number,
    name?: string,
    location?: string
): Promise<{updated: boolean, areaId: number}> => {
    try {

        let updates = [];
        let params = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (location !== undefined) {
            updates.push('location = ?');
            params.push(location);
        }

        if (updates.length === 0) {
            return { updated: false, areaId: areaId };
        }

        params.push(areaId);


        const query = `UPDATE areas SET ${updates.join(', ')} WHERE id = ?`;
        const [updateResults] = await pool.execute(query, params);
        const affectedRows = (updateResults as ResultSetHeader).affectedRows;
        if (affectedRows === 0) {
            console.log(`Area not found: ${areaId}`);
            return { updated: false, areaId: areaId };
        }

        console.log(`Area ${areaId} updated successfully ${updates.join(', ')}, ${params.slice(0, -1).join(', ')}`);
        return { updated: true, areaId: areaId };
    } catch (error) {
        throw error;
    }
}

export const deleteArea = async (areaId: number): Promise<{deleted: boolean, areaId: number}> => {
    try {
        const checkQuery = 'SELECT id FROM areas WHERE id = ?';
        const [checkResults] = await pool.execute(checkQuery, [areaId]);
        const areas_check = checkResults as Area[];
        if (areas_check.length === 0) {
            console.log(`Area not found: ${areaId}`);
            return { deleted: false, areaId: areaId };
        }

        const query = 'DELETE FROM areas WHERE id = ?';
        const [deleteResults] = await pool.execute(query, [areaId]);
        const affectedRows = (deleteResults as ResultSetHeader).affectedRows;
        if (affectedRows === 0) {
            console.log(`failed to delete area: ${areaId}`);
            return { deleted: false, areaId: areaId };
        }

        console.log(`Area ${areaId} deleted successfully`);
        return { deleted: true, areaId: areaId };
    } catch (error) {
        throw error;
    }
}

// export const addHive = async (
//     name: string,
//     areaId: number
// ): Promise<{ existing: boolean, hiveId: number }> => {
//     try {
//         // Check for existing hive
//         const checkQuery = 'SELECT id FROM hives WHERE area_id = ? AND name = ?';
//         const [checkResults] = await pool.execute(checkQuery, [areaId, name]);
        
//         const hives_check = checkResults as Hive[];
//         if (hives_check.length > 0) {
//             console.log(`Hive already exists: ${hives_check[0].id} (name: ${name}, area: ${areaId})`);
//             return { existing: true, hiveId: hives_check[0].id };
//         }

//         // Insert new hive
//         const insertQuery = 'INSERT INTO hives (area_id, name) VALUES (?, ?)';
//         const [insertResults] = await pool.execute(insertQuery, [areaId, name]);
//         const affectedRows = (insertResults as ResultSetHeader).affectedRows;
//         if (affectedRows != 1) {
//             throw new Error('Failed to insert hive');
//         }
//         const insertId = (insertResults as ResultSetHeader).insertId;
//         console.log(`Inserted hive: ${insertId} (name: ${name}, area: ${areaId})`);
//         return { existing: false, hiveId: insertId };
//     } catch (error) {
//         throw error;
//     }
// }


// // addArea
// const addArea = (connection, name, location) => {
//     // location 값이 없거나 위도, 경도 형태가 아니면
//     if (!location || !location.trim().match(/^\d+\.\d+,\s*\d+\.\d+$/)) {
//         location = '0.0, 0.0';
//     }

//     return new Promise((resolve, reject) => {
//         // 먼저 중복 체크
//         const checkQuery = 'SELECT id FROM areas WHERE name = ?';
//         connection.query(checkQuery, [name], (checkError, checkResults) => {
//             if (checkError) {
//                 console.error('Error checking area:', checkError);
//                 return reject(checkError);
//             }
//             if (checkResults.length > 0) {
//                 // 이미 존재하는 경우
//                 console.log(`Area already exists: ${checkResults[0].id} (name: ${name})`);
//                 return resolve({ existing: true, areaId: checkResults[0].id });
//             } else {
//                 // 존재하지 않으면 새로 삽입
//                 const insertQuery = 'INSERT INTO areas (name, location) VALUES (?, ?)';
//                 connection.query(insertQuery, [name, location], (insertError, insertResults) => {
//                     if (insertError) {
//                         console.error('Error adding area:', insertError);
//                         return reject(insertError);
//                     }
//                     console.log(`Inserted area: ${insertResults.insertId} (name: ${name})`);
//                     return resolve({ existing: false, areaId: insertResults.insertId });
//                 });
//             }
//         });
//     });
// }