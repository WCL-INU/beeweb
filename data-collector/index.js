const axios = require('axios');

console.log('Starting the data collector script...');


const API_BASE_URL = 'http://api:8090';


// Convert ISO 8601 format to MySQL DATETIME format
function convertToMySQLDateTime(isoDate) {
  return isoDate.replace('T', ' ').substring(0, 19);
}

// Register Hive and Device if not already present
const registerHiveAndDevice = async (hiveId) => {
  try {
    // Register Hive
    const responseHive = await axios.post('http://api:8090/api/hive', { areaId: 1, name: `Hive ${hiveId}` }, {
      validateStatus: function (status) {
        return status === 201 || status === 409; // Resolve only if the status code is 201 or 409
      }
    });
    const hiveDbId = responseHive.data.hiveId;

    // Register Device
    const responseDevice = await axios.post('http://api:8090/api/device', { name:`Thingspeak`, hiveId: hiveDbId, typeId: 3 }, {
      validateStatus: function (status) {
        return status === 201 || status === 409; // Resolve only if the status code is 201 or 409
      }
    });
    return responseDevice.data.deviceId;

  } catch (error) {
    console.error('Error registering hive or device:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Send batch data to inout API
const sendInOutDataBatch = async (batch) => {
  try {
    await axios.post('http://api:8090/api/upload', {
      type: 3,
      data: batch
    });
  } catch (error) {
    console.error('Error sending inout data:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Fetch data from Thingspeak and insert into inout_data
const fetchAndInsertData = async (group_id, results = 5) => {
  let url = `https://api.thingspeak.com/channels/${process.env[`CHANNEL_ID${group_id}`]}/feeds.json?results=${results}`;
  console.log(`Fetching data from: ${url}`);
  
  try {
    const response = await axios.get(url);
    const data = response.data.feeds;
    const maxEntryId = response.data.channel.last_entry_id;

    if (!data || data.length === 0) {
      console.log('No data found in the response.');
      return { maxEntryId, newEntryIds: [] };
    }

    let batch = [];
    let newEntryIds = [];

    // Register Hives and Devices
    const hiveDeviceMap = {};
    const hiveIds = group_id === 1 ? [1, 2, 3] : [4, 5, 6];
    for (const hiveId of hiveIds) {
      hiveDeviceMap[hiveId] = await registerHiveAndDevice(hiveId);
    }

    for (let entry of data) {
      const time = entry.created_at;
      const fields = [
        { hiveId: hiveIds[0], inField: entry.field1, outField: entry.field2 },
        { hiveId: hiveIds[1], inField: entry.field3, outField: entry.field4 },
        { hiveId: hiveIds[2], inField: entry.field5, outField: entry.field6 }
      ];

      fields.forEach(field => {
        if (field.inField != null || field.outField != null) {
          batch.push({ id: hiveDeviceMap[field.hiveId], time, inField: field.inField || 0, outField: field.outField || 0 });
        }
      });

      newEntryIds.push(entry.entry_id);

      if (batch.length >= 1000) {
        await sendInOutDataBatch(batch);
        console.log(`Processed ${batch.length} rows of inout data`);
        batch = [];
      }
    }

    // Send remaining batch
    if (batch.length > 0) {
      await sendInOutDataBatch(batch);
      console.log(`Processed remaining ${batch.length} rows of inout data`);
    }

    return { maxEntryId, newEntryIds };
  } catch (error) {
    console.error('Error fetching data:', error);
    if (error.response) {
      console.error('Error response data:', error.response.data);
    }
  }
};

// Scheduler to periodically fetch data
const startScheduler = async () => {
  console.log('Scheduler started. Fetching data immediately...');
  try {
    const fetchDataWithDelay = async (isInitial = false) => {
      const currentTime = new Date().toLocaleString();
      console.log(`[${currentTime}] Fetching data...`);

      let result1, result2;

      if (isInitial) {
        result1 = await fetchAndInsertData(1, 8000);
        result2 = await fetchAndInsertData(2, 8000);
      } else {
        result1 = await fetchAndInsertData(1);
        result2 = await fetchAndInsertData(2);
      }

      setTimeout(() => fetchDataWithDelay(false), 10 * 60 * 1000); // 10분마다 실행
    };

    await fetchDataWithDelay(true);
  } catch (error) {
    console.error('Failed to start scheduler:', error);
  }
};

startScheduler();
