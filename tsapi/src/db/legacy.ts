import { pool } from './index';
import { ResultSetHeader } from 'mysql2';

export interface AreaHive {
    id: number;
    name: string;
    hives: { id: number, name: string }[];
}

export const getAreaHives = async (): Promise<AreaHive[]> => {
    interface dbAreaHive {
        area_id: number;
        area_name: string;
        hive_id: number;
        hive_name: string;
    }

    try {
        const query = `
        SELECT 
          a.id AS area_id, a.name AS area_name, 
          h.id AS hive_id, h.name AS hive_name
        FROM areas a
        LEFT JOIN hives h ON a.id = h.area_id;
      `;

        const [rows] = await pool.execute(query);
        const results = rows as dbAreaHive[];
        const areaHives = [] as AreaHive[];

        results.forEach(row => {
            const { area_id, area_name, hive_id, hive_name } = row;

            if (!areaHives[area_id]) {
                areaHives[area_id] = {
                    id: area_id,
                    name: area_name,
                    hives: []
                };
            }

            if (hive_id) {
                areaHives[area_id].hives.push({
                    id: hive_id,
                    name: hive_name
                });
            }
        });

        const areas = Object.values(areaHives);
        console.log(`Fetched ${areas.length} areas and ${results.length} hives`);
        return areas as AreaHive[];
    } catch (error) {
        throw error;
    }
}

// const getAreasAndHives = (connection) => {
//     return new Promise((resolve, reject) => {
//         const query = `
//         SELECT 
//           a.id AS area_id, a.name AS area_name, 
//           h.id AS hive_id, h.name AS hive_name
//         FROM areas a
//         LEFT JOIN hives h ON a.id = h.area_id;
//       `;

//         connection.query(query, (error, results) => {
//             if (error) {
//                 console.error('Error querying the database:', error);
//                 return reject(error);
//             }

//             const areasMap = {};

//             results.forEach(row => {
//                 const { area_id, area_name, hive_id, hive_name } = row;

//                 if (!areasMap[area_id]) {
//                     areasMap[area_id] = {
//                         id: area_id,
//                         name: area_name,
//                         hives: []
//                     };
//                 }

//                 if (hive_id) {
//                     areasMap[area_id].hives.push({
//                         id: hive_id,
//                         name: hive_name
//                     });
//                 }
//             });

//             const areas = Object.values(areasMap);
//             console.log(`Fetched ${areas.length} areas and ${results.length} hives`);
//             return resolve(areas);
//         });
//     });
// };
