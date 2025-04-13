export interface Device {
    id: number;
    hive_id: number;
    type_id: number;
    modem_ip: string;
    name: string;
}

export interface DeviceType {
    id: number;
    name: string;
}

export interface Hive {
    id: number;
    area_id: number;
    name: string;
}

export interface Area {
    id: number;
    name: string;
    location: string;
}

export interface User {
    id: string;
    pw: string;
    grade: number;
}

export interface InOutData {
    id: number;
    device_id: number;
    in_field : number;
    out_field : number;
    time: string;
}

export interface SensorData {
    id: number;
    device_id: number;
    temp : number;
    humi : number;
    co2 : number;
    weigh : number;
    time : string;
}

export interface CameraData {
    id: number;
    device_id: number;
    picture: string;
    time: string;
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