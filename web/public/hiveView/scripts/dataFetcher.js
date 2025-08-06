let fetcher_deviceList = [];
let fetcher_tRange = {sTime: null, eTime: null};
let fetcher_dataList = [];

// async function fetchInOutData(deviceId, sTime, eTime) {
//     const url = `${window.BASE_PATH}api/inout?deviceId=${deviceId}&sTime=${sTime}&eTime=${eTime}`;
//     const response = await fetch(url);

//     if (!response.ok) {
//         console.warn(`No InOut data for device ${deviceId} (status: ${response.status})`);
//         return [];  // 데이터 없음 처리
//     }

//     const data = await response.json();
//     console.log(`Data received for device ${deviceId}:`, data);
//     return data;
// }

// async function fetchSensorData(deviceId, sTime, eTime) {
//     const url = `${window.BASE_PATH}api/sensor?deviceId=${deviceId}&sTime=${sTime}&eTime=${eTime}`;
//     const response = await fetch(url);

//     if (!response.ok) {
//         console.warn(`No Sensor data for device ${deviceId} (status: ${response.status})`);
//         return [];  // 데이터 없음 처리
//     }

//     const data = await response.json();
//     console.log(`Data received for device ${deviceId}:`, data);
//     return data;
// }

async function fetchSensor2Data(deviceId, sTime, eTime, dataTypes) {
    const typeStr = dataTypes.join(',');
    const url = `${window.BASE_PATH}api/data/sensor2?deviceId=${deviceId}&sTime=${sTime}&eTime=${eTime}&dataTypes=${typeStr}`;
    const response = await fetch(url);

    if (!response.ok) {
        console.warn(`No data for device ${deviceId} (status: ${response.status})`);
        return [];
    }

    const data = await response.json();
    console.log(`[DataFetcher] ${data.length} data points received for device ${deviceId} (${sTime} ~ ${eTime})`, data);
    return data;
}

async function fetchDataList() {
    fetcher_dataList = [];
    let i = 0;

    for (const device of fetcher_deviceList) {
        let dataTypes = [];
        let typeMap = {}; // data_type -> label

        if (device.type_id == 2) {
            dataTypes = [4, 5, 6, 7];  // TEMP, HUMI, CO2, WEIGH
            typeMap = {
                4: 'Temp',
                5: 'Humi',
                6: 'CO2',
                7: 'Weight'
            };
        } else if (device.type_id == 3) {
            dataTypes = [2, 3];  // IN, OUT
            typeMap = {
                2: 'In',
                3: 'Out'
            };
        } else {
            continue;
        }

        const data = await fetchSensor2Data(device.id, fetcher_tRange.sTime, fetcher_tRange.eTime, dataTypes);

        for (const typeId of dataTypes) {
            const label = typeMap[typeId];

            const parsed = data
                .filter(d => d.data_type === typeId)
                .map(d => ({
                    id: d.id,
                    value: d.value,
                    time: d.time
                }));

            const deviceMeta = {
                id: i++,
                type: label,
                hive_name: device.hive_name,
                name: device.name
            };

            fetcher_dataList.push({ device: deviceMeta, data: parsed });
        }
    }

    const updateEvent = new CustomEvent('dataUpdated', { detail: fetcher_dataList });
    document.dispatchEvent(updateEvent);
}

// ================== 장치 선택기의 이벤트 리스너 ==================
document.addEventListener('deviceListUpdated', async (event) => {
    console.log('deviceListUpdated:', event.detail);

    fetcher_deviceList = event.detail;
    await fetchDataList();
});


// ================== 시간 선택기의 이벤트 리스너 ==================
document.addEventListener('timeRangeUpdated', async (event) => {
    console.log(`Time range updated: ${event.detail.sTime} ~ ${event.detail.eTime}`);
    fetcher_tRange = event.detail;
    if(fetcher_deviceList.length > 0) {
        await fetchDataList();
    }
});


// ================== latestInfo의 이벤트 리스너 ==================
document.addEventListener('dataUpdated', (event) => {
    console.log('dataLoaded:', fetcher_dataList);
    const dataList = event.detail;
    console.log('dataList:', dataList);

    const latestInData = getLatestData(dataList, 'In');
    const latestOutData = getLatestData(dataList, 'Out');
    const latestTempData = getLatestData(dataList, 'Temp');
    const latestHumiData = getLatestData(dataList, 'Humi');
    const latestCO2Data = getLatestData(dataList, 'CO2');
    const latestWeightData = getLatestData(dataList, 'Weight');

    // I/O 데이터는 특별히 처리
    const ioValue = document.querySelector('#io-value');
    const ioTime = document.querySelector('#io-time');
    if (latestInData && latestOutData) {
        ioValue.textContent = `${latestInData.value} / ${latestOutData.value}`;
        ioTime.textContent = convertISOStringToLocalString(latestInData.time);
    } else {
        ioValue.textContent = 'N/A';
        ioTime.textContent = '';
    }

    updateInfo('temp', latestTempData);
    updateInfo('humi', latestHumiData);
    updateInfo('co2', latestCO2Data);
    updateInfo('weight', latestWeightData);
});

function convertISOStringToLocalString(isoString) {
    const date = new Date(isoString);
    const dateString = date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).replace(/\s/g, '');;

    const timeString = date.toLocaleTimeString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    });

    return `(${dateString} ${timeString})`;
}

function getLatestData(dataList, type) {
    const filtered = dataList.filter(d => d.device.type === type);

    let latest = null;

    for (const item of filtered) {
        if (!item.data || item.data.length === 0) continue; // 💡 추가
        const latestEntry = item.data[0];
        if (!latest || new Date(latestEntry.time) > new Date(latest.time)) {
            latest = latestEntry;
        }
    }

    return latest;
}

function updateInfo(selector, data) {
    const valueElement = document.querySelector(`#${selector}-value`);
    const timeElement = document.querySelector(`#${selector}-time`);
    if (data) {
        valueElement.textContent = data.value;
        timeElement.textContent = convertISOStringToLocalString(data.time);
    } else {
        valueElement.textContent = 'N/A';
        timeElement.textContent = '';
    }
}