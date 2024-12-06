
import { pool } from './index';
import { Hive } from '../types';
import { ResultSetHeader } from 'mysql2';

// Fetch a hive by ID
export const getHiveByHiveId = async (hiveIdArray: number): Promise<any[]> => {
    try {
        const query = 'SELECT * FROM hives WHERE id = ?';
        const [rows] = await pool.execute(query, [hiveIdArray]);
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


// import { pool } from './index';
// import { Device } from '../types';
// import { ResultSetHeader } from 'mysql2';

// // Fetch a device by ID
// export const getDeviceByDeviceId = async (deiceIdArray: number[]): Promise<Device[]> => {
//     try {
//         const placeholders = deiceIdArray.map(() => '?').join(',');
//         const query = `SELECT * FROM devices WHERE id IN (${placeholders})`;
//         const [rows] = await pool.execute(query, deiceIdArray);
//         return rows as Device[];
//     } catch (error) {
//         throw error;
//     }
// }
// // Fetch devices by hive ID
// export const getDevicesByHiveId = async (hiveId: number): Promise<Device[]> => {
//     try {
//         const query = 'SELECT * FROM devices WHERE hive_id = ?';
//         const [rows] = await pool.execute(query, [hiveId]);
//         return rows as Device[];
//     } catch (error) {
//         throw error;
//     }
// }

// export const addDevice = async (
//     name: string,
//     hiveId: number,
//     typeId: number
// ): Promise<{ existing: boolean, deviceId: number }> => {
//     try {
//         // Check for existing device
//         const checkQuery = 'SELECT id FROM devices WHERE name = ? AND hive_id = ? AND type_id = ?';
//         const [checkResults] = await pool.execute(checkQuery, [name, hiveId, typeId]);
        
//         const devices_check = checkResults as Device[];
//         if (devices_check.length > 0) {
//             console.log(`Device already exists: ${devices_check[0].id} (name: ${name}, hive: ${hiveId}, type: ${typeId})`);
//             return { existing: true, deviceId: devices_check[0].id };
//         }

//         // Insert new device
//         const insertQuery = 'INSERT INTO devices (name, hive_id, type_id) VALUES (?, ?, ?)';
//         const [insertResults] = await pool.execute(insertQuery, [name, hiveId, typeId]);
//         const affectedRows = (insertResults as ResultSetHeader).affectedRows;
//         if (affectedRows != 1) {
//             throw new Error('Failed to insert device');
//         }
//         const insertId = (insertResults as ResultSetHeader).insertId;
//         console.log(`Inserted device: ${insertId} (name: ${name}, hive: ${hiveId}, type: ${typeId})`);
//         return { existing: false, deviceId: insertId };
//     } catch (error) {
//         throw error;
//     }
// }

// export const updateDevice = async (
//     deviceId: number,
//     name?: string,
//     modemIp?: string
// ): Promise<{ updated: boolean, deviceId: number }> => {
//     try {
//         // Update device
//         let updates = [];
//         let params = [];

//         if (name !== undefined) {
//             updates.push('name = ?');
//             params.push(name);
//         }

//         if (modemIp !== undefined) {
//             updates.push('modem_ip = ?');
//             params.push(modemIp);
//         }

//         if (updates.length === 0) {
//             return { updated: false, deviceId: deviceId };
//         }

//         params.push(deviceId);

//         const query = `UPDATE devices SET ${updates.join(', ')} WHERE id = ?`;
//         const [updateResults] = await pool.execute(query, params);
//         const affectedRows = (updateResults as ResultSetHeader).affectedRows;
//         if (affectedRows === 0) {
//             console.log(`Device not found: ${deviceId}`);
//             return { updated: false, deviceId: deviceId };
//         }

//         console.log(`Device ${deviceId} updated successfully: ${updates.join(', ')}, ${params.slice(0, -1).join(', ')}`);
//         return { updated: true, deviceId: deviceId };
//     } catch (error) {
//         throw error;
//     }
// }

// export const deleteDevice = async (deviceId: number): Promise<{ deleted: boolean, deviceId: number }> => {
//     try {
//         const checkQuery = 'SELECT id FROM devices WHERE id = ?';
//         const [checkResults] = await pool.execute(checkQuery, [deviceId]);
//         const devices_check = checkResults as Device[];
//         if (devices_check.length === 0) {
//             console.log(`Device not found: ${deviceId}`);
//             return { deleted: false, deviceId: deviceId };
//         }

//         const query = 'DELETE FROM devices WHERE id = ?';
//         const [deleteResults] = await pool.execute(query, [deviceId]);
//         const affectedRows = (deleteResults as ResultSetHeader).affectedRows;
//         if (affectedRows === 0) {
//             console.log(`failed to delete device: ${deviceId}`);
//             return { deleted: false, deviceId: deviceId };
//         }

//         console.log(`Deleted device: ${deviceId}`);
//         return { deleted: true, deviceId: deviceId };
//     } catch (error) {
//         throw error;
//     }
// }


// // =============================
// // HIVE
// // =============================
// app.get('/api/hive', async (req, res) => {
//     const { areaId, hiveId } = req.query;
  
//     // areaId와 hiveId가 모두 없을 때 에러 처리
//     if (!areaId && !hiveId) {
//       return res.status(400).send('Bad Request: Missing areaId or hiveId');
//     }
  
//     try {
//       let hives;
  
//       // hiveId가 있으면 해당 hiveId로 검색
//       if (hiveId) {
//         hives = await database.getHiveByHiveId(dbConnection, hiveId.split(','));
//       } else {
//         // hiveId가 없으면 areaId로 검색
//         hives = await database.getHivesByAreaId(dbConnection, areaId);
//       }
  
//       return res.status(200).json(hives);
//     } catch (error) {
//       console.error('Error fetching hives:', error);
//       return res.status(500).send('Internal Server Error');
//     }
//   });
  
//   app.post('/api/hive', async (req, res) => {
//     const { areaId, name } = req.body;
  
//     if (!areaId || !name) {
//       return res.status(400).send('Bad Request: Missing required fields');
//     }
  
//     try {
//       const result = await database.addHive(dbConnection, areaId, name);
//       if(result.existing) {
//         return res.status(409).json({message: 'Hive already exists', hiveId: result.hiveId});
//       } else {
//         return res.status(201).json({message: 'Hive added successfully', hiveId: result.hiveId});
//       }
//     } catch (error) {
//       console.error('Error adding hive:', error);
//       return res.status(500).send('Internal Server Error');
//     }
//   });
  
//   app.put('/api/hive', async (req, res) => {
//     const { hiveId, areaId, name } = req.body;
  
//     // hiveId가 없으면 문제
//     if (!hiveId) {
//       return res.status(400).send('Bad Request: Missing hiveId');
//     }
  
//     try {
//       const result = await database.updateHive(dbConnection, { hiveId, areaId, name });
//       if(result.updated) {
//         return res.status(200).json({message: 'Hive updated successfully', hiveId: result.hiveId});
//       } else {
//         return res.status(404).json({message: 'Hive not found', hiveId: result.hiveId});
//       }
//     } catch (error) {
//       console.error('Error updating hive:', error);
//       return res.status(500).send('Internal Server Error');
//     }
//   });
  
//   app.delete('/api/hive', async (req, res) => {
//     const { hiveId } = req.query;
  
//     if (!hiveId) {
//       return res.status(400).send('Bad Request: Missing hiveId');
//     }
  
//     try {
//       const result = await database.deleteHive(dbConnection, hiveId);
//       if(result.deleted) {
//         return res.status(200).json({message: 'Hive deleted successfully', hiveId: result.hiveId});
//       } else {
//         return res.status(404).json({message: 'Hive not found', hiveId: result.hiveId});
//       }
//     } catch (error) {
//       console.error('Error deleting hive:', error);
//       return res.status(500).send('Internal Server Error');
//     }
//   });
  