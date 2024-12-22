const express = require('express');
const multer = require('multer');
const database = require('./db');

const app = express();
const port = 8090;

// Multer 설정
const upload = multer(); // Multer 설정

// DB 연결 설정
const dbConnection = database.createDbConnection();

app.use(express.json());

// // =============================
// // AREA & HIVE
// // =============================
// app.get('/api/areahive', async (req, res) => {
//   try {
//     const data = await database.getAreasAndHives(dbConnection);
//     res.json(data);
//   } catch (error) {
//     console.error('Error fetching areas and hives:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });

// // =============================
// // DEVICE TYPES
// // =============================
// app.get('/api/devicetypes', async (req, res) => {
//   try {
//     const data = await database.getDeviceTypes(dbConnection);
//     res.json(data);
//   } catch (error) {
//     console.error('Error fetching device types:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });

// =============================
// INOUT
// =============================
// GET 요청을 처리하여 데이터 반환
app.get('/api/inout', async (req, res) => {
  const { deviceId, sTime, eTime } = req.query;
  if (!deviceId || !sTime || !eTime) {
    return res.status(400).send('Bad Request: Missing required fields');
  }

  try {
    const data = await database.getInOutDataByDeviceAndTimeRange(dbConnection, deviceId, sTime, eTime);
    res.json(data);
  } catch (error) {
    console.error('Error fetching inout data:', error);
    return res.status(500).send('Internal Server Error');
  }
});

// =============================
// SENSOR
// =============================
// GET 요청을 처리하여 데이터 반환
app.get('/api/sensor', async (req, res) => {
  const { deviceId, sTime, eTime } = req.query;
  if (!deviceId || !sTime || !eTime) {
    return res.status(400).send('Bad Request: Missing required fields');
  }

  try {
    const data = await database.getSensorDataByDeviceAndTimeRange(dbConnection, deviceId, sTime, eTime);
    res.json(data);
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    return res.status(500).send('Internal Server Error');
  }
});

// =============================
// CAMERA
// =============================
// GET 요청을 처리하여 데이터 반환
app.get('/api/camera', async (req, res) => {
  const { deviceId, sTime, eTime } = req.query;
  if (!deviceId || !sTime || !eTime) {
    return res.status(400).send('Bad Request: Missing required fields');
  }

  try {
    const data = await database.getCameraDataByDeviceAndTimeRange(dbConnection, deviceId, sTime, eTime);
    res.json(data);
  } catch (error) {
    console.error('Error fetching camera data:', error);
    return res.status(500).send('Internal Server Error');
  }
});

// =============================
// UPLINK & UPLOAD
// =============================
const handleInOutData = async (dbConnection, data) => {
  if (data.some(item => item.inField == null || item.outField == null)) {
    throw new Error('Bad Request: Missing required fields');
  }
  await database.insertInOutData(dbConnection, data);
};

const handleSensorData = async (dbConnection, data) => {
  if (data.some(item => item.temp == null && item.humi == null && item.co2 == null && item.weigh == null)) {
    throw new Error('Bad Request: Missing required fields');
  }
  await database.insertSensorData(dbConnection, data);
};

const handleCameraData = async (dbConnection, data) => {
  if (data.some(item => item.picture == null)) {
    throw new Error('Bad Request: Missing required fields');
  }
  await database.insertCameraData(dbConnection, data);
}

app.post('/api/uplink', async (req, res) => {
  const { id, type } = req.body;

  if (id == null || type == null) {
    return res.status(400).send('Bad Request: Missing required fields');
  }

  try {
    // DB에 있는지 확인
    const deviceResults = await database.checkDevice(dbConnection, id, type);
    if (deviceResults.length === 0) {
      return res.status(400).send('Bad Request: Invalid device Id or type');
    }

    // IP 업데이트
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    await database.updateDevice(dbConnection, { deviceId: id, modemIp: ip });

    // timestamp를 mysql포맷으로 설정
    const time = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // type 획득
    const types = await database.getDeviceTypes(dbConnection);
    const typeName = types.find(item => item.id === parseInt(type)).name;
    // 각 Type에 맞게 데이터 삽입
    if(typeName === 'INOUT') {
      const {inField, outField } = req.body;
      if (inField == null || outField == null) {
        return res.status(400).send('Bad Request: Missing required fields');
      }
      await handleInOutData(dbConnection, [{ id, time, inField, outField }]);
      return res.status(201).send('Data inserted successfully');
    } else if(typeName === 'SENSOR') {
      const { temp, humi, co2, weigh } = req.body;
      if (temp == null && humi == null && co2 == null && weigh == null) {
        return res.status(400).send('Bad Request: Missing required fields');
      }
      await handleSensorData(dbConnection, [{ id, time, temp, humi, co2, weigh }]);
      return res.status(201).send('Data inserted successfully');
    } else if(typeName === 'CAMERA') {
      console.log('CAMERA');
    } else {
      return res.status(400).send('Bad Request: Invalid device type');
    }
    
  } catch (error) {
    console.error('Error processing uplink:', error);
    return res.status(500).send('Internal Server Error');
  }
});

// POST route to handle uploads
app.post('/api/upload', upload.any(), async (req, res) => {
  try {
    let type;
    let data = [];
    if (req.is('multipart/form-data')) {

      let files = req.files.filter(file => file.fieldname.startsWith('file'));
      // Handle multipart/form-data
      type = req.body.type;

      // Extract metadata from the request
      const metadata = files.map((file, index) => ({
        id: req.body[`file${index + 1}_id`],
        time: req.body[`file${index + 1}_time`],
        file: file
      }));

      if (!type || !files || files.length === 0 || metadata.some(item => !item.id || !item.time)) {
        console.log(type, files, metadata);
        return res.status(400).send('Bad Request: Missing required fields or data');
      }

      // Process each file and corresponding data
      data = metadata.map((item, index) => ({
        id: item.id,
        time: item.time,
        picture: item.file.buffer
      }));

    } else if (req.is('application/json')) {
      // Handle application/json
      type = req.body.type;
      data = req.body.data;

      if (!type || !Array.isArray(data) || data.length === 0) {
        return res.status(400).send('Bad Request: Missing required fields or data');
      }
    } else {
      return res.status(400).send('Bad Request: Unsupported content type');
    }

    // timestamp를 mysql포맷으로 변경
    data.forEach(element => {
      if (element.time) {
        element.time = element.time.replace('T', ' ').replace('Z', '');
      }
    });

    // IP 획득
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    // data에서 id가 unique한 element들만 찾아서 id를획득
    const uniqueIds = [...new Set(data.map(item => item.id))];
    // IP 업데이트
    uniqueIds.forEach(async id => {
      await database.updateDevice(dbConnection, { deviceId: id, modemIp: ip });
    });

    // type 획득
    const types = await database.getDeviceTypes(dbConnection);
    const typeName = types.find(item => item.id === parseInt(type)).name;
    // 각 Type에 맞게 데이터 삽입
    if(typeName === 'INOUT') {
      await handleInOutData(dbConnection, data);
    } else if(typeName === 'SENSOR') {
      await handleSensorData(dbConnection, data);
    } else if(typeName === 'CAMERA') {
      await handleCameraData(dbConnection, data);
    } else {
      return res.status(400).send('Bad Request: Invalid device type');
    }

    return res.status(201).send('Data inserted successfully');
  } catch (error) {
    console.error('Error processing upload:', error);
    return res.status(500).send('Internal Server Error');
  }
});

app.listen(3000, () => {
  console.log('Backend server is running on port 3000');
});

// =============================
// AREA
// =============================
// app.get('/api/area', async (req, res) => {
//   const { areaId } = req.query;
//   try {
//     // areaId가 있으면 해당 areaId로 검색
//     if (areaId) {
//       const areas = await database.getAreaByAreaId(dbConnection, areaId.split(','));
//       return res.json(areas);
//     } else { // areaId가 없으면 전체 검색
//       const areas = await database.getAreas(dbConnection);
//       return res.json(areas);
//     }
//   } catch (error) {
//     console.error('Error fetching areas:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });

// app.post('/api/area', async (req, res) => {
//   const { name, location } = req.body;
//   if (!name) {
//     return res.status(400).send('Bad Request: Missing required fields');
//   }

//   try {
//     const result = await database.addArea(dbConnection, name, location);
//     if(result.existing) {
//       return res.status(409).json({message: 'Area already exists', areaId: result.areaId});
//     } else {
//       return res.status(201).json({message: 'Area added successfully', areaId: result.areaId});
//     }
//   } catch (error) {
//     console.error('Error adding area:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });

// app.put('/api/area', async (req, res) => {
//   const { areaId, name, location } = req.body;

//   if (!areaId) {
//     return res.status(400).send('Bad Request: Missing areaId');
//   }

//   try {
//     const result = await database.updateArea(dbConnection, { areaId, name, location });
//     if(result.updated) {
//       return res.status(200).json({message: 'Area updated successfully', areaId: result.areaId});
//     } else {
//       return res.status(404).json({message: 'Area not found', areaId: result.areaId});
//     }
//   } catch (error) {
//     console.error('Error updating area:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });

// app.delete('/api/area', async (req, res) => {
//   const { areaId } = req.query;

//   if (!areaId) {
//     return res.status(400).send('Bad Request: Missing areaId');
//   }

//   try {
//     const result = await database.deleteArea(dbConnection, areaId);
//     if(result.deleted) {
//       return res.status(200).json({message: 'Area deleted successfully', areaId: result.areaId});
//     } else {
//       return res.status(404).json({message: 'Area not found', areaId: result.areaId});
//     }
//   } catch (error) {
//     console.error('Error deleting area:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });

// =============================
// HIVE
// =============================
// app.get('/api/hive', async (req, res) => {
//   const { areaId, hiveId } = req.query;

//   // areaId와 hiveId가 모두 없을 때 에러 처리
//   if (!areaId && !hiveId) {
//     return res.status(400).send('Bad Request: Missing areaId or hiveId');
//   }

//   try {
//     let hives;

//     // hiveId가 있으면 해당 hiveId로 검색
//     if (hiveId) {
//       hives = await database.getHiveByHiveId(dbConnection, hiveId.split(','));
//     } else {
//       // hiveId가 없으면 areaId로 검색
//       hives = await database.getHivesByAreaId(dbConnection, areaId);
//     }

//     return res.status(200).json(hives);
//   } catch (error) {
//     console.error('Error fetching hives:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });

// app.post('/api/hive', async (req, res) => {
//   const { areaId, name } = req.body;

//   if (!areaId || !name) {
//     return res.status(400).send('Bad Request: Missing required fields');
//   }

//   try {
//     const result = await database.addHive(dbConnection, areaId, name);
//     if(result.existing) {
//       return res.status(409).json({message: 'Hive already exists', hiveId: result.hiveId});
//     } else {
//       return res.status(201).json({message: 'Hive added successfully', hiveId: result.hiveId});
//     }
//   } catch (error) {
//     console.error('Error adding hive:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });

// app.put('/api/hive', async (req, res) => {
//   const { hiveId, areaId, name } = req.body;

//   // hiveId가 없으면 문제
//   if (!hiveId) {
//     return res.status(400).send('Bad Request: Missing hiveId');
//   }

//   try {
//     const result = await database.updateHive(dbConnection, { hiveId, areaId, name });
//     if(result.updated) {
//       return res.status(200).json({message: 'Hive updated successfully', hiveId: result.hiveId});
//     } else {
//       return res.status(404).json({message: 'Hive not found', hiveId: result.hiveId});
//     }
//   } catch (error) {
//     console.error('Error updating hive:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });

// app.delete('/api/hive', async (req, res) => {
//   const { hiveId } = req.query;

//   if (!hiveId) {
//     return res.status(400).send('Bad Request: Missing hiveId');
//   }

//   try {
//     const result = await database.deleteHive(dbConnection, hiveId);
//     if(result.deleted) {
//       return res.status(200).json({message: 'Hive deleted successfully', hiveId: result.hiveId});
//     } else {
//       return res.status(404).json({message: 'Hive not found', hiveId: result.hiveId});
//     }
//   } catch (error) {
//     console.error('Error deleting hive:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });

// =============================
// DEVICE
// =============================
// app.get('/api/device', async (req, res) => {
//   const { hiveId, deviceId } = req.query;

//   if (!hiveId && !deviceId) {
//     return res.status(400).send('Bad Request: Missing hiveId or deviceId');
//   }

//   try {
//     let devices;
//     if (deviceId) {
//       devices = await database.getDeviceByDeviceId(dbConnection, deviceId.split(','));
//     } else {
//       devices = await database.getDevicesByHiveId(dbConnection, hiveId);
//     }
//     return res.status(200).json(devices);
//   } catch (error) {
//     console.error('Error fetching device:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });

// app.post('/api/device', async (req, res) => {
//   const { name, hiveId, typeId } = req.body;

//   if (!name || !hiveId || !typeId) {
//     return res.status(400).send('Bad Request: Missing required fields');
//   }

//   try {
//     const result = await database.addDevice(dbConnection, name, hiveId, typeId);
//     if(result.existing) {
//       return res.status(409).json({message: 'Device already exists', deviceId: result.deviceId});
//     } else {
//       return res.status(201).json({message: 'Device added successfully', deviceId: result.deviceId});
//     }
//   } catch (error) {
//     console.error('Error adding device:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });

// app.put('/api/device', async (req, res) => {
//   const { deviceId, name } = req.body;

//   // deviceId가 없으면 문제
//   if (!deviceId) {
//     return res.status(400).send('Bad Request: Missing deviceId');
//   }

//   try {
//     const result = await database.updateDevice(dbConnection, { deviceId, name });
//     if(result.updated) {
//       return res.status(200).json({message: 'Device updated successfully', deviceId: result.deviceId});
//     } else {
//       return res.status(404).json({message: 'Device not found', deviceId: result.deviceId});
//     }
//   } catch (error) {
//     console.error('Error updating device:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });

// app.delete('/api/device', async (req, res) => {
//   const { deviceId } = req.query;

//   if (!deviceId) {
//     return res.status(400).send('Bad Request: Missing deviceId');
//   }

//   try {
//     const result = await database.deleteDevice(dbConnection, deviceId);
//     if(result.deleted) {
//       return res.status(200).json({message: 'Device deleted successfully', deviceId: result.deviceId});
//     } else {
//       return res.status(404).json({message: 'Device not found', deviceId: result.deviceId});
//     }
//   } catch (error) {
//     console.error('Error deleting device:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });


// // =============================
// // login
// // =============================

// app.post('/api/login', async (req, res) => {
//   const { id, pw } = req.body;
//   if (!id || !pw) {
//     console.log('Bad Request: Missing required fields');
//     return res.status(400).send('Bad Request: Missing required fields');
//   }

//   try {
//     console.log('try login id:', id);
//     // 사용자 정보를 데이터베이스에서 조회
//     const user = await database.getUserById(dbConnection, id);
//     if(user && user.pw === pw) {
//       return res.status(200).json({ success: true, user: { id: user.id, grade: user.grade } });
//     } else {
//       return res.status(401).json({ success: false, message: 'Invalid credentials' });
//     }
//   } catch (error) {
//     console.error('Error logging in:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });

// app.get('/api/users/:id', async (req, res) => {
//   const id = req.params.id;
//   if (!id) {
//     console.log('Bad Request: Missing required fields');
//     return res.status(400).send('Bad Request: Missing required fields');
//   }

//   try {
//     // 사용자 정보를 데이터베이스에서 조회
//     const user = await database.getUserById(dbConnection, id);
//     if (user) {
//       return res.status(200).json({ id: user.id, grade: user.grade });
//     } else {
//       return res.status(404).json({ success: false, message: 'User not found' });
//     }
//   } catch (error) {
//     console.error('Error fetching user:', error);
//     return res.status(500).send('Internal Server Error');
//   }
// });

// 서버 시작
app.listen(port, () => {
  console.log(`API 서버가 포트 ${port}에서 실행 중입니다.`);
});
